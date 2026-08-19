import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }

  const nombre = (body?.nombre_completo ?? "").toString().trim();
  if (!nombre) return NextResponse.json({ error: "nombre_completo es obligatorio" }, { status: 400 });

  const sb = supabaseService();
  const insert = {
    nombre_completo: nombre,
    pais_id: body.pais_id || null,
    pais_label: body.pais_label || null,
    continente: body.continente || null,
    email: body.email || null,
    telefono: body.telefono || null,
    organizacion: body.organizacion || null,
    cargo_principal: body.cargo_principal || null,
    roles_raw: body.roles_raw || null,
    prioridad_score: typeof body.prioridad_score === "number" ? body.prioridad_score : 0,
    notas_publicas: body.notas_publicas || null,
    foto_url: body.foto_url || null
  };

  const { data, error } = await sb.from("participantes").insert(insert).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
