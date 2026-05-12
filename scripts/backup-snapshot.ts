/**
 * Snapshot READ-ONLY de las tablas críticas a JSON.
 *
 * - Solo ejecuta SELECT. No modifica ni borra nada en la DB.
 * - Crea una carpeta por ejecución: backups/YYYY-MM-DD_HH-MM-SS/
 * - Un archivo JSON por tabla + un _manifest.json con el resumen.
 * - Paginado de a 1000 filas para no tocar el límite de PostgREST.
 *
 * Uso (desde APP pocket/):
 *   npx tsx scripts/backup-snapshot.ts
 *
 * Restaurar (manual, eventual):
 *   los JSON se pueden re-insertar con un script inverso. El schema vive
 *   en scripts/schema.sql y los patches en scripts/patch_*.sql.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Tablas a respaldar, en orden de menor a mayor dependencia (FK).
// Si alguna no existe en la DB, se loguea como error pero no aborta el resto.
const TABLAS = [
  "paises",
  "comisiones",
  "representantes",
  "participantes",
  "participaciones",
  "contactos",
  "notas",
];

const PAGE = 1000;

function stampAhora(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function dumpTabla(nombre: string, outDir: string): Promise<{ tabla: string; filas: number; bytes: number }> {
  const filas: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(nombre).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    filas.push(...data);
    if (data.length < PAGE) break;
  }
  const archivo = path.join(outDir, `${nombre}.json`);
  const json = JSON.stringify(filas, null, 2);
  fs.writeFileSync(archivo, json, "utf8");
  return { tabla: nombre, filas: filas.length, bytes: Buffer.byteLength(json, "utf8") };
}

(async () => {
  const stamp = stampAhora();
  const outDir = path.join(process.cwd(), "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`→ Snapshot a: ${outDir}\n`);

  const reporte: any[] = [];
  let totalFilas = 0;
  let totalBytes = 0;
  let huboError = false;

  for (const t of TABLAS) {
    try {
      const r = await dumpTabla(t, outDir);
      reporte.push(r);
      totalFilas += r.filas;
      totalBytes += r.bytes;
      const kb = (r.bytes / 1024).toFixed(1);
      console.log(`  ✓ ${t.padEnd(18)} ${String(r.filas).padStart(6)} filas   ${kb.padStart(8)} KB`);
    } catch (e: any) {
      huboError = true;
      reporte.push({ tabla: t, error: e.message });
      console.error(`  ✗ ${t.padEnd(18)} ERROR: ${e.message}`);
    }
  }

  const manifest = {
    timestamp: stamp,
    supabase_url: URL,
    tablas: reporte,
    total_filas: totalFilas,
    total_bytes: totalBytes,
  };
  fs.writeFileSync(path.join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  const totalKb = (totalBytes / 1024).toFixed(1);
  console.log(`\n  Total: ${totalFilas} filas · ${totalKb} KB`);
  console.log(`  Manifest: ${path.join(outDir, "_manifest.json")}`);
  if (huboError) {
    console.error("\n✗ Hubo errores en al menos una tabla. Revisar arriba.");
    process.exit(2);
  }
  console.log("\n✓ Snapshot completo.");
})().catch((e) => {
  console.error("✗ Fallo general:", e);
  process.exit(1);
});
