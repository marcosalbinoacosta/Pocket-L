/**
 * Borra un representante por nombre. Antes:
 *   - setea a null contactos.representante_id que lo referencien
 *   - chequea si tiene notas (notas.representante_id es NOT NULL → no se puede borrar si tiene)
 *
 * Uso: npx tsx scripts/delete-rep.ts "Nombre Completo"
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const nombre = process.argv[2];
if (!nombre) { console.error("Uso: npx tsx scripts/delete-rep.ts \"Nombre Completo\""); process.exit(1); }

(async () => {
  const { data: rep, error: e1 } = await sb.from("representantes").select("id,nombre").eq("nombre", nombre).maybeSingle();
  if (e1) { console.error(e1.message); process.exit(1); }
  if (!rep) { console.error(`No existe rep con nombre "${nombre}"`); process.exit(1); }

  const { count: notasCount, error: e2 } = await sb.from("notas").select("id", { count: "exact", head: true }).eq("representante_id", rep.id);
  if (e2) { console.error(e2.message); process.exit(1); }

  if ((notasCount ?? 0) > 0) {
    console.error(`✗ ${rep.nombre} tiene ${notasCount} notas, no se puede borrar sin reasignar/borrar esas notas. Abortando.`);
    process.exit(1);
  }

  const { error: e3 } = await sb.from("contactos").update({ representante_id: null }).eq("representante_id", rep.id);
  if (e3) { console.error("contactos:", e3.message); process.exit(1); }

  const { error: e4 } = await sb.from("representantes").delete().eq("id", rep.id);
  if (e4) { console.error("delete:", e4.message); process.exit(1); }

  console.log(`✓ Borrado: ${rep.nombre} (${rep.id})`);
})();
