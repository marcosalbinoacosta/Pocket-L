/**
 * Verificación cruzada de los datos de México: Excel → base de datos.
 *
 * Chequea que lo que está cargado en la app coincida con la fuente, incluyendo
 * que cada foto haya quedado en la persona correcta (es el error más caro de
 * todos: una cara equivocada en una ficha se descubre recién frente al notario).
 *
 * Solo lee. No modifica nada.
 *
 * Uso:  npx tsx scripts/verificar-mexico.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { normalizarNombrePersona, quitarAcentos, slug } from "../lib/utils";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const ROOT = process.cwd();
const COL = { COLEGIO: 0, PRESIDENTE: 1, NOTARIOS: 3, CONSUMO: 6 } as const;

function subdivision(nombreColegio: string): string {
  let s = nombreColegio.trim();
  if (/ciudad de m[eé]xico/i.test(s)) return "Ciudad de México";
  if (/estado de m[eé]xico/i.test(s)) return "Estado de México";
  s = s.replace(/^colegio\s+de\s+notarios\s+p[uú]blicos?\s+/i, "");
  s = s.replace(/^colegio\s+de\s+notarios\s+/i, "");
  s = s.replace(/^consejo\s+de\s+notarios\s+/i, "");
  s = s.replace(/^(del|para el)\s+estado\s+de\s+/i, "");
  s = s.replace(/^estado\s+de\s+/i, "");
  s = s.replace(/^de\s+/i, "");
  return s.trim();
}

const norm = (s: string | null) => quitarAcentos((s ?? "").trim()).toLowerCase().replace(/\s+/g, " ");
// El PPT escribe "Estado Aguas Calientes" y el Excel "Aguascalientes": para
// comparar subdivisiones entre las dos fuentes hay que ignorar ese espacio.
const normSub = (s: string | null) => norm(s).replace(/\s/g, "");
let fallos = 0;
const fail = (msg: string) => { console.log("  ✗ " + msg); fallos++; };

(async () => {
  const wb = XLSX.readFile(path.join(ROOT, "CUADRO ANALISIS MEXICO.xlsx"));
  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["Hoja1"], { header: 1, defval: null, range: 1 });
  const excel = rows.filter((r) => r[COL.COLEGIO] && r[COL.PRESIDENTE]);

  const mapaFotos = JSON.parse(
    fs.readFileSync(path.join(ROOT, "scripts", "fotos_mexico", "_mapa.json"), "utf-8")
  ) as { subdivision: string; archivo: string | null }[];

  // ---------------------------------------------------------------- COLEGIOS
  console.log(`\n1 · ORGANIZACIONES (colegios) — Excel tiene ${excel.length} filas`);
  const { data: orgs } = await sb.from("organizaciones").select("*").eq("pais_id", "mexico");
  const estatales = (orgs ?? []).filter((o) => o.tipo === "colegio_estatal");
  if (estatales.length !== excel.length) fail(`en la base hay ${estatales.length} colegios estatales y en el Excel ${excel.length}`);

  for (const r of excel) {
    const colegio = String(r[COL.COLEGIO]).trim();
    const sub = subdivision(colegio);
    const o = estatales.find((x) => norm(x.subdivision) === norm(sub));
    if (!o) { fail(`falta el colegio "${sub}" en organizaciones`); continue; }
    if (norm(o.nombre) !== norm(colegio)) fail(`${sub}: nombre "${o.nombre}" ≠ Excel "${colegio}"`);
    if (o.cantidad_notarios !== r[COL.NOTARIOS]) fail(`${sub}: notarios ${o.cantidad_notarios} ≠ Excel ${r[COL.NOTARIOS]}`);
    if (Number(o.consumo_anual) !== r[COL.CONSUMO]) fail(`${sub}: consumo ${o.consumo_anual} ≠ Excel ${r[COL.CONSUMO]}`);
    if (norm(o.autoridad) !== norm(String(r[COL.PRESIDENTE]))) fail(`${sub}: autoridad "${o.autoridad}" ≠ Excel "${r[COL.PRESIDENTE]}"`);
  }
  console.log(`  ${fallos === 0 ? "✓" : "→"} ${estatales.length} colegios estatales + ${(orgs ?? []).length - estatales.length} nacional`);

  // ---------------------------------------------------------- PARTICIPANTES
  console.log(`\n2 · PARTICIPANTES (los presidentes como contacto)`);
  const { data: mx } = await sb.from("participantes")
    .select("id,nombre_completo,organizacion,cargo_principal,pais_id,pais_label,continente,foto_url,prioridad_score");
  const porNombre = new Map((mx ?? []).map((p) => [norm(normalizarNombrePersona(p.nombre_completo)), p]));

  const FUSIONES: Record<string, string> = { "jaime arturo casas madero": "jaime casas madero" };

  let conFoto = 0, sinFoto: string[] = [];
  for (const r of excel) {
    const colegio = String(r[COL.COLEGIO]).trim();
    const sub = subdivision(colegio);
    const nombre = normalizarNombrePersona(String(r[COL.PRESIDENTE]).trim());
    const clave = norm(nombre);
    const p = porNombre.get(clave) ?? (FUSIONES[clave] ? porNombre.get(FUSIONES[clave]) : undefined);

    if (!p) { fail(`${sub}: no está el participante "${nombre}"`); continue; }
    if (p.pais_id !== "mexico") fail(`${nombre}: pais_id "${p.pais_id}" ≠ mexico`);
    if (norm(p.organizacion) !== norm(colegio)) fail(`${nombre}: organizacion "${p.organizacion}" ≠ "${colegio}"`);
    if (p.cargo_principal !== "Presidente") fail(`${nombre}: cargo "${p.cargo_principal}" ≠ Presidente`);

    // Cadena de la foto: colegio → subdivisión → archivo extraído → key subida.
    // Si en algún eslabón se cruzan, la cara termina en la ficha equivocada.
    const esperada = mapaFotos.find((m) => normSub(m.subdivision) === normSub(sub));
    if (esperada?.archivo) {
      if (!p.foto_url) { fail(`${nombre} (${sub}): debería tener foto y está vacía`); continue; }
      const keyEsperada = `${slug(nombre)}.jpg`;
      if (!p.foto_url.endsWith(keyEsperada)) {
        fail(`${nombre}: la foto apunta a "${p.foto_url.split("/").pop()}" y debería ser "${keyEsperada}"`);
      } else conFoto++;
    } else {
      sinFoto.push(`${nombre} (${sub})`);
      if (p.foto_url) fail(`${nombre}: tiene foto pero el PPT no traía ninguna`);
    }
  }
  console.log(`  ✓ ${conFoto} presidentes con su foto correcta`);
  if (sinFoto.length) console.log(`  · sin foto en el PPT: ${sinFoto.join(", ")}`);

  // -------------------------------------------------------------- DUPLICADOS
  console.log(`\n3 · DUPLICADOS`);
  const vistos = new Map<string, string[]>();
  for (const p of mx ?? []) {
    const k = norm(normalizarNombrePersona(p.nombre_completo));
    vistos.set(k, [...(vistos.get(k) ?? []), p.nombre_completo]);
  }
  const dups = [...vistos.entries()].filter(([, v]) => v.length > 1);
  if (dups.length) for (const [, v] of dups) fail(`duplicado: ${v.join(" / ")}`);
  else console.log(`  ✓ ningún nombre repetido entre los ${(mx ?? []).length} participantes`);

  // ------------------------------------------------------------------- PAÍS
  console.log(`\n4 · PAÍS Y TOTALES`);
  const { data: vista } = await sb.from("v_paises_con_organizaciones").select("*").eq("id", "mexico").single();
  const sumaNotarios = excel.reduce((s, r) => s + (r[COL.NOTARIOS] ?? 0), 0);
  const sumaConsumo = excel.reduce((s, r) => s + (r[COL.CONSUMO] ?? 0), 0);
  if (Number(vista.cantidad_notarios_total) !== sumaNotarios) fail(`notarios total ${vista.cantidad_notarios_total} ≠ suma del Excel ${sumaNotarios}`);
  if (Number(vista.consumo_anual_total) !== sumaConsumo) fail(`consumo total ${vista.consumo_anual_total} ≠ suma del Excel ${sumaConsumo}`);
  console.log(`  ✓ ${sumaNotarios.toLocaleString("es-AR")} notarios · ${sumaConsumo.toLocaleString("es-AR")} fojas/año (suma de los 32 colegios)`);

  // ------------------------------------------------------------------ FOTOS
  console.log(`\n5 · FOTOS ACCESIBLES`);
  const conUrl = (mx ?? []).filter((p) => p.foto_url);
  let rotas = 0;
  for (const p of conUrl) {
    const r = await fetch(p.foto_url!, { method: "HEAD" });
    if (!r.ok) { fail(`foto rota de ${p.nombre_completo}: HTTP ${r.status}`); rotas++; }
  }
  if (!rotas) console.log(`  ✓ las ${conUrl.length} fotos responden`);

  console.log(`\n${fallos === 0 ? "✓ TODO OK — no se encontraron diferencias" : `✗ ${fallos} diferencia(s) encontradas`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
