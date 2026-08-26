/**
 * Baja todas las prioridades y deja marcado solo México.
 *
 * Dos ejes independientes, los dos se tocan acá:
 *   1. contactos.alta_prioridad (la ★)  -> false fuera de México, true en México.
 *   2. participantes.prioridad_score    -> 0 fuera de México. En México solo se
 *      completan los que nunca tuvieron score (0), con 40; los ya calculados por
 *      cargo no se tocan, para no aplastar el orden interno del país.
 *
 * México se identifica por pais_id = 'mexico' o por pais_label ("México" / "Mexico"),
 * porque hay filas viejas sin pais_id que solo traen la etiqueta.
 *
 * Uso (desde APP pocket/):
 *   npx tsx scripts/reset-prioridades-mexico.ts            # dry-run, no escribe nada
 *   npx tsx scripts/reset-prioridades-mexico.ts --apply     # ejecuta
 *
 * Conviene correr antes:  npx tsx scripts/backup-snapshot.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const APPLY = process.argv.includes("--apply");
const ES_MEXICO = /^m[eé]xico$/i;
const SCORE_MEXICO = 40; // mismo score con el que entraron los notarios del PPT
const CHUNK = 200; // el .in() de PostgREST se come la URL si le mandás 400 uuid de una

const enTandas = <T,>(xs: T[], n = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

async function main() {
  const { data: participantes, error: eP } = await sb
    .from("participantes")
    .select("id,nombre_completo,pais_id,pais_label,prioridad_score")
    .limit(5000);
  if (eP) throw new Error(`participantes: ${eP.message}`);

  const esMexicano = (p: any) =>
    p.pais_id === "mexico" || ES_MEXICO.test(String(p.pais_label ?? "").trim());

  const mexicanos = (participantes ?? []).filter(esMexicano);
  const resto     = (participantes ?? []).filter(p => !esMexicano(p));
  const idsMex    = new Set(mexicanos.map((p: any) => p.id));

  const { data: contactos, error: eC } = await sb
    .from("contactos")
    .select("id,participante_id,alta_prioridad")
    .limit(5000);
  if (eC) throw new Error(`contactos: ${eC.message}`);

  const apagar    = (contactos ?? []).filter((c: any) => c.alta_prioridad === true && !idsMex.has(c.participante_id));
  const encender  = (contactos ?? []).filter((c: any) => c.alta_prioridad !== true && idsMex.has(c.participante_id));
  const conContacto = new Set((contactos ?? []).map((c: any) => c.participante_id));
  const sinContacto = mexicanos.filter((p: any) => !conContacto.has(p.id));
  const bajarScore  = resto.filter((p: any) => (p.prioridad_score ?? 0) > 0);
  const sinScore    = mexicanos.filter((p: any) => (p.prioridad_score ?? 0) === 0);

  console.log(APPLY ? "MODO: aplicar\n" : "MODO: dry-run (no se escribe nada)\n");
  console.log(`participantes: ${participantes?.length}  (México: ${mexicanos.length} / resto: ${resto.length})`);
  console.log(`★ apagar fuera de México ......... ${apagar.length}`);
  console.log(`★ encender en México ............. ${encender.length}`);
  console.log(`contactos a crear (México sin fila) ${sinContacto.length}`);
  console.log(`prioridad_score → 0 fuera de México ${bajarScore.length}`);
  console.log(`prioridad_score → ${SCORE_MEXICO} en México sin score ${sinScore.length}`);

  if (!APPLY) {
    console.log("\nMuestra de ★ que se apagan:");
    for (const c of apagar.slice(0, 5)) {
      const p: any = (participantes ?? []).find((x: any) => x.id === c.participante_id);
      console.log(`  - ${p?.nombre_completo} (${p?.pais_label})`);
    }
    console.log("\nVolvé a correr con --apply para ejecutar.");
    return;
  }

  for (const tanda of enTandas(apagar.map((c: any) => c.id))) {
    const { error } = await sb.from("contactos").update({ alta_prioridad: false }).in("id", tanda);
    if (error) throw new Error(`apagar ★: ${error.message}`);
  }
  console.log(`✓ ${apagar.length} ★ apagadas`);

  for (const tanda of enTandas(encender.map((c: any) => c.id))) {
    const { error } = await sb.from("contactos").update({ alta_prioridad: true }).in("id", tanda);
    if (error) throw new Error(`encender ★: ${error.message}`);
  }
  console.log(`✓ ${encender.length} ★ encendidas en México`);

  if (sinContacto.length) {
    const { error } = await sb
      .from("contactos")
      .insert(sinContacto.map((p: any) => ({ participante_id: p.id, alta_prioridad: true })));
    if (error) throw new Error(`crear contactos: ${error.message}`);
    console.log(`✓ ${sinContacto.length} contactos creados para México`);
  }

  for (const tanda of enTandas(bajarScore.map((p: any) => p.id))) {
    const { error } = await sb.from("participantes").update({ prioridad_score: 0 }).in("id", tanda);
    if (error) throw new Error(`bajar score: ${error.message}`);
  }
  console.log(`✓ ${bajarScore.length} prioridad_score puestos en 0`);

  for (const tanda of enTandas(sinScore.map((p: any) => p.id))) {
    const { error } = await sb.from("participantes").update({ prioridad_score: SCORE_MEXICO }).in("id", tanda);
    if (error) throw new Error(`score México: ${error.message}`);
  }
  console.log(`✓ ${sinScore.length} participantes de México sin score puestos en ${SCORE_MEXICO}`);
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });
