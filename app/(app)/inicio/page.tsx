"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import SearchBar from "@/components/ui/SearchBar";
import UserChip from "@/components/ui/UserChip";

type Modo = "continente" | "organismo";

interface StatsContinente { continente: string; total: number; contactados: number; alta_prioridad: number }
interface OrgRow { codigo: string; nombre: string; tipo: string; total: number; contactados: number; alta: number }

const TIPO_LABEL: Record<string, string> = {
  consejo: "Consejos",
  comision: "Comisiones",
  grupo_trabajo: "Grupos de Trabajo",
  asamblea: "Asamblea"
};
const TIPO_ORDEN: string[] = ["consejo", "comision", "grupo_trabajo", "asamblea"];

export default function InicioPage() {
  const [modo, setModo] = useState<Modo>("continente");
  const [continentes, setContinentes] = useState<StatsContinente[] | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from("v_stats_continente").select("*").then(({ data }) => setContinentes(data ?? []));
  }, []);

  useEffect(() => {
    if (modo !== "organismo" || orgs !== null) return;
    const sb = supabaseBrowser();
    (async () => {
      // 1) catálogo de organismos
      const { data: cs } = await sb.from("comisiones").select("codigo,nombre,tipo");
      // 2) participaciones con estado del contacto
      const { data: ps } = await sb.from("participaciones")
        .select("comision_codigo, participante:participantes!inner(contacto:contactos(estado,alta_prioridad))");
      // 3) agrupar en cliente
      const acc: Record<string, { total: number; contactados: number; alta: number }> = {};
      for (const p of ps ?? []) {
        const k = (p as any).comision_codigo as string;
        const part = Array.isArray((p as any).participante) ? (p as any).participante[0] : (p as any).participante;
        const c = Array.isArray(part?.contacto) ? part.contacto[0] : part?.contacto;
        if (!acc[k]) acc[k] = { total: 0, contactados: 0, alta: 0 };
        acc[k].total++;
        if (c?.estado === "contactado") acc[k].contactados++;
        if (c?.alta_prioridad === true) acc[k].alta++;
      }
      const rows: OrgRow[] = (cs ?? []).map((c: any) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        total: acc[c.codigo]?.total ?? 0,
        contactados: acc[c.codigo]?.contactados ?? 0,
        alta: acc[c.codigo]?.alta ?? 0
      }));
      setOrgs(rows);
    })();
  }, [modo, orgs]);

  const orgsAgrupadas = useMemo(() => {
    if (!orgs) return null;
    const groups: Record<string, OrgRow[]> = {};
    for (const o of orgs) {
      if (o.total === 0) continue; // ocultar organismos sin miembros
      (groups[o.tipo] ||= []).push(o);
    }
    return TIPO_ORDEN.filter(t => groups[t]?.length).map(t => ({ tipo: t, items: groups[t] }));
  }, [orgs]);

  return (
    <main className="app-shell">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="app-h1">Inicio</h1>
          <p className="text-sm text-slate-500">Explorá por continente, organismo o buscá directo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/agregar"
            aria-label="Agregar participante"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white shadow-card active:bg-brand-700"
          >+</Link>
          <UserChip />
        </div>
      </header>

      <SearchBar showShortcut />

      {/* Toggle */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-soft">
          <button
            onClick={() => setModo("continente")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              modo === "continente" ? "bg-brand-500 text-white" : "text-slate-500"
            }`}
          >Continente</button>
          <button
            onClick={() => setModo("organismo")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              modo === "organismo" ? "bg-brand-500 text-white" : "text-slate-500"
            }`}
          >Organismo</button>
        </div>
        <span className="label">
          {modo === "continente" ? `${continentes?.length ?? "—"} regiones` : `${orgsAgrupadas?.reduce((n,g)=>n+g.items.length,0) ?? "—"} con miembros`}
        </span>
      </div>

      {modo === "continente" ? (
        <div className="space-y-2">
          {continentes === null && [0,1,2,3,4].map(i => <div key={i} className="shimmer h-[88px] rounded-xl" />)}
          {continentes?.length === 0 && <div className="ph py-6">Sin datos · ejecutá el import</div>}
          {continentes?.map(s => {
            const pct = s.total > 0 ? Math.round((s.contactados / s.total) * 100) : 0;
            return (
              <Link key={s.continente} href={`/inicio/continente/${encodeURIComponent(s.continente)}`}
                className="card card-hover block p-4 active:bg-brand-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-ink">{s.continente}</div>
                    <div className="num text-xs text-slate-500">
                      {s.contactados} <span className="text-slate-400">de</span> {s.total} contactados
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-xl font-bold text-brand-700">{pct}%</div>
                    {s.alta_prioridad > 0 && (
                      <div className="num text-[10px] uppercase tracking-smallcaps text-estado-alta">
                        {s.alta_prioridad} alta
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gold-grad" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {orgsAgrupadas === null && [0,1,2].map(i => <div key={i} className="shimmer h-[140px] rounded-xl" />)}
          {orgsAgrupadas?.length === 0 && <div className="ph py-6">Sin organismos con miembros</div>}
          {orgsAgrupadas?.map(g => (
            <section key={g.tipo}>
              <h2 className="label mb-2">{TIPO_LABEL[g.tipo]}</h2>
              <div className="card overflow-hidden">
                {g.items.map((o, i) => {
                  const pct = o.total > 0 ? Math.round((o.contactados / o.total) * 100) : 0;
                  return (
                    <Link key={o.codigo} href={`/inicio/organismo/${encodeURIComponent(o.codigo)}`}
                      className={`flex items-center gap-3 px-4 py-3 active:bg-brand-50 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                      <div className="num shrink-0 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase tracking-smallcaps text-brand-700">
                        {o.codigo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{o.nombre}</div>
                        <div className="num text-[11px] text-slate-500">
                          {o.contactados}<span className="text-slate-300">/</span>{o.total}
                          {o.alta > 0 && <span className="ml-2 text-estado-alta">{o.alta} alta</span>}
                        </div>
                      </div>
                      <div className="num text-sm font-bold text-gold-600">{pct}%</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
