/**
 * ============================================================================
 *   SCRIPT DESTRUCTIVO — DESHABILITADO POR DEFECTO
 * ============================================================================
 *
 * Borra participantes que no estén en el Excel (con cascade a contactos /
 * notas / participaciones), borra TODAS las notas, y resetea TODOS los
 * contactos a 'pendiente'. Fue escrito para correrse UNA sola vez, antes
 * del congreso. Correrlo DURANTE el congreso = perder el trabajo del equipo.
 *
 * Para reactivarlo (con conciencia plena de lo que hace):
 *   $env:I_REALLY_MEAN_IT = "yes"
 *   npx tsx scripts/cleanup-prod.DANGEROUS.disabled.ts
 *
 * Limpieza pre-congreso original:
 *  1. Borra participantes fantasma (los que están en DB pero NO en FINAL v5)
 *  2. Borra todas las notas (eran de prueba)
 *  3. Resetea todos los contactos a 'pendiente' y representante_id=null
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import * as XLSX from "xlsx";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

if (process.env.I_REALLY_MEAN_IT !== "yes") {
  console.error("");
  console.error("  ✗ DETENIDO: este script es DESTRUCTIVO.");
  console.error("    Borra participantes, notas y resetea contactos.");
  console.error("    Si realmente querés correrlo, ejecutá primero:");
  console.error("      $env:I_REALLY_MEAN_IT = \"yes\"");
  console.error("");
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error("Falta env"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const F_FINAL = path.join(process.cwd(), "..", "Listados de participantes y autoridades v5. FINAL.xlsx");
const SHEET = "Inscriptos 30-4. Sin duplicados";

(async () => {
  // 1) Leer nombres canónicos del FINAL
  const wb = XLSX.readFile(F_FINAL);
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Hoja ${SHEET} no encontrada`);
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const canonicos = new Set<string>();
  for (const r of rows) {
    const n = r["Delegado"]?.toString().trim();
    if (!n) continue;
    if (/^total\b/i.test(n)) continue;
    canonicos.add(n);
  }
  console.log(`FINAL: ${canonicos.size} nombres canónicos`);

  // 2) Traer todos los participantes de DB
  const { data: dbAll, error: e1 } = await sb.from("participantes").select("id,nombre_completo");
  if (e1) { console.error(e1); process.exit(1); }
  console.log(`DB:    ${dbAll!.length} participantes`);

  // 3) Identificar fantasmas
  const fantasmas = dbAll!.filter(p => !canonicos.has(p.nombre_completo));
  console.log(`\n→ FANTASMAS a borrar: ${fantasmas.length}`);
  for (const f of fantasmas) console.log(`   - ${f.nombre_completo}`);

  // 4) Borrar fantasmas (cascade → contactos + notas + participaciones de ellos)
  if (fantasmas.length) {
    const ids = fantasmas.map(f => f.id);
    const { error } = await sb.from("participantes").delete().in("id", ids);
    if (error) { console.error("✗ borrado fantasmas:", error.message); process.exit(1); }
    console.log(`✓ ${fantasmas.length} fantasmas borrados`);
  }

  // 5) Borrar TODAS las notas restantes
  const { count: notasAntes } = await sb.from("notas").select("*", { head: true, count: "exact" });
  const { error: eN } = await sb.from("notas").delete().not("id", "is", null);
  if (eN) { console.error("✗ borrado notas:", eN.message); process.exit(1); }
  console.log(`✓ ${notasAntes ?? 0} notas borradas`);

  // 6) Resetear contactos a pendiente
  const { error: eC, count } = await sb.from("contactos")
    .update({ estado: "pendiente", representante_id: null }, { count: "exact" })
    .not("id", "is", null);
  if (eC) { console.error("✗ reset contactos:", eC.message); process.exit(1); }
  console.log(`✓ ${count ?? 0} contactos reseteados a 'pendiente'`);

  // 7) Reporte final
  const { count: totP } = await sb.from("participantes").select("*", { head: true, count: "exact" });
  const { count: totC } = await sb.from("contactos").select("*", { head: true, count: "exact" });
  const { count: totN } = await sb.from("notas").select("*", { head: true, count: "exact" });
  console.log(`\n=== ESTADO FINAL ===`);
  console.log(`Participantes: ${totP}`);
  console.log(`Contactos:     ${totC} (todos pendientes)`);
  console.log(`Notas:         ${totN}`);
})().catch(e => { console.error(e); process.exit(1); });
