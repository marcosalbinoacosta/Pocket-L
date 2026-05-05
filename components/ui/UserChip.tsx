"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepresentante, logout } from "@/lib/auth";
import type { Representante } from "@/lib/types";

export default function UserChip() {
  const r = useRouter();
  const [me, setMe] = useState<Representante | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMe(getRepresentante()); }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  if (!me) return null;
  const initials = me.nombre.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-soft active:bg-brand-50"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: me.color }}
        >{initials}</span>
        <span className="text-sm font-semibold text-ink">{me.nombre.split(" ")[0]}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lift">
          <div className="px-3 py-2 text-xs">
            <div className="font-semibold text-ink">{me.nombre}</div>
            <div className="label mt-0.5">PIN sesión activa</div>
          </div>
          <div className="divider" />
          <button
            onClick={() => { logout(); r.replace("/pin"); }}
            className="block w-full px-3 py-2.5 text-left text-sm font-medium text-estado-alta active:bg-brand-50"
          >Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
