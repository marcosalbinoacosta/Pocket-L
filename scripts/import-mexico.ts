/**
 * Importa la investigación de México a `organizaciones` (patch_012).
 *
 * México es un país federal: 32 colegios estatales + el Colegio Nacional del
 * Notariado Mexicano A.C. (coordina, no compra fojas — cada colegio estatal
 * compra por su cuenta, ver slide 44 del PPT). Por eso no entra como una
 * fila más en `paises` con cantidad_notarios/consumo_anual: esos campos
 * quedan en null ahí y el detalle real vive acá, en `organizaciones`.
 *
 * Fuente: "CUADRO ANALISIS MEXICO.xlsx" (hoja1), ya corregido contra el PPT
 * "Presentación Investigacion UINL Mexico.pptx" (ver diffs: Nuevo León
 * autoridad, Estado de México cantidad de notarios).
 *
 * Uso:
 *   1. Correr patch_011_eventos.sql, patch_012_organizaciones.sql y
 *      patch_013_dedupe_participantes.sql en Supabase (en ese orden).
 *   2. npx tsx scripts/import-mexico.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import * as XLSX from "xlsx";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { slug } from "../lib/utils";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const ROOT = process.cwd();
const F_MEXICO = path.join(ROOT, "CUADRO ANALISIS MEXICO.xlsx");

// columnas por posición (los headers del xlsx traen espacios sueltos: " EMISOR DE FOJAS", etc.)
const COL = {
  COLEGIO: 0, PRESIDENTE: 1, EMISOR_FOJAS: 2, NOTARIOS: 3,
  FOJA_TIPO: 4, IMPRESOR: 5, CONSUMO: 6, TECNICAS: 7
} as const;

/** "Colegio de Notarios Públicos del Estado de Aguascalientes " -> "Aguascalientes" */
function extraerSubdivision(nombreColegio: string): string {
  let s = nombreColegio.trim();
  if (/ciudad de m[eé]xico/i.test(s)) return "Ciudad de México";
  // "Colegio de Notarios del Estado de México" -> subdivisión "Estado de México",
  // no solo "México" (se confundiría con el país en listados/slugs)
  if (/estado de m[eé]xico/i.test(s)) return "Estado de México";
  s = s.replace(/^colegio\s+de\s+notarios\s+p[uú]blicos?\s+/i, "");
  s = s.replace(/^colegio\s+de\s+notarios\s+/i, "");
  s = s.replace(/^consejo\s+de\s+notarios\s+/i, "");
  s = s.replace(/^(del|para el)\s+estado\s+de\s+/i, "");
  s = s.replace(/^estado\s+de\s+/i, "");
  s = s.replace(/^de\s+/i, "");
  return s.trim();
}

async function ensurePaisMexico() {
  const { error } = await sb.from("paises").upsert({
    id: "mexico",
    nombre: "México",
    continente: "America",
    idioma_oficial: "Español",
    organizacion_notarial: "Colegio Nacional del Notariado Mexicano, A.C.",
    miembro_desde: 1948
    // cantidad_notarios / consumo_anual: null a propósito, el detalle vive en `organizaciones`
  }, { onConflict: "id" });
  if (error) { console.error(error); process.exit(1); }
}

async function importOrganizaciones() {
  console.log("→ Organizaciones (CUADRO ANALISIS MEXICO)");
  const wb = XLSX.readFile(F_MEXICO);
  const ws = wb.Sheets["Hoja1"];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, range: 1 }); // range:1 salta el header

  const orgs = rows
    .filter(r => r[COL.COLEGIO])
    .map(r => {
      const nombre = String(r[COL.COLEGIO]).trim();
      const subdivision = extraerSubdivision(nombre);
      return {
        id: slug(`mexico-${subdivision}`),
        pais_id: "mexico",
        nombre,
        subdivision,
        tipo: "colegio_estatal" as const,
        autoridad: r[COL.PRESIDENTE]?.toString().trim() || null,
        cantidad_notarios: typeof r[COL.NOTARIOS] === "number" ? r[COL.NOTARIOS] : null,
        consumo_anual: typeof r[COL.CONSUMO] === "number" ? r[COL.CONSUMO] : null,
        foja_tipo: r[COL.FOJA_TIPO]?.toString().trim() || null,
        emisor_fojas: r[COL.EMISOR_FOJAS] ? String(r[COL.EMISOR_FOJAS]).trim().toUpperCase().startsWith("SI") : null,
        impresor_fojas: r[COL.IMPRESOR]?.toString().trim() || null,
        notas_comerciales: r[COL.TECNICAS]?.toString().trim() || null
      };
    });

  // Colegio Nacional del Notariado Mexicano A.C. — coordina, no compra fojas
  // directamente (cada colegio estatal compra por su cuenta). No se suma al
  // consumo total: por eso tipo='consejo_nacional' (la vista v_paises_con_organizaciones
  // solo agrega tipo='colegio_estatal').
  orgs.push({
    id: "mexico-cnnm",
    pais_id: "mexico",
    nombre: "Colegio Nacional del Notariado Mexicano, A.C.",
    subdivision: null,
    tipo: "consejo_nacional" as any,
    autoridad: "Pta. Guadalupe Díaz Carranza",
    cantidad_notarios: 4500,
    consumo_anual: null,
    foja_tipo: "Hibrido predominantemente físico",
    emisor_fojas: false,
    impresor_fojas: null,
    notas_comerciales: "Coordina a nivel federal los 32 colegios estatales; cada colegio compra sus insumos de forma independiente. 4.500 notarios y ~35.000.000 fojas/año es el agregado nacional, no compra propia."
  } as any);

  for (let i = 0; i < orgs.length; i += 100) {
    const chunk = orgs.slice(i, i + 100);
    const { error } = await sb.from("organizaciones").upsert(chunk, { onConflict: "id" });
    if (error) { console.error(error); process.exit(1); }
  }
  console.log(`   ✓ ${orgs.length} organizaciones (${orgs.length - 1} colegios estatales + Colegio Nacional)`);
}

(async () => {
  await ensurePaisMexico();
  await importOrganizaciones();
  console.log("\n✓ Listo — México cargado en `organizaciones`. Falta el listado de participantes/inscriptos de México cuando exista (ver import-excel.ts --evento mexico-2026).");
})().catch(e => { console.error(e); process.exit(1); });
