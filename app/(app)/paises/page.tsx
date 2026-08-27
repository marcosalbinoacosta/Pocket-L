"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import type { Pais } from "@/lib/types";
import { fmtMillones, nivelSeguridad, segLabel, segColor } from "@/lib/format";
import { quitarAcentos } from "@/lib/utils";
import { PAISES_OBJETIVO } from "@/lib/paises-objetivo";

type Sort = "consumo" | "notarios" | "habitantes" | "inscriptos" | "nombre";
type Filtro = "todos" | "objetivos" | "sin_seguridad" | "papel_seguridad" | "con_inscriptos";

interface PaisRow extends Pais { inscriptos: number; consumo_anual_total: number | null; cantidad_notarios_total: number | null }

export default function PaisesPage() {
  const [rows, setRows] = useState<PaisRow[] | null>(null);
  const [sort, setSort] = useState<Sort>("nombre");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  // el continente es un eje aparte de los chips de abajo: se combinan entre si
  const [continente, setContinente] = useState<string>("todos");
  const [q, setQ] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: paises } = await sb.from("v_paises_con_organizaciones").select("*");
      const { data: parts } = await sb.from("participantes").select("pais_id");
      const cnt: Record<string, number> = {};
      for (const p of parts ?? []) {
        const k = (p as any).pais_id;
        if (k) cnt[k] = (cnt[k] ?? 0) + 1;
      }
      const merged: PaisRow[] = (paises ?? []).map((p: any) => ({ ...p, inscriptos: cnt[p.id] ?? 0 }));
      setRows(merged);
    })();
  }, []);

  const visible = useMemo(() => {
    if (!rows) return null;
    let r = rows;
    if (continente !== "todos") r = r.filter(x => x.continente === continente);
    if (filtro === "objetivos")       r = r.filter(x => PAISES_OBJETIVO.has(x.id));
    if (filtro === "sin_seguridad")   r = r.filter(x => nivelSeguridad(x.caracteristicas_tecnicas) === "nula");
    if (filtro === "papel_seguridad") r = r.filter(x => nivelSeguridad(x.caracteristicas_tecnicas) === "alta");
    if (filtro === "con_inscriptos")  r = r.filter(x => x.inscriptos > 0);
    if (q.trim()) {
      const term = quitarAcentos(q.trim().toLowerCase());
      r = r.filter(x =>
        quitarAcentos(x.nombre.toLowerCase()).includes(term) ||
        quitarAcentos((x.organizacion_notarial ?? "").toLowerCase()).includes(term)
      );
    }
    const arr = [...r];
    arr.sort((a, b) => {
      switch (sort) {
        case "consumo":     return (b.consumo_anual_total ?? 0) - (a.consumo_anual_total ?? 0);
        case "notarios":    return (b.cantidad_notarios_total ?? 0) - (a.cantidad_notarios_total ?? 0);
        case "habitantes":  return (b.cantidad_habitantes ?? 0) - (a.cantidad_habitantes ?? 0);
        case "inscriptos":  return b.inscriptos - a.inscriptos;
        case "nombre":      return a.nombre.localeCompare(b.nombre);
      }
    });
    return arr;
  }, [rows, sort, filtro, continente, q]);

  // los continentes salen de los datos: si entra un pais nuevo, aparece solo
  const continentes = useMemo(
    () => Array.from(new Set((rows ?? []).map(r => r.continente).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const total = rows?.length ?? 0;
  // el encabezado acompana lo que se ve: filtrar por Europa muestra el agregado de Europa
  const visibles = visible?.length ?? total;
  const consumoVisible = (visible ?? rows ?? []).reduce((s, r) => s + (r.consumo_anual_total ?? 0), 0);

  return (
    <main className="app-shell">
      <header className="mb-3">
        <h1 className="app-h1">Países</h1>
        <p className="text-sm text-slate-500">
          <span className="num">{visibles}</span>
          {visibles !== total && <> de <span className="num">{total}</span></>} países UINL · consumo agregado{" "}
          <span className="num font-semibold text-brand-700">{fmtMillones(consumoVisible)}</span> fojas/año
        </p>
      </header>

      {/* búsqueda */}
      <div className="mb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar país u organización…"
          className="input"
        />
      </div>

      {/* continente: eje geográfico, en tinta para no confundirlo con los chips de abajo */}
      <div className="noscroll mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {["todos", ...continentes].map(c => (
          <button
            key={c}
            onClick={() => setContinente(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              continente === c ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >{c === "todos" ? "Todo el mundo" : c}</button>
        ))}
      </div>

      {/* filtros chips */}
      <div className="noscroll mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {([
          ["todos","Todos"],
          ["objetivos","Objetivos"],
          ["con_inscriptos","Con inscriptos"],
          ["sin_seguridad","Sin seguridad"],
          ["papel_seguridad","Papel seguridad"]
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filtro === k ? "bg-brand-500 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >{l}</button>
        ))}
      </div>

      {/* sort */}
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="label">Ordenar</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-ink focus:border-brand-400 focus:outline-none"
        >
          <option value="nombre">Nombre A→Z</option>
          <option value="consumo">Consumo ↓</option>
          <option value="notarios">Notarios ↓</option>
          <option value="habitantes">Habitantes ↓</option>
          <option value="inscriptos">Inscriptos ↓</option>
        </select>
      </div>

      {/* tabla densa */}
      {visible === null && <div className="shimmer h-64 rounded-xl" />}
      {visible && (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>País</th>
                <th className="text-right">Consumo</th>
                <th className="text-right">Notarios</th>
                <th className="text-right">Inscr.</th>
                <th>Seguridad</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const seg = nivelSeguridad(p.caracteristicas_tecnicas);
                return (
                  <tr key={p.id} className="cursor-pointer">
                    <td>
                      <Link href={`/paises/${p.id}`} className="block">
                        <div className="font-semibold text-ink">{p.nombre}</div>
                        <div className="text-[11px] text-slate-400">{p.continente ?? "—"}</div>
                      </Link>
                    </td>
                    <td className="num text-right text-ink">{fmtMillones(p.consumo_anual_total)}</td>
                    <td className="num text-right text-ink">{fmtMillones(p.cantidad_notarios_total)}</td>
                    <td className="num text-right">
                      {p.inscriptos > 0
                        ? <span className="font-semibold text-brand-700">{p.inscriptos}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-smallcaps ${segColor(seg)}`}>
                        {segLabel(seg)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visible && visible.length === 0 && <div className="ph py-6">Sin resultados</div>}
    </main>
  );
}
