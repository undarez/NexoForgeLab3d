import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120)||"upload.bin";
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
 if(!(req.headers.get("content-type")??"").toLowerCase().includes("multipart/form-data"))return json({error:"Format de formulaire invalide."},415);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!service||!anon)return json({error:"Configuration serveur incomplète."},500);
 let form:FormData;try{form=await req.formData()}catch{return json({error:"Formulaire illisible."},400)}
 if(String(form.get("website")??"").trim())return json({ok:true,reference:"NFL-RECEIVED"});
 let p:Record<string,unknown>;try{p=JSON.parse(String(form.get("payload")??"{}"))}catch{return json({error:"Données invalides."},400)}
 const name=String(p.customer_name??"").trim().slice(0,160),email=String(p.customer_email??"").trim().toLowerCase().slice(0,254),project=String(p.project_type??""),finish=String(p.finish_type??"");
 const h=Number(p.height_mm),w=Number(p.width_mm),d=Number(p.depth_mm),qty=Number(p.quantity??1),concepts=Number(p.concept_count??3);
 if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["lithophane","figurine","decor","concept","other"].includes(project)||!["raw","painted","airbrush"].includes(finish))return json({error:"Vérifie ton nom, ton e-mail, le projet et la finition."},422);
 if(![h,w,d].every(n=>Number.isInteger(n)&&n>=1&&n<=215))return json({error:"Chaque dimension doit être comprise entre 1 et 215 mm, supports compris."},422);
 if(!Number.isInteger(qty)||qty<1||qty>100||![1,2,3].includes(concepts))return json({error:"Vérifie la quantité et le nombre de propositions."},422);
 const files=form.getAll("files").filter((v):v is File=>v instanceof File&&v.size>0),imageTypes=new Set(["image/jpeg","image/png","image/webp"]),modelTypes=new Set(["model/stl","model/obj","model/3mf","application/octet-stream","text/plain"]);
 if(files.length>5)return json({error:"Cinq fichiers maximum."},413);
 for(const f of files){if(f.size>10*1024*1024)return json({error:"Chaque fichier doit faire 10 Mo maximum."},413);const ext=f.name.split(".").pop()?.toLowerCase()??"";if(!(imageTypes.has(f.type)||(["stl","obj","3mf"].includes(ext)&&(modelTypes.has(f.type)||!f.type))))return json({error:"Formats acceptés : JPG, PNG, WebP, STL, OBJ et 3MF."},415)}
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const ip=req.headers.get("cf-connecting-ip")??req.headers.get("x-real-ip")??(req.headers.get("x-forwarded-for")??"").split(",")[0].trim()??"unknown";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip+":"+service)),ipHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 const {data:allowed,error:rateError}=await admin.rpc("consume_quote_submission",{p_ip_hash:ipHash});
 if(rateError){console.error("rate limit",rateError.message);return json({error:"Protection anti-abus indisponible. Réessaie plus tard."},503)}
 if(allowed!==true)return json({error:"Trop de demandes depuis cette connexion. Réessaie dans une heure."},429);
 let userId:string|null=null;const auth=req.headers.get("authorization")??"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(token){const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});const {data}=await client.auth.getUser(token);if(data.user)userId=data.user.id}
 const {data:row,error}=await admin.from("quote_requests").insert({user_id:userId,guest_submission:!userId,customer_name:name,customer_email:email,customer_phone:String(p.customer_phone??"").trim().slice(0,40)||null,project_type:project,project_description:String(p.project_description??"").trim().slice(0,5000)||null,concept_count:concepts,finish_type:finish,height_mm:h,width_mm:w,depth_mm:d,quantity:qty,packaging_type:String(p.packaging_type??"standard").slice(0,40),shipping_service:String(p.shipping_service??"to_be_confirmed").slice(0,80),personalization:{text:String(p.personalization_text??"").slice(0,500),birthday:String(p.birthday??"").slice(0,30),light:p.light===true},customer_notes:String(p.customer_notes??"").slice(0,3000)}).select("id,reference").single();
 if(error||!row){console.error("request insert",error?.message);return json({error:"Impossible d'enregistrer la demande pour le moment."},500)}
 const failed:string[]=[];for(const f of files){const path=`${userId??"guest"}/${row.id}/${crypto.randomUUID()}-${safe(f.name)}`,upload=await admin.storage.from("nexoforge-uploads").upload(path,new Uint8Array(await f.arrayBuffer()),{contentType:f.type||"application/octet-stream",upsert:false});if(upload.error){failed.push(f.name);continue}await admin.from("quote_files").insert({request_id:row.id,storage_path:path,original_filename:safe(f.name),mime_type:f.type||"application/octet-stream",size_bytes:f.size})}
 const to=Deno.env.get("QUOTE_NOTIFICATION_EMAIL")??"flobillard02200@gmail.com",resend=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("EMAIL_FROM");let emailConfigured=false;
 if(resend&&from){const html=`<div style="background:#111014;color:#f7f3eb;padding:28px;font-family:Arial"><div style="max-width:620px;margin:auto;background:#211d25;border:1px solid #d7ad4a;border-radius:16px;padding:24px"><h1 style="color:#d7ad4a">NexoForgeLab3D</h1><p>Nouvelle demande <b>${esc(row.reference)}</b></p><p><b>Client :</b> ${esc(name)} — ${esc(email)}</p><p><b>Projet :</b> ${esc(project)}</p><p><b>Dimensions :</b> ${h} × ${w} × ${d} mm</p><p><b>Finition :</b> ${esc(finish)}</p><p><b>Description :</b> ${esc(String(p.project_description??"").slice(0,1200))}</p><p style="color:#f5d98b">Réponds à ce message pour contacter le client.</p></div></div>`;const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],reply_to:email,subject:`Nouvelle demande ${row.reference} — NexoForgeLab3D`,html})}),mail=await response.json().catch(()=>({}));emailConfigured=response.ok;await admin.from("email_events").insert({request_id:row.id,provider:"resend",provider_message_id:mail.id??null,recipient:to,event_type:"quote_request_notification",status:response.ok?"sent":"failed",error_message:response.ok?null:String(mail.message??"Erreur d'envoi").slice(0,500)})}else{await admin.from("email_events").insert({request_id:row.id,provider:"resend",recipient:to,event_type:"quote_request_notification",status:"not_configured",error_message:"RESEND_API_KEY et EMAIL_FROM doivent être configurés."})}
 return json({ok:true,reference:row.reference,emailConfigured,filesAccepted:files.length-failed.length,filesFailed:failed},201);
});
