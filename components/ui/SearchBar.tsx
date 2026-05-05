"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import type { ParticipanteConEstado } from "@/lib/types";
import EstadoBadge from "./EstadoBadge";

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
  limit?: number;
  showShortcut?: boolean;
}

export default function SearchBar({
  placeholder = "Buscar…",
  autoFocus,
  limit = 30,
  showShortcut
}: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ParticipanteConEstado[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const sb = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (!term) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const myReq = ++reqId.current;
    const t = setTimeout(async () => {
      const tokens = term.split(/\s+/).filter(Boolean);
      let query = sb
        .from("participantes")
        .select("id,nombre_completo,pais_label,continente,organizacion,cargo_principal,roles_raw,prioridad_score,contacto:contactos(estado,alta_prioridad,updated_at,representante_id)")
        .order("prioridad_score", { ascending: false })
        .limit(limit);
      for (const tk of tokens) query = query.ilike("search_text", `%${tk}%`);
      const { data, error } = await query;
      if (myReq !== reqId.current) return;
      if (error) { console.error(error); setResults([]); }
      else {
        const norm = (data ?? []).map((r: any) => ({
          ...r,
          contacto: Array.isArray(r.contacto) ? r.contacto[0] ?? null : r.contacto
        })) as ParticipanteConEstado[];
        setResults(norm);
      }
      setLoading(false);
    }, 120);
    return () => clearTimeout(t);
  }, [q, limit, sb]);

  return (
    <div className="w-full">
      <div className="relative">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          inputMode="search"
          className="input-lg pl-11 pr-16"
        />
        {q ? (
          <button
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100"
            aria-label="Limpiar"
          >×</button>
        ) : showShortcut ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 hidden gap-1 sm:flex">
            <span className="kbd">⌘</span><span className="kbd">K</span>
          </span>
        ) : null}
      </div>

      {q && (
        <div className="mt-3 space-y-2">
          {loading && (
            <div className="space-y-2">
              {[0,1,2].map(i => <div key={i} className="shimmer h-[68px] rounded-xl" />)}
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="card card-pad">
              <div className="text-sm text-slate-500">Sin resultados para «{q}»</div>
            </div>
          )}
          {!loading && results.map((r) => (
            <Link
              key={r.id}
              href={`/contacto/${r.id}`}
              className="card card-hover block p-3 active:bg-brand-50"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink truncate">{r.nombre_completo}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {r.pais_label}{r.organizacion ? ` · ${r.organizacion}` : ""}
                  </div>
                  {r.cargo_principal && (
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-smallcaps text-gold-600 truncate">
                      {r.cargo_principal}
                    </div>
                  )}
                </div>
                <EstadoBadge estado={r.contacto?.estado ?? "pendiente"} alta={r.contacto?.alta_prioridad} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
