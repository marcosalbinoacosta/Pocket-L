/**
 * Importa los Excel a Supabase.
 *
 * Uso:
 *   1. Crear .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *   2. Pegar scripts/schema.sql (+ patch 013) en Supabase SQL Editor
 *   3. npm run import
 *      -- o, para otra planilla --
 *      npx tsx scripts/import-excel.ts --file="ruta.xlsx" --hoja="Hoja1"
 *
 * Lee:
 *   - "Listados de participantes y autoridades v5. FINAL.xlsx" (default)
 *      hoja de inscriptos → tabla participantes (+ participaciones)
 *   - "CUADRO INFO RESUMEN.xlsx"
 *      hoja "Hoja1" → tabla paises (datos comerciales por país)
 *
 * Base única: la UINL es un solo evento que va rotando de país, así que todos
 * los contactos viven juntos y el estado y las notas de cada persona se
 * arrastran de un congreso al siguiente. Por eso el upsert es por nombre.
 * Para nombres *parecidos* pero no idénticos (tildes, prefijos "Lic./Not./Pte.",
 * ver Patch 013) se imprime un aviso para revisión manual; no se fusiona solo.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { slug, normalizarNombrePersona } from "../lib/utils";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ---------- Args ----------
function argVal(name: string, def: string): string {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
}

const ROOT = process.cwd();
const F_PARTICIPANTES = argVal("file", path.join(ROOT, "..", "Listados de participantes y autoridades v5. FINAL.xlsx"));
const F_PAISES        = path.join(ROOT, "CUADRO INFO RESUMEN.xlsx");
const SHEET_PARTICIPANTES = argVal("hoja", "Inscriptos 30-4. Sin duplicados");

const dedupeWarnings: { nombre: string; candidatos: { nombre_completo: string; pais_label: string | null; organizacion: string | null; similitud: number }[] }[] = [];

// ---------- Mapeos ----------
// columnas del Excel -> código de comisión en DB
const COL_TO_COMISION: Record<string, string> = {
  "Asamblea": "ASAMBLEA",
  "Presidente": "PRESIDENCIA",
  "Consejo de Dirección": "CD",
  "Consejo General": "CG",
  "Consejo Vigilancia Financiera": "CVF",
  "CAAf": "CAAf",
  "CAAm": "CAAm",
  "CAAs": "CAAs",
  "CAE": "CAE",
  "CCNI": "CCNI",
  "CC": "CC",
  "CSSN": "CSSN",
  "CTC": "CTC",
  "CDH": "CDH",
  "CDN": "CDN",
  "GTOrg Int.": "GT_OI",
  "GT Digitalizac": "GT_DIG",
  "GT Blanqueo": "GT_BLA",
  "GT Igualdad G": "GT_IG"
};

// pesos para prioridad_score (0-100)
const PESO_CARGO: Record<string, number> = {
  "Presidente": 40, "Presidenta": 40,
  "Vicepresidente": 25, "Vicepresidenta": 25,
  "Secretario": 15, "Secretaria": 15,
  "Tesorero": 12, "Tesorera": 12,
  "Responsable": 30,
  "Miembro": 5
};

function detectaCargo(valor: string): string | null {
  if (!valor) return null;
  const v = valor.trim();
  for (const k of Object.keys(PESO_CARGO)) if (v.toLowerCase().startsWith(k.toLowerCase())) return k;
  if (/^miembro/i.test(v)) return "Miembro";
  return "Miembro";
}

function calcPrioridad(participaciones: { cargo: string | null }[]): number {
  let s = 0;
  for (const p of participaciones) {
    const peso = p.cargo ? (PESO_CARGO[p.cargo] ?? 5) : 5;
    s += peso;
  }
  return Math.min(100, s);
}

function cargoPrincipal(participaciones: { cargo: string | null; comision_codigo: string }[]): string | null {
  if (participaciones.length === 0) return null;
  // ordenar por peso descendente y devolver "Cargo Comisión"
  const ord = [...participaciones].sort((a, b) => (PESO_CARGO[b.cargo ?? "Miembro"] ?? 5) - (PESO_CARGO[a.cargo ?? "Miembro"] ?? 5));
  const top = ord[0];
  return `${top.cargo ?? "Miembro"} ${top.comision_codigo}`;
}

function normContinente(c: string | null | undefined): string | null {
  if (!c) return null;
  // strip acentos antes del prefix-check: "África" -> "africa" para que matchee "afr"
  const x = c.toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (x.startsWith("afr")) return "Africa";
  if (x.startsWith("am"))  return "America";
  if (x.startsWith("as"))  return "Asia";
  if (x.startsWith("eu"))  return "Europa";
  if (x.startsWith("oc"))  return "Oceania";
  return c.toString().trim();
}

// ---------- Importar países ----------
async function importPaises() {
  console.log("\n→ Países (CUADRO INFO RESUMEN)");
  const wb = XLSX.readFile(F_PAISES);
  const ws = wb.Sheets["Hoja1"];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  const paises = rows
    .filter(r => r["PAIS"])
    .map(r => ({
      id: slug(String(r["PAIS"])),
      nombre: String(r["PAIS"]).trim(),
      continente: normContinente(r["CONTINENTE"]),
      idioma_oficial: r["IDIOMA OFICIAL"]?.toString().trim() || null,
      organizacion_notarial: r["NOMBRE INSTITUCIONAL"]?.toString().trim() || null,
      miembro_desde: typeof r["MIEMBRO DESDE"] === "number" ? r["MIEMBRO DESDE"] : null,
      cantidad_notarios: typeof r["CANTIDAD DE NOTARIOS"] === "number" ? r["CANTIDAD DE NOTARIOS"] : null,
      cantidad_habitantes: typeof r["CANTIDAD DE HABITANTES"] === "number" ? r["CANTIDAD DE HABITANTES"] : null,
      consumo_anual: typeof r["CONSUMO"] === "number" ? r["CONSUMO"] : null,
      foja_tipo: r["FOJA FISICA O DIGITAL "]?.toString().trim() || null,
      impresor_fojas: r["IMPRESOR DE FOJAS"]?.toString().trim() || null,
      caracteristicas_tecnicas: r["CARACTERISTICAS TECNICAS"]?.toString().trim() || null,
      consejo_emisor_fojas: r["CONSEJO EMISOR DE FOJAS"] ? String(r["CONSEJO EMISOR DE FOJAS"]).trim().toUpperCase().startsWith("SI") : null
    }));

  // upsert en chunks
  for (let i = 0; i < paises.length; i += 100) {
    const chunk = paises.slice(i, i + 100);
    const { error } = await sb.from("paises").upsert(chunk, { onConflict: "id" });
    if (error) { console.error(error); process.exit(1); }
  }
  console.log(`   ✓ ${paises.length} países`);
}

// ---------- Importar participantes ----------
async function importParticipantes() {
  console.log("\n→ Participantes (FINAL v5)");
  const wb = XLSX.readFile(F_PARTICIPANTES);
  const ws = wb.Sheets[SHEET_PARTICIPANTES];
  if (!ws) throw new Error(`No se encontró la hoja '${SHEET_PARTICIPANTES}'`);
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  // ya cargados los países: traer su {nombre→id} para FK + continente para fallback
  const { data: paisesDb } = await sb.from("paises").select("id,nombre,continente");
  const nombreToId = new Map((paisesDb ?? []).map(p => [p.nombre.toLowerCase(), p.id]));
  const idToContinente = new Map((paisesDb ?? []).map(p => [p.id, p.continente]));

  // aliases conocidos: pais_label del Excel "Inscriptos" → id en paises
  const ALIASES: Record<string, string> = {
    "congo (brazzaville)": "congo",
    "togo": "republica-togolesa",
    "canadá": "quebec-canada",
    "canada": "quebec-canada",
    "reino unido (uk)": "londres",
    "reino unido": "londres"
  };

  const tryFK = (label: string | null): string | null => {
    if (!label) return null;
    const k = label.trim().toLowerCase();
    if (ALIASES[k]) return ALIASES[k];
    if (nombreToId.has(k)) return nombreToId.get(k)!;
    const noAccents = k.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const [n, id] of nombreToId) {
      const nn = n.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (nn === noAccents) return id;
    }
    return null;
  };

  let ok = 0, sinFK = 0, skipped = 0, avisos = 0;
  for (const row of rows) {
    if (!row["Delegado"]) continue;
    const nombre = String(row["Delegado"]).trim();
    // descartar filas de subtotales del Excel (TOTAL, TOTAL SIN CARGO, etc.)
    if (/^total\b/i.test(nombre)) { skipped++; continue; }
    const paisLabel = row["País"]?.toString().trim() || null;
    const paisId = tryFK(paisLabel);
    if (!paisId && paisLabel) sinFK++;

    // dedupe: candidatos parecidos que el upsert por nombre_completo exacto
    // NO va a matchear (nombre distinto) — se avisan, no se fusionan solos.
    const nombreNorm = normalizarNombrePersona(nombre);
    const { data: similares } = await sb.rpc("buscar_participante_similar", {
      p_nombre: nombreNorm, p_pais_id: paisId, p_umbral: 0.5
    });
    const candidatosReales = (similares ?? []).filter(
      (s: any) => s.nombre_completo.trim().toLowerCase() !== nombre.trim().toLowerCase()
    );
    if (candidatosReales.length) {
      avisos++;
      dedupeWarnings.push({ nombre, candidatos: candidatosReales });
    }

    // armar participaciones a partir de columnas
    const parts: { comision_codigo: string; cargo: string | null }[] = [];
    for (const [col, codigo] of Object.entries(COL_TO_COMISION)) {
      const val = row[col];
      if (val) parts.push({ comision_codigo: codigo, cargo: detectaCargo(String(val)) });
    }

    const score = calcPrioridad(parts);
    const cargo = cargoPrincipal(parts);
    const rolesRaw = row["Miembro de:"]?.toString().trim() || null;

    // upsert participante por (nombre + país) — no hay id estable en el Excel
    // El continente del pais es la fuente de verdad; el del Excel solo se
    // usa como fallback cuando no hay pais matcheado (evita typos como
    // "Wolfgang OTT / Alemania / America").
    const continenteDePais = paisId ? (idToContinente.get(paisId) ?? null) : null;
    const continenteFinal = continenteDePais ?? normContinente(row["Continente"]);
    const { data: ins, error } = await sb.from("participantes")
      .upsert({
        nombre_completo: nombre,
        pais_id: paisId,
        pais_label: paisLabel,
        continente: continenteFinal,
        email: row["Email"]?.toString().trim() || null,
        telefono: row["Teléfono"]?.toString().trim() || null,
        organizacion: null, // no viene en el Excel; se puede enriquecer luego desde paises.organizacion_notarial
        cargo_principal: cargo,
        roles_raw: rolesRaw,
        prioridad_score: score
      }, { onConflict: "nombre_completo", ignoreDuplicates: false })
      .select("id")
      .single();

    if (error) { console.error("  ✗", nombre, error.message); continue; }

    // limpiar y reinsertar participaciones
    await sb.from("participaciones").delete().eq("participante_id", ins!.id);
    if (parts.length) {
      const { error: e2 } = await sb.from("participaciones").insert(
        parts.map(p => ({ participante_id: ins!.id, ...p }))
      );
      if (e2) console.error("  ✗ part", nombre, e2.message);
    }

    ok++;
  }
  console.log(`   ✓ ${ok} participantes${sinFK ? `  (${sinFK} con país sin match)` : ""}${skipped ? `  · ${skipped} filas de totales descartadas` : ""}${avisos ? `  · ${avisos} avisos de posible duplicado (ver reporte)` : ""}`);
}

function guardarReporteDedupe() {
  if (!dedupeWarnings.length) return;
  const file = path.join(ROOT, "scripts", "dedupe-report.json");
  fs.writeFileSync(file, JSON.stringify(dedupeWarnings, null, 2), "utf-8");
  console.log(`\n⚠ ${dedupeWarnings.length} posibles duplicados para revisar manualmente → ${path.relative(ROOT, file)}`);
  for (const w of dedupeWarnings.slice(0, 10)) {
    const top = w.candidatos[0];
    console.log(`   "${w.nombre}" ~ "${top.nombre_completo}" (${(top.similitud * 100).toFixed(0)}%${top.pais_label ? `, ${top.pais_label}` : ""})`);
  }
  if (dedupeWarnings.length > 10) console.log(`   … y ${dedupeWarnings.length - 10} más en el archivo.`);
}

(async () => {
  await importPaises();
  await importParticipantes();
  guardarReporteDedupe();
  console.log("\n✓ Listo");
})().catch(e => { console.error(e); process.exit(1); });
