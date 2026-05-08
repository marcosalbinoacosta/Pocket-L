import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";

const BUCKET = "tarjetas-stand";

const ALLOWED = [
  "participante_id",
  "institucion",
  "contacto_nombre",
  "cargo",
  "pais_id",
  "pais_label",
  "email",
  "telefono",
  "p1_notarios_aprox",
  "p2_emite_formularios",
  "p3_lineas_formularios",
  "p4_sistema_emision",
  "p5_falsificaciones",
  "p6_riesgos",
  "p7_seguridad_fisica",
  "p8_consumo_folios",
  "p9_modalidad_compra",
  "p10_impresor",
  "p11_proveedor_impresion",
  "p12_seguridad_digital",
  "p13_herramientas",
  "p14_desarrollo",
  "p14_proveedor_desarrollo",
  "p15_proximos_pasos",
  "p16_canal_contacto",
  "observaciones",
  "fecha",
  "tarjeta_url",
  "recepcionado_por"
] as const;

export async function GET(req: Request) {
  const sb = supabaseService();
  const url = new URL(req.url);
  const participanteId = url.searchParams.get("participante_id");
  let q = sb
    .from("stand_contactos")
    .select("*, pais:paises(id,nombre,continente), recep:representantes(nombre,color), participante:participantes(id,nombre_completo)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (participanteId) q = q.eq("participante_id", participanteId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const sb = supabaseService();
  const ct = req.headers.get("content-type") || "";

  let body: any = {};
  let tarjetaFile: File | null = null;

  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const json = fd.get("payload");
    if (typeof json !== "string") return NextResponse.json({ error: "payload faltante" }, { status: 400 });
    try { body = JSON.parse(json); } catch { return NextResponse.json({ error: "payload JSON invalido" }, { status: 400 }); }
    const f = fd.get("tarjeta");
    if (f instanceof File && f.size > 0) tarjetaFile = f;
  } else {
    try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }
  }

  const nombre = (body?.contacto_nombre ?? "").toString().trim();
  if (!nombre) return NextResponse.json({ error: "contacto_nombre es obligatorio" }, { status: 400 });

  // Subir tarjeta primero (si vino) para tener la URL antes del insert
  let tarjeta_url: string | null = body.tarjeta_url || null;
  if (tarjetaFile) {
    const ext = (tarjetaFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await tarjetaFile.arrayBuffer());
    const up = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: tarjetaFile.type || "image/jpeg",
      upsert: false
    });
    if (up.error) return NextResponse.json({ error: "Upload tarjeta: " + up.error.message }, { status: 500 });
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    tarjeta_url = pub.publicUrl;
  }

  const insert: Record<string, any> = {};
  for (const k of ALLOWED) if (k in body) insert[k] = body[k];
  insert.contacto_nombre = nombre;
  if (tarjeta_url) insert.tarjeta_url = tarjeta_url;

  // recepcionado_por puede venir de un localStorage stale; validamos que el rep exista
  if (insert.recepcionado_por) {
    const { data: rep } = await sb.from("representantes").select("id").eq("id", insert.recepcionado_por).maybeSingle();
    if (!rep) insert.recepcionado_por = null;
  }
  // participante_id idem (FK opcional)
  if (insert.participante_id) {
    const { data: pp } = await sb.from("participantes").select("id").eq("id", insert.participante_id).maybeSingle();
    if (!pp) insert.participante_id = null;
  }

  const { data, error } = await sb.from("stand_contactos").insert(insert).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, tarjeta_url });
}
