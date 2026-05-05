"use client";
import { supabaseBrowser } from "./supabase";
import type { Representante } from "./types";

const KEY = "latina.representante";

export async function loginConPin(pin: string): Promise<Representante | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("verificar_pin", { pin });
  if (error || !data || data.length === 0) return null;
  const r = data[0] as { id: string; nombre: string; color: string };
  const rep: Representante = { id: r.id, nombre: r.nombre, color: r.color, activo: true };
  localStorage.setItem(KEY, JSON.stringify(rep));
  return rep;
}

export function getRepresentante(): Representante | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Representante) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(KEY);
}
