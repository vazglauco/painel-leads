import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  return { url, key };
}

export async function supabaseServer() {
  const { url, key } = publicConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items: { name: string; value: string; options: CookieOptions }[]) {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; proxy refreshes sessions. */ }
      }
    }
  });
}

export function supabaseAdmin() {
  const { url } = publicConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Configure SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
