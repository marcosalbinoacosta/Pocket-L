import type { Estado } from "@/lib/types";
import { estadoLabel } from "@/lib/utils";

const STYLES: Record<Estado, string> = {
  pendiente:    "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  contactado:   "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  no_interesado:"bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
};

interface Props {
  estado: Estado;
  alta?: boolean;
  size?: "sm" | "md";
}

export default function EstadoBadge({ estado, alta, size = "sm" }: Props) {
  const cls = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {alta && (
        <span
          className={`${cls} inline-flex items-center rounded-full bg-brand-50 font-bold text-brand-700 ring-1 ring-inset ring-brand-200`}
          title="Alta prioridad"
        >★</span>
      )}
      <span className={`${STYLES[estado]} ${cls} inline-flex items-center rounded-full font-semibold uppercase tracking-smallcaps`}>
        {estadoLabel(estado)}
      </span>
    </span>
  );
}
