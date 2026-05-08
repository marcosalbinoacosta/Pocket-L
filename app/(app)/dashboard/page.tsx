"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import EstadoBadge from "@/components/ui/EstadoBadge";
import { fmtFecha } from "@/lib/utils";

interface Stats { total: number; pendientes: number; contactados: number; alta_prioridad: number; no_interesado: number }
interface StandStats { total: number; hoy: number; ultima_semana: number; ligados_uinl: number; paises_distintos: number }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [standStats, setStandStats] = useState<StandStats | null>(null);
  const [alta, setAlta] = useState<any[]>([]);
  const [ultimasNotas, setUltimasNotas] = useState<any[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const load = async () => {
      const s = await sb.from("v_dashboard_stats").select("*").single();
      const ss = await sb.from("v_stand_stats").select("*").single();
      const a = await sb.from("contactos")
        .select("estado,alta_prioridad,updated_at,participante:participantes(id,nombre_completo,pais_label,cargo_principal)")
        .eq("alta_prioridad", true)
        .order("updated_at", { ascending: false })
        .limit(20);
      const n = await sb.from("notas")
        .select("id,texto,created_at,rep:representantes(nombre,color),participante:participantes(id,nombre_completo)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (s.data) setStats(s.data as Stats);
      if (ss.data) setStandStats(ss.data as StandStats);
      if (a.data) setAlta(a.data as any);
      if (n.data) setUltimasNotas(n.data as any);
    };
    load();
    const ch = sb.channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "contactos" },       load)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas" },           load)
      .on("postgres_changes", { event: "*", schema: "public", table: "stand_contactos" }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  const pct = stats && stats.total > 0
    ? Math.round((stats.contactados / stats.total) * 100)
    : 0;

  return (
    <main className="app-shell">
      <h1 className="app-h1 mb-4">Equipo</h1>

      {/* progreso global */}
      <div className="card card-pad">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label">Progreso global</div>
            <div className="mt-1">
              <span className="num text-3xl font-bold text-brand-700">{stats?.contactados ?? "—"}</span>
              <span className="num text-base text-slate-400"> / {stats?.total ?? "—"}</span>
            </div>
          </div>
          <div className="num text-2xl font-bold text-gold-600">{pct}%</div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gold-grad transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* breakdown */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Pendientes"   value={stats?.pendientes} />
        <Stat label="Alta"         value={stats?.alta_prioridad} accent />
        <Stat label="No interés"   value={stats?.no_interesado} muted />
      </div>

      {/* F.0024-02 Contactos de stand */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Stand · F.0024-02</h2>
        <Link href="/stand" className="label hover:text-brand-700">Ver todos →</Link>
      </div>
      <Link href="/stand" className="card card-hover card-pad block active:bg-brand-50">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label">Total cargados</div>
            <div className="num mt-1 text-3xl font-bold text-brand-700">{standStats?.total ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="label">Hoy</div>
            <div className="num mt-1 text-2xl font-bold text-gold-600">{standStats?.hoy ?? "—"}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.ultima_semana ?? "—"}</div>
            <div className="label">7 días</div>
          </div>
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.ligados_uinl ?? "—"}</div>
            <div className="label">UINL</div>
          </div>
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.paises_distintos ?? "—"}</div>
            <div className="label">Países</div>
          </div>
        </div>
      </Link>

      {/* Tabla densa: Alta prioridad */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Alta prioridad</h2>
        <span className="label">{alta.length}</span>
      </div>

      {alta.length === 0 ? (
        <div className="ph py-6">Sin contactos marcados como alta prioridad</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>País</th>
                <th className="text-right">Hace</th>
              </tr>
            </thead>
            <tbody>
              {alta.map((c: any) => c.participante && (
                <tr key={c.participante.id}>
                  <td className="max-w-[140px]">
                    <Link href={`/contacto/${c.participante.id}`} className="font-medium text-ink hover:text-brand-700">
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-gold-600">★</span>
                        <span className="truncate">{c.participante.nombre_completo}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {c.estado === "contactado" && <span className="rounded-full bg-emerald-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-smallcaps text-emerald-700 ring-1 ring-inset ring-emerald-200">Contactado</span>}
                        {c.estado === "pendiente" && <span className="rounded-full bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-smallcaps text-slate-500 ring-1 ring-inset ring-slate-200">Pendiente</span>}
                        {c.estado === "no_interesado" && <span className="rounded-full bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-smallcaps text-slate-500 ring-1 ring-inset ring-slate-200">No interés</span>}
                        {c.participante.cargo_principal && (
                          <span className="truncate text-[10px] text-slate-400 uppercase tracking-smallcaps">{c.participante.cargo_principal}</span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="text-slate-500">{c.participante.pais_label}</td>
                  <td className="num text-right text-slate-400">{fmtFecha(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Últimas notas */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Últimas notas</h2>
        <span className="label">tiempo real</span>
      </div>
      <ul className="space-y-2">
        {ultimasNotas.map((n: any) => (
          <li key={n.id} className="card card-pad">
            <div className="mb-1 flex items-center justify-between text-xs">
              <Link href={`/contacto/${n.participante?.id}`} className="font-semibold text-ink truncate max-w-[60%] hover:text-brand-700">
                {n.participante?.nombre_completo}
              </Link>
              <span className="num text-slate-400">{fmtFecha(n.created_at)}</span>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-smallcaps" style={{ color: n.rep?.color }}>
              {n.rep?.nombre}
            </div>
            <div className="mt-1 text-sm whitespace-pre-wrap line-clamp-3">{n.texto}</div>
          </li>
        ))}
        {ultimasNotas.length === 0 && <li className="ph py-4">Sin notas todavía</li>}
      </ul>
    </main>
  );
}

function Stat({ label, value, accent, muted }: { label: string; value: number | undefined; accent?: boolean; muted?: boolean }) {
  return (
    <div className="card card-pad">
      <div className="label">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${accent ? "text-estado-alta" : muted ? "text-slate-400" : "text-ink"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
