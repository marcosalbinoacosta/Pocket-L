import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

(async () => {
  const { data, error } = await sb.from("representantes")
    .select("id,nombre,color,activo,created_at")
    .order("created_at");
  if (error) { console.error(error.message); process.exit(1); }
  console.log("Representantes en la DB:");
  for (const r of data ?? []) {
    console.log(`  ${r.activo ? "✓" : "✗"} ${r.nombre.padEnd(20)}  ${r.color}  (${r.id})`);
  }
})();
