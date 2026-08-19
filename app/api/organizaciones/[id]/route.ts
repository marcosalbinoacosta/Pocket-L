import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";

// Los datos duros del colegio. `id`, `pais_id` y `tipo` no se editan: definen
// a qué país cuelga y si suma al total, y cambiarlos desde la app rompería el
// rollup de la página de país.
const ALLOWED = [
  "nombre",
  "subdivision",
  "autoridad",
  "cantidad_notarios",
  "consumo_anual",
  "foja_tipo",
  "emisor_fojas",
  "impresor_fojas",
  "notas_comerciales",
] as const;

const NUMERICOS = new Set(["cantidad_notarios", "consumo_anual"]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }

  const update: Record<string, any> = {};
  for (const k of ALLOWED) {
    if (!(k in body)) continue;
    const v = body[k];
    if (NUMERICOS.has(k)) {
      if (v === null || v === "") { update[k] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `${k} tiene que ser un numero positivo` }, { status: 400 });
      }
      update[k] = Math.round(n);
    } else {
      update[k] = v === "" ? null : v;
    }
  }

  if (typeof update.nombre === "string" && !update.nombre.trim()) {
    return NextResponse.json({ error: "El nombre del colegio no puede quedar vacio" }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const sb = supabaseService();
  const { error } = await sb.from("organizaciones").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
