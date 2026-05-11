"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { fmtFecha, quitarAcentos } from "@/lib/utils";
import type { ProximoPaso } from "@/lib/types";

type Row = {
  id: string;
  fecha: string;
  contacto_nombre: string;
  institucion: string | null;
  pais_label: string | null;
  cargo: string | null;
  email: string | null;
  participante_id: string | null;
  p15_proximos_pasos: ProximoPaso[];
  recep: { nombre: string; color: string } | null;
};

const FILTROS: { v: ProximoPaso | "todos"; l: string }[] = [
  { v: "todos", l: "Todos" },
  { v: "reunion_virtual", l: "Reunión" },
  { v: "visita_presencial", l: "Visita" },
  { v: "cotizacion", l: "Cotización" },
  { v: "info", l: "Info" }
];

export default function StandListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<ProximoPaso | "todos">("todos");

  useEffect(() => {
    const sb = supabaseBrowser();
    const load = async () => {
      const { data } = await sb
        .from("stand_contactos")
        .select("id,fecha,contacto_nombre,institucion,pais_label,cargo,email,participante_id,p15_proximos_pasos,recep:representantes(nombre,color)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      setRows((data ?? []) as any);
    };
    load();
    const ch = sb.channel("stand-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "stand_contactos" }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = quitarAcentos(q.trim().toLowerCase());
    return rows.filter(r => {
      if (filtro !== "todos" && !(r.p15_proximos_pasos ?? []).includes(filtro)) return false;
      if (!term) return true;
      const blob = quitarAcentos(`${r.contacto_nombre} ${r.institucion ?? ""} ${r.pais_label ?? ""} ${r.email ?? ""}`.toLowerCase());
      return blob.includes(term);
    });
  }, [rows, q, filtro]);

  return (
    <main className="app-shell">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="app-h1">Stand · F.0024-02</h1>
        <button onClick={() => router.push("/stand/nuevo")} className="btn-gold px-3 py-2 text-sm">+ Nuevo</button>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Buscar institución, contacto, país…"
        className="input mb-3"
      />

      <div className="mb-4 flex gap-2 overflow-x-auto noscroll">
        {FILTROS.map(f => {
          const active = filtro === f.v;
          return (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-500"
              }`}
            >{f.l}</button>
          );
        })}
      </div>

      {!filtered && (
        <div className="space-y-2">
          <div className="shimmer h-20 rounded-xl" />
          <div className="shimmer h-20 rounded-xl" />
          <div className="shimmer h-20 rounded-xl" />
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="ph py-10 text-center">Sin contactos cargados todavía</div>
      )}

      <ul className="space-y-2">
        {filtered?.map(r => (
          <li key={r.id}>
            <Link href={`/stand/${r.id}`} className="card card-hover card-pad block active:bg-brand-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink truncate">{r.contacto_nombre}</div>
                  {r.institucion && <div className="truncate text-sm text-slate-600">{r.institucion}</div>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    {r.pais_label && <span>{r.pais_label}</span>}
                    {r.cargo && <span>· {r.cargo}</span>}
                    {r.participante_id && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-smallcaps text-emerald-700 ring-1 ring-inset ring-emerald-200">UINL</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-[11px] text-slate-400">{fmtFecha(r.fecha)}</div>
                  {r.recep && (
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-smallcaps" style={{ color: r.recep.color }}>
                      {r.recep.nombre}
                    </div>
                  )}
                </div>
              </div>
              {r.p15_proximos_pasos && r.p15_proximos_pasos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.p15_proximos_pasos.map(p => (
                    <span key={p} className="rounded-full bg-slate-100 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-smallcaps text-slate-600">
                      {labelProximo(p)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function labelProximo(p: ProximoPaso) {
  switch (p) {
    case "reunion_virtual": return "Reunión";
    case "visita_presencial": return "Visita";
    case "cotizacion": return "Cotización";
    case "info": return "Info";
  }
}
