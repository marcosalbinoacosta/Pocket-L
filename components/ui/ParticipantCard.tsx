import Link from "next/link";
import type { ParticipanteConEstado } from "@/lib/types";
import EstadoBadge from "./EstadoBadge";

export default function ParticipantCard({ p }: { p: ParticipanteConEstado }) {
  const initials = (p.nombre_completo || "")
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/contacto/${p.id}`}
      className="card card-hover block p-3 active:bg-brand-50"
    >
      <div className="flex items-start gap-3">
        <div className="ph !min-h-0 h-10 w-10 shrink-0 rounded-full font-mono text-[11px] !text-brand-700">
          {initials || "—"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink truncate">{p.nombre_completo}</div>
          <div className="text-xs text-slate-500 truncate">
            {p.pais_label}{p.organizacion ? ` · ${p.organizacion}` : ""}
          </div>
          {p.cargo_principal && (
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-smallcaps text-gold-600 truncate">
              {p.cargo_principal}
            </div>
          )}
        </div>
        <EstadoBadge
          estado={p.contacto?.estado ?? "pendiente"}
          alta={p.contacto?.alta_prioridad}
        />
      </div>
    </Link>
  );
}
