import type { Estado } from "./types";

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function quitarAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// prefijos honoríficos que ensucian el matching de nombres entre eventos
// (mismo notario aparece como "Not. Juan Pérez", "Lic. Juan Pérez", "Juan Pérez")
const HONORIFICOS = [
  // el orden importa: la variante larga tiene que probarse antes que la corta
  "not\\.?\\s+pub\\.?", "notario\\(a\\)?", "notaria", "notario", "not\\.",
  "lic\\.?", "licenciado", "licenciada",
  "dr\\.?", "dra\\.?", "doctor", "doctora",
  "mtro\\.?", "mtra\\.?", "maestro", "maestra",
  "ing\\.?", "abg\\.?", "pte\\.?", "presidente", "presidenta"
];
const RE_HONORIFICOS = new RegExp(`^(?:${HONORIFICOS.join("|")})\\s+`, "i");

/** Quita prefijos honoríficos + normaliza espacios, para comparar nombres entre fuentes distintas. */
export function normalizarNombrePersona(s: string): string {
  let r = s.trim().replace(/\s+/g, " ");
  // puede venir con más de un prefijo encadenado ("Pte. Lic. Francisco...")
  let prev;
  do { prev = r; r = r.replace(RE_HONORIFICOS, ""); } while (r !== prev);
  return r.trim();
}

export function estadoLabel(e: Estado): string {
  switch (e) {
    case "pendiente": return "Pendiente";
    case "contactado": return "Contactado";
    case "no_interesado": return "No interesado";
  }
}

export function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
