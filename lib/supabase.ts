import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _browser: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (_browser) return _browser;
  _browser = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } }
  });
  return _browser;
}

export function supabaseService(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no definida");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
