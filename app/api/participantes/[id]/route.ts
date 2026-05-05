import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED = [
  "nombre_completo",
  "pais_id",
  "pais_label",
  "continente",
  "email",
  "telefono",
  "organizacion",
  "cargo_principal",
  "roles_raw",
  "prioridad_score",
  "notas_publicas"
] as const;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }

  const update: Record<string, any> = {};
  for (const k of ALLOWED) if (k in body) update[k] = body[k];

  if (typeof update.nombre_completo === "string" && !update.nombre_completo.trim()) {
    return NextResponse.json({ error: "nombre_completo no puede quedar vacio" }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const sb = supabaseService();
  const { error } = await sb.from("participantes").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sb = supabaseService();
  const { error } = await sb.from("participantes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
