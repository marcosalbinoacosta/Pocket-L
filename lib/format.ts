// Helpers de formato para datos comerciales

export function fmtMillones(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000)     return Math.round(n / 1_000_000) + "M";
  if (n >= 1_000)         return Math.round(n / 1_000) + "k";
  return String(n);
}

export function fmtNumero(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR");
}

export type SegLevel = "alta" | "media" | "baja" | "nula" | "na";

/** Clasifica el nivel de seguridad documental del país a partir del texto del Excel. */
export function nivelSeguridad(caracteristicas: string | null | undefined): SegLevel {
  if (!caracteristicas) return "na";
  const t = caracteristicas.toLowerCase();
  if (t.includes("sin seguridad")) return "nula";
  if (t.includes("papel de seguridad")) return "alta";
  if (t.includes("hibrido") || t.includes("híbrido")) return "media";
  return "baja";
}

export function segLabel(s: SegLevel): string {
  return ({ alta: "Papel seguridad", media: "Híbrido", baja: "Básica", nula: "Sin seguridad", na: "—" })[s];
}

export function segColor(s: SegLevel): string {
  return ({
    alta:  "bg-emerald-100 text-emerald-700",
    media: "bg-amber-100 text-amber-700",
    baja:  "bg-slate-100 text-slate-600",
    nula:  "bg-rose-100 text-rose-700",
    na:    "bg-slate-100 text-slate-400"
  })[s];
}
