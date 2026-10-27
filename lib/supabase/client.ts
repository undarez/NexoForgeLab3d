import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dkdqmwzxildenngawwju.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_b67urOqnRcS8nfYZtEFXvg_ytkTU8su';
  return createBrowserClient(url, key);
}
