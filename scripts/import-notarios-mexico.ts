/**
 * Suma los notarios de México a la base de contactos.
 *
 * La UINL es un solo evento que va rotando de país, así que no hay bases
 * separadas: los 32 presidentes de colegio estatal (más la presidenta del
 * Colegio Nacional) entran como participantes junto al resto, con su foto
 * sacada del PPT de investigación.
 *
 * No pisa lo que ya está: si la persona ya existía de un congreso anterior,
 * solo le completa los huecos (foto, organización) sin tocar su estado de
 * contacto ni sus notas. Y si encuentra un nombre *parecido* pero no idéntico,
 * lo reporta en vez de decidir por su cuenta.
 *
 * Antes de correr:
 *   1. patch_016_fotos_participantes.sql en Supabase (crea el bucket)
 *   2. python scripts/extraer_fotos_mexico.py (genera scripts/fotos_mexico/)
 *
 * Uso:  npx tsx scripts/import-notarios-mexico.ts [--dry] [--refotos]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { normalizarNombrePersona, quitarAcentos, slug } from "../lib/utils";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const DRY = process.argv.includes("--dry");
// Reemplaza la foto aunque la persona ya tenga una: sirve para volver a subirlas
// optimizadas sin tocar nada más de la ficha.
const REFOTOS = process.argv.includes("--refotos");
const ROOT = process.cwd();
const F_MEXICO = path.join(ROOT, "CUADRO ANALISIS MEXICO.xlsx");
const DIR_FOTOS = path.join(ROOT, "scripts", "fotos_mexico");
const BUCKET = "fotos-participantes";

const COL = { COLEGIO: 0, PRESIDENTE: 1, NOTARIOS: 3, CONSUMO: 6 } as const;

// El PPT escribe "Aguas Calientes"; el nombre real del estado es Aguascalientes.
const ALIAS_FOTO: Record<string, string> = { aguascalientes: "aguas-calientes" };

// Fusiones confirmadas a mano tras mirar el registro existente. Sin esto el
// script crearía un duplicado, porque el nombre no coincide exacto.
//   · "Jaime Casas Madero" ya estaba cargado con teléfono y con el cargo de
//     presidente del colegio de Zacatecas escrito dentro del campo país.
//     Es la misma persona que "Jaime Arturo Casas Madero".
const FUSIONES: Record<string, string> = {
  "jaime arturo casas madero": "jaime casas madero",
};

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

function buscarFoto(sub: string): string | null {
  const base = slug(sub);
  for (const cand of [ALIAS_FOTO[base] ?? base, base]) {
    for (const ext of ["png", "jpg", "jpeg"]) {
      const p = path.join(DIR_FOTOS, `${cand}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function subirFoto(file: string, nombreDestino: string): Promise<string | null> {
  const ext = path.extname(file).slice(1).toLowerCase();
  const key = `mexico/${nombreDestino}.${ext}`;
  if (DRY) return `(dry) ${key}`;
  const { error } = await sb.storage.from(BUCKET).upload(key, fs.readFileSync(file), {
    contentType: ext === "png" ? "image/png" : "image/jpeg",
    upsert: true,
  });
  if (error) { console.error("   ✗ subiendo foto:", error.message); return null; }
  return sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

const fmt = (n: number | null) => (n == null ? null : n.toLocaleString("es-AR"));

(async () => {
  const wb = XLSX.readFile(F_MEXICO);
  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["Hoja1"], { header: 1, defval: null, range: 1 });

  const mapaFotos = JSON.parse(
    fs.readFileSync(path.join(DIR_FOTOS, "_mapa.json"), "utf-8")
  ) as { subdivision: string; autoridad: string | null; archivo: string | null }[];

  // Quién figura hoy como autoridad de cada colegio: si el PPT trae otro nombre,
  // hubo relevo y hay que traspasar el cargo en vez de duplicar la ficha.
  const { data: orgs } = await sb.from("organizaciones").select("id,subdivision,autoridad").eq("pais_id", "mexico");

  // Trae los existentes una sola vez para el match exacto por nombre normalizado.
  const { data: existentes } = await sb.from("participantes").select("id,nombre_completo,foto_url,organizacion,pais_id,cargo_principal,prioridad_score");
  const porNombre = new Map<string, any>();
  for (const p of existentes ?? []) {
    porNombre.set(quitarAcentos(normalizarNombrePersona(p.nombre_completo)).toLowerCase(), p);
  }

  const filas = rows.filter((r) => r[COL.COLEGIO] && r[COL.PRESIDENTE]);

  // La presidencia del Colegio Nacional no está en el Excel: sale del PPT, leída
  // por extraer_fotos_mexico.py. Va del archivo y no hardcodeada porque cambia:
  // en agosto de 2026 pasó de Guadalupe Díaz Carranza a Ricardo Vargas Navarro.
  const fichaNacional = mapaFotos.find((m) => m.subdivision === "Colegio Nacional");
  if (!fichaNacional?.autoridad) {
    console.error("No se pudo leer la autoridad del Colegio Nacional del PPT. Corré extraer_fotos_mexico.py primero.");
    process.exit(1);
  }
  filas.push(["Colegio Nacional del Notariado Mexicano, A.C.", fichaNacional.autoridad, null, 4500, null, null, null]);

  let creados = 0, completados = 0, intactos = 0, sinFoto = 0;
  const dudosos: { nuevo: string; parecido: string; similitud: number; organizacion: string | null }[] = [];
  const relevos: { colegio: string; antes: string; ahora: string }[] = [];

  for (const r of filas) {
    const colegio = String(r[COL.COLEGIO]).trim();
    const sub = /notariado mexicano/i.test(colegio) ? "Colegio Nacional" : subdivision(colegio);
    const nombre = normalizarNombrePersona(String(r[COL.PRESIDENTE]).trim());
    const notarios = typeof r[COL.NOTARIOS] === "number" ? r[COL.NOTARIOS] : null;
    const consumo = typeof r[COL.CONSUMO] === "number" ? r[COL.CONSUMO] : null;

    const clave = quitarAcentos(nombre).toLowerCase();
    const yaEsta = porNombre.get(clave) ?? (FUSIONES[clave] ? porNombre.get(FUSIONES[clave]) : undefined);

    // ¿Relevo? La autoridad guardada no coincide con la que trae la fuente.
    const org = (orgs ?? []).find((o) => quitarAcentos(o.subdivision ?? "").toLowerCase().replace(/\s/g, "") === quitarAcentos(sub).toLowerCase().replace(/\s/g, ""))
      ?? (sub === "Colegio Nacional" ? (orgs ?? []).find((o) => o.id === "mexico-cnnm") : undefined);
    const autoridadVieja = org?.autoridad ? normalizarNombrePersona(org.autoridad) : null;
    if (autoridadVieja && quitarAcentos(autoridadVieja).toLowerCase() !== clave) {
      relevos.push({ colegio: sub, antes: autoridadVieja, ahora: nombre });
      if (!DRY) {
        await sb.from("organizaciones").update({ autoridad: nombre }).eq("id", org!.id);
        // Al anterior no se lo borra: sigue siendo un contacto real y puede
        // conservar notas e historial. Solo deja de figurar como presidente.
        const saliente = porNombre.get(quitarAcentos(autoridadVieja).toLowerCase());
        if (saliente && saliente.cargo_principal === "Presidente") {
          await sb.from("participantes").update({
            cargo_principal: "Ex presidente",
            notas_publicas: `Fue presidente del ${colegio}. Relevado en la actualización del ${new Date().toISOString().slice(0, 10)}.`,
          }).eq("id", saliente.id);
        }
      }
    }

    // Nombres parecidos pero no idénticos: se avisan, no se fusionan solos.
    if (!yaEsta) {
      const { data: similares } = await sb.rpc("buscar_participante_similar", {
        p_nombre: nombre, p_pais_id: "mexico", p_umbral: 0.55,
      });
      for (const s of similares ?? []) {
        if (quitarAcentos(s.nombre_completo).toLowerCase() !== clave) {
          dudosos.push({ nuevo: nombre, parecido: s.nombre_completo, similitud: s.similitud, organizacion: s.organizacion });
        }
      }
    }

    const foto = buscarFoto(sub);
    if (!foto) sinFoto++;

    if (yaEsta) {
      // Ya venía de un congreso anterior: solo se completan huecos, nunca se
      // pisa lo que alguien cargó a mano (ni su estado de contacto ni sus notas).
      const parche: Record<string, any> = {};
      if ((REFOTOS || !yaEsta.foto_url) && foto) parche.foto_url = await subirFoto(foto, slug(nombre));
      if (!yaEsta.organizacion) parche.organizacion = colegio;
      // El cargo sí se pisa: por definición de este script esta persona es hoy
      // la autoridad del colegio, y eso pesa más comercialmente que el rol UINL
      // que traía de un congreso. El rol viejo no se pierde: sigue en roles_raw
      // y en la tabla participaciones.
      if (yaEsta.cargo_principal !== "Presidente") parche.cargo_principal = "Presidente";
      if ((yaEsta.prioridad_score ?? 0) < 40) parche.prioridad_score = 40;
      // Si el país nunca se resolvió, el pais_label suele traer basura (en un
      // caso tenía el cargo entero adentro). Ahí sí conviene reescribirlo.
      if (!yaEsta.pais_id) {
        parche.pais_id = "mexico";
        parche.pais_label = "México";
        parche.continente = "America";
      }
      if (Object.keys(parche).length === 0) { intactos++; console.log(`  = ${nombre} — ya estaba completo`); continue; }
      if (!DRY) await sb.from("participantes").update(parche).eq("id", yaEsta.id);
      completados++;
      console.log(`  ↑ ${nombre} — ya existía, se completó ${Object.keys(parche).join(", ")}`);
      continue;
    }

    const detalle = [
      notarios ? `${fmt(notarios)} notarios` : null,
      consumo ? `${fmt(consumo)} fojas/año` : null,
    ].filter(Boolean).join(" · ");

    const nuevo = {
      nombre_completo: nombre,
      pais_id: "mexico",
      pais_label: "México",
      continente: "America",
      organizacion: colegio,
      cargo_principal: "Presidente",
      // Mismo peso que un presidente en el import general: es quien decide la compra.
      prioridad_score: 40,
      foto_url: foto ? await subirFoto(foto, slug(nombre)) : null,
      notas_publicas: detalle ? `Colegio: ${detalle}.` : null,
    };

    if (!DRY) {
      const { error } = await sb.from("participantes").insert(nuevo);
      if (error) { console.error(`  ✗ ${nombre}:`, error.message); continue; }
    }
    creados++;
    console.log(`  + ${nombre} — ${sub}${foto ? "" : "  (sin foto)"}`);
  }

  if (relevos.length) {
    console.log(`\n⟳ ${relevos.length} relevo(s) de autoridad:`);
    for (const r of relevos) {
      console.log(`   ${r.colegio}: ${r.antes} → ${r.ahora}`);
      console.log(`     (al saliente se le pone "Ex presidente"; no se borra, sigue siendo un contacto)`);
    }
  }

  console.log(`\n${DRY ? "[DRY RUN] " : ""}Creados: ${creados} · Completados: ${completados} · Sin cambios: ${intactos} · Sin foto: ${sinFoto}`);

  if (dudosos.length) {
    console.log(`\n⚠ ${dudosos.length} nombres parecidos a alguien que ya está — revisá si son la misma persona:`);
    for (const d of dudosos) {
      console.log(`   "${d.nuevo}"  ~  "${d.parecido}" (${(d.similitud * 100).toFixed(0)}%${d.organizacion ? `, ${d.organizacion}` : ""})`);
    }
    console.log("   No se fusionó nada. Si alguno es la misma persona, unificalo a mano en la app.");
  }
})().catch((e) => { console.error(e); process.exit(1); });
