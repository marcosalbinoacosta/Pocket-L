/**
 * Limpia data sucia, agrega Argentina y resuelve los pais_id huérfanos.
 *
 * - borra participantes con nombres tipo "TOTAL ..." y/o pais_label numérico
 * - inserta Argentina con datos confirmados públicos (resto null + flag)
 * - mapea pais_label → pais.id usando una tabla de aliases para Congo, Togo,
 *   Canadá, Reino Unido
 *
 * Uso: npm run fix:orphans
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error("Falta env"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// pais_label que aparece en el Excel "Inscriptos" → id en la tabla paises (slug)
const ALIASES: Record<string, string> = {
  "Congo (Brazzaville)": "congo",
  "Togo": "republica-togolesa",
  "Canadá": "quebec-canada",
  "Canada": "quebec-canada",
  "Reino Unido (UK)": "londres",
  "Reino Unido": "londres"
};

(async () => {
  // 1) borrar basura: pais_label numérico (filas de subtotales)
  const { data: basura } = await sb.from("participantes").select("id,nombre_completo,pais_label");
  const ids: string[] = [];
  for (const p of basura ?? []) {
    const lbl = (p as any).pais_label ?? "";
    if (/^\d+(\.\d+)?$/.test(String(lbl).trim())) ids.push((p as any).id);
  }
  if (ids.length) {
    const { error } = await sb.from("participantes").delete().in("id", ids);
    console.log(`✓ borrados ${ids.length} participantes con pais_label numérico${error ? " (error: "+error.message+")" : ""}`);
  } else {
    console.log("✓ sin basura para borrar");
  }

  // 2) Argentina con datos públicos confirmados; lo demás queda null
  const argentina = {
    id: "argentina",
    nombre: "Argentina",
    continente: "America",
    idioma_oficial: "Espanol",
    organizacion_notarial: "Consejo Federal del Notariado Argentino",
    miembro_desde: 1948,                      // miembro fundador UINL
    cantidad_habitantes: 47000000,            // ~47M
    cantidad_notarios: null,                  // por confirmar
    consumo_anual: null,                      // por confirmar
    foja_tipo: null,
    impresor_fojas: null,
    caracteristicas_tecnicas: null,
    consejo_emisor_fojas: null,
    notas_comerciales: "Datos por confirmar — completar consumo, cantidad de notarios y características técnicas antes del congreso."
  };
  const { error: e1 } = await sb.from("paises").upsert(argentina, { onConflict: "id" });
  console.log(e1 ? `✗ Argentina: ${e1.message}` : "✓ Argentina insertada/actualizada");

  // 3) resolver aliases: actualizar pais_id donde pais_label coincide
  for (const [label, paisId] of Object.entries(ALIASES)) {
    const { error, count } = await sb
      .from("participantes")
      .update({ pais_id: paisId }, { count: "exact" })
      .eq("pais_label", label)
      .is("pais_id", null);
    console.log(`  ${label.padEnd(28)} → ${paisId.padEnd(22)} ${count ?? 0} actualizados${error ? " err: "+error.message : ""}`);
  }

  // 4) match de Argentina (no es alias, label = id slug coincide directo)
  const { count: cArg } = await sb
    .from("participantes")
    .update({ pais_id: "argentina" }, { count: "exact" })
    .eq("pais_label", "Argentina")
    .is("pais_id", null);
  console.log(`  Argentina                    → argentina              ${cArg ?? 0} actualizados`);

  // 5) reporte final
  const { count: huer } = await sb.from("participantes").select("*", { head: true, count: "exact" }).is("pais_id", null);
  const { count: tot } = await sb.from("participantes").select("*", { head: true, count: "exact" });
  console.log(`\n✓ Listo · ${tot} participantes · ${huer} aún sin país enriquecido (esperable: Camboya y similares no agregados)`);
})();
