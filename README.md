# NexoForgeLab3D — MVP

Application web de demandes de devis pour créations personnalisées en impression 3D. Stack : Next.js App Router, TypeScript, React, Tailwind CSS et Supabase Auth/Storage/Edge Functions.

## Développement local

1. `npm install`
2. Copier `.env.example` vers `.env.local`
3. `npm run dev`

## Variables d'environnement

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Ne jamais exposer de clé Supabase `service_role` dans le navigateur.

## Authentification Google

Dans Supabase Auth > URL Configuration, autoriser le domaine Vercel ainsi que `/auth/callback`. Le fournisseur Google doit être activé dans Supabase.

## Backend

Le backend Supabase est sur le projet `dkdqmwzxildenngawwju`. L'Edge Function `submit-quote-request` valide les demandes et les fichiers. Les notifications e-mail nécessitent les secrets serveur Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `QUOTE_NOTIFICATION_EMAIL`).

## Avant mise en production

- Exécuter `npm run build` et corriger les erreurs éventuelles.
- Tester connexion Google, demande invitée, téléversement et permissions RLS.
- Configurer Resend et les URL de redirection OAuth de production.
- Les devis PDF, factures PDF/légales, l'espace administrateur complet et l'intégration de facturation électronique sont hors MVP actuel.
