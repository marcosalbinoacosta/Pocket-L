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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("stand_contactos")
    .select("*, pais:paises(id,nombre,continente), recep:representantes(nombre,color), participante:participantes(id,nombre_completo)")
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    body.tarjeta_url = pub.publicUrl;
  }

  const update: Record<string, any> = {};
  for (const k of ALLOWED) if (k in body) update[k] = body[k];

  if (typeof update.contacto_nombre === "string" && !update.contacto_nombre.trim()) {
    return NextResponse.json({ error: "contacto_nombre no puede quedar vacio" }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  // FKs opcionales: nullify si vienen pero no existen (evita FK violation)
  if (update.recepcionado_por) {
    const { data: rep } = await sb.from("representantes").select("id").eq("id", update.recepcionado_por).maybeSingle();
    if (!rep) update.recepcionado_por = null;
  }
  if (update.participante_id) {
    const { data: pp } = await sb.from("participantes").select("id").eq("id", update.participante_id).maybeSingle();
    if (!pp) update.participante_id = null;
  }

  const { error } = await sb.from("stand_contactos").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sb = supabaseService();
  const { error } = await sb.from("stand_contactos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
