"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { fmtFecha } from "@/lib/utils";
import { EVENTO_ACTUAL, INICIO_EVENTO, INICIO_EVENTO_FECHA, esDeEsteEvento } from "@/lib/evento";

interface StandStats {
  total: number;
  ligados_uinl: number;
  paises_distintos: number;
  con_proximos_pasos: number;
  accion_reunion: number;
  accion_visita: number;
  accion_cotizacion: number;
  accion_info: number;
}

/** "hace 3 m" en una tabla densa dice más que una fecha completa. */
function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} d`;
  return `hace ${Math.round(dias / 30)} m`;
}

export default function DashboardPage() {
  const [objetivo, setObjetivo] = useState<any[]>([]);
  const [trabajado, setTrabajado] = useState<any[]>([]);
  const [standStats, setStandStats] = useState<StandStats | null>(null);
  const [ultimasNotas, setUltimasNotas] = useState<any[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const load = async () => {
      // la lista de caza: todo lo marcado con ★, venga de la sede que venga
      const o = await sb.from("contactos")
        .select("estado,alta_prioridad,ultimo_contacto_at,participante:participantes(id,nombre_completo,pais_label,cargo_principal)")
        .eq("alta_prioridad", true);
      // lo efectivamente trabajado en esta sede, esté o no en la lista de caza
      const t = await sb.from("contactos")
        .select("estado,alta_prioridad,ultimo_contacto_at,participante:participantes(id,nombre_completo,pais_label,cargo_principal)")
        .gte("ultimo_contacto_at", INICIO_EVENTO)
        .order("ultimo_contacto_at", { ascending: false });
      const n = await sb.from("notas")
        .select("id,texto,created_at,rep:representantes(nombre,color),participante:participantes(id,nombre_completo)")
        .gte("created_at", INICIO_EVENTO)
        .order("created_at", { ascending: false })
        .limit(8);
      // el stand se acota por su propia fecha; v_stand_stats suma todas las sedes
      const s = await sb.from("stand_contactos")
        .select("participante_id,pais_id,p15_proximos_pasos")
        .gte("fecha", INICIO_EVENTO_FECHA);

      if (o.data) setObjetivo(o.data as any);
      if (t.data) setTrabajado(t.data as any);
      if (n.data) setUltimasNotas(n.data as any);
      if (s.data) {
        const f = s.data as any[];
        const tiene = (a: string) => f.filter(x => (x.p15_proximos_pasos ?? []).includes(a)).length;
        setStandStats({
          total: f.length,
          ligados_uinl: f.filter(x => x.participante_id).length,
          paises_distintos: new Set(f.filter(x => x.pais_id).map(x => x.pais_id)).size,
          con_proximos_pasos: f.filter(x => (x.p15_proximos_pasos ?? []).length > 0).length,
          accion_reunion: tiene("reunion_virtual"),
          accion_visita: tiene("visita_presencial"),
          accion_cotizacion: tiene("cotizacion"),
          accion_info: tiene("info")
        });
      }
    };
    load();
    const ch = sb.channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "contactos" },       load)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas" },           load)
      .on("postgres_changes", { event: "*", schema: "public", table: "stand_contactos" }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  // los ★ todavía sin abordar acá: primero los que ya conocemos de otra sede,
  // que son los leads más calientes; los nunca contactados van al final
  const porAbordar = objetivo
    .filter(c => !esDeEsteEvento(c.ultimo_contacto_at))
    .sort((a, b) => (b.ultimo_contacto_at ?? "").localeCompare(a.ultimo_contacto_at ?? ""));
  const abordados = objetivo.filter(c => esDeEsteEvento(c.ultimo_contacto_at));
  const fueraDeLista = trabajado.filter(c => !c.alta_prioridad);

  const pct = objetivo.length > 0
    ? Math.round((abordados.length / objetivo.length) * 100)
    : 0;

  const standPct = standStats && standStats.total > 0
    ? Math.round((standStats.con_proximos_pasos / standStats.total) * 100)
    : 0;

  return (
    <main className="app-shell">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="app-h1">Equipo</h1>
        <span className="label shrink-0">{EVENTO_ACTUAL}</span>
      </div>

      {/* progreso del congreso: cuántos objetivos ya abordamos acá */}
      <div className="card card-pad">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label">Objetivos abordados</div>
            <div className="mt-1">
              <span className="num text-3xl font-bold text-brand-700">{abordados.length}</span>
              <span className="num text-base text-slate-400"> / {objetivo.length}</span>
            </div>
          </div>
          <div className="num text-2xl font-bold text-gold-600">{pct}%</div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gold-grad transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Por abordar" value={porAbordar.length} accent />
        <Stat label="Abordados"   value={abordados.length} />
        <Stat label="Fuera lista" value={fueraDeLista.length} muted />
      </div>

      {/* F.0024-02 Contactos de stand */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Stand · F.0024-02</h2>
        <Link href="/stand" className="label hover:text-brand-700">Ver todos →</Link>
      </div>
      <Link href="/stand" className="card card-hover card-pad block active:bg-brand-50">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label">Con próximo paso</div>
            <div className="mt-1">
              <span className="num text-3xl font-bold text-brand-700">{standStats?.con_proximos_pasos ?? "—"}</span>
              <span className="num text-base text-slate-400"> / {standStats?.total ?? "—"}</span>
            </div>
          </div>
          <div className="num text-2xl font-bold text-gold-600">{standPct}%</div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gold-grad transition-[width] duration-500" style={{ width: `${standPct}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.accion_reunion ?? "—"}</div>
            <div className="label mt-0.5">Reunión</div>
          </div>
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.accion_visita ?? "—"}</div>
            <div className="label mt-0.5">Visita</div>
          </div>
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.accion_cotizacion ?? "—"}</div>
            <div className="label mt-0.5">Cotización</div>
          </div>
          <div>
            <div className="num text-base font-semibold text-ink">{standStats?.accion_info ?? "—"}</div>
            <div className="label mt-0.5">Info</div>
          </div>
        </div>
        <div className="mt-3 flex justify-center gap-3 text-[11px] text-slate-500">
          <span><span className="num font-semibold text-ink">{standStats?.ligados_uinl ?? "—"}</span> UINL</span>
          <span className="text-slate-300">·</span>
          <span><span className="num font-semibold text-ink">{standStats?.paises_distintos ?? "—"}</span> países</span>
        </div>
      </Link>

      {/* La lista de caza */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Por abordar</h2>
        <span className="label">{porAbordar.length}</span>
      </div>
      {porAbordar.length === 0 ? (
        <div className="ph py-6">
          {objetivo.length === 0
            ? "Sin contactos marcados con ★"
            : "Todos los objetivos ya fueron abordados en este congreso"}
        </div>
      ) : (
        <Tabla filas={porAbordar} columna="Última vez" />
      )}

      {/* Lo hecho en esta sede */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Trabajado acá</h2>
        <span className="label">{trabajado.length}</span>
      </div>
      {trabajado.length === 0 ? (
        <div className="ph py-6">Todavía sin contactos en este congreso</div>
      ) : (
        <Tabla filas={trabajado} columna="Cuándo" />
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
        {ultimasNotas.length === 0 && <li className="ph py-4">Sin notas en este congreso</li>}
      </ul>

      <p className="mt-6 text-center text-[11px] text-slate-400">
        El historial de congresos anteriores sigue en la ficha de cada persona.
      </p>
    </main>
  );
}

function Tabla({ filas, columna }: { filas: any[]; columna: string }) {
  return (
    <div className="card overflow-hidden">
      <table className="tbl">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>País</th>
            <th className="text-right">{columna}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c: any) => c.participante && (
            <tr key={c.participante.id}>
              <td className="max-w-[140px]">
                <Link href={`/contacto/${c.participante.id}`} className="font-medium text-ink hover:text-brand-700">
                  <div className="flex items-center gap-1 truncate">
                    {c.alta_prioridad && <span className="text-gold-600">★</span>}
                    <span className="truncate">{c.participante.nombre_completo}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {c.ultimo_contacto_at
                      ? !esDeEsteEvento(c.ultimo_contacto_at) && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-smallcaps text-amber-700 ring-1 ring-inset ring-amber-200">Seguimiento</span>
                        )
                      : (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-smallcaps text-slate-500 ring-1 ring-inset ring-slate-200">Nuevo</span>
                        )}
                    {c.participante.cargo_principal && (
                      <span className="truncate text-[10px] text-slate-400 uppercase tracking-smallcaps">{c.participante.cargo_principal}</span>
                    )}
                  </div>
                </Link>
              </td>
              <td className="text-slate-500">{c.participante.pais_label}</td>
              <td className="num text-right text-slate-400">{haceCuanto(c.ultimo_contacto_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
