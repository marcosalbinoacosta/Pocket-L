/**
 * Diagnostico: compara continente del Excel FINAL vs DB.
 * Uso: npx tsx scripts/diag-continente.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import * as XLSX from "xlsx";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const F = path.join(process.cwd(), "..", "Listados de participantes y autoridades v5. FINAL.xlsx");
const SHEET = "Inscriptos 30-4. Sin duplicados";

function norm(c: string | null | undefined): string | null {
  if (!c) return null;
  const x = c.toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (x.startsWith("afr")) return "Africa";
  if (x.startsWith("am"))  return "America";
  if (x.startsWith("as"))  return "Asia";
  if (x.startsWith("eu"))  return "Europa";
  if (x.startsWith("oc"))  return "Oceania";
  return c.toString().trim();
}

(async () => {
  // Excel
  const wb = XLSX.readFile(F);
  const ws = wb.Sheets[SHEET];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const excel: Record<string, { continente: string | null; pais: string | null }> = {};
  for (const r of rows) {
    const n = r["Delegado"]?.toString().trim();
    if (!n) continue;
    if (/^total\b/i.test(n)) continue;
    excel[n] = {
      continente: norm(r["Continente"]),
      pais: r["País"]?.toString().trim() ?? null
    };
  }

  // DB
  const { data: db } = await sb.from("participantes")
    .select("nombre_completo,continente,pais_label,pais_id,pais:paises(nombre,continente)");
  const dbMap: Record<string, any> = {};
  for (const r of db ?? []) dbMap[(r as any).nombre_completo] = r;

  // Diff
  const mismatches: any[] = [];
  const soloDb: string[] = [];
  for (const [n, e] of Object.entries(excel)) {
    const d = dbMap[n];
    if (!d) { soloDb.push(n); continue; }
    if (e.continente !== d.continente) {
      const paisCont = (Array.isArray(d.pais) ? d.pais[0]?.continente : d.pais?.continente) ?? null;
      mismatches.push({
        nombre: n,
        excel_continente: e.continente,
        db_continente: d.continente,
        pais_label: d.pais_label,
        pais_normalized: (Array.isArray(d.pais) ? d.pais[0]?.nombre : d.pais?.nombre) ?? null,
        pais_continente: paisCont
      });
    }
  }

  // Sumarios
  const sumExcel: Record<string, number> = {};
  for (const e of Object.values(excel)) {
    const k = e.continente ?? "(vacio)";
    sumExcel[k] = (sumExcel[k] ?? 0) + 1;
  }
  const sumDb: Record<string, number> = {};
  for (const d of Object.values(dbMap)) {
    const k = (d as any).continente ?? "(null)";
    sumDb[k] = (sumDb[k] ?? 0) + 1;
  }
  console.log("EXCEL:", sumExcel);
  console.log("DB   :", sumDb);

  // Resumen: paises agrupados por su continente actual en DB
  const porPaisCont: Record<string, Set<string>> = {};
  const cntPorPais: Record<string, number> = {};
  for (const d of Object.values(dbMap)) {
    const dd = d as any;
    const cont = dd.continente ?? "(null)";
    const pais = dd.pais_label ?? "(sin pais)";
    porPaisCont[cont] ??= new Set();
    porPaisCont[cont].add(pais);
    const key = `${cont}|${pais}`;
    cntPorPais[key] = (cntPorPais[key] ?? 0) + 1;
  }
  for (const cont of Object.keys(porPaisCont).sort()) {
    console.log(`\n=== ${cont} ===`);
    const ps = Array.from(porPaisCont[cont]).sort();
    for (const p of ps) {
      console.log(`  ${p.padEnd(35)} ${cntPorPais[`${cont}|${p}`]}`);
    }
  }
})();
