"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { getRepresentante } from "@/lib/auth";
import EstadoBadge from "@/components/ui/EstadoBadge";
import { fmtFecha, estadoLabel } from "@/lib/utils";
import { fmtMillones, nivelSeguridad, segLabel, segColor } from "@/lib/format";
import type { Contacto, Estado, Nota, Pais, Participante, Representante } from "@/lib/types";

const ESTADOS: Estado[] = ["pendiente","contactado","no_interesado"];

export default function ContactoPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<Representante | null>(null);
  const [p, setP] = useState<Participante | null>(null);
  const [c, setC] = useState<Contacto | null>(null);
  const [pais, setPais] = useState<Pais | null>(null);
  const [notas, setNotas] = useState<(Nota & { rep?: { nombre: string; color: string } })[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const sb = supabaseBrowser();

  const load = useCallback(async () => {
    if (!id) return;
    const pq = await sb.from("participantes").select("*").eq("id", id).single();
    const cq = await sb.from("contactos").select("*").eq("participante_id", id).single();
    const nq = await sb.from("notas")
      .select("id,participante_id,representante_id,texto,created_at,rep:representantes(nombre,color)")
      .eq("participante_id", id)
      .order("created_at", { ascending: false });
    if (pq.data) {
      const part = pq.data as Participante;
      setP(part);
      if (part.pais_id) {
        const paq = await sb.from("paises").select("*").eq("id", part.pais_id).single();
        if (paq.data) setPais(paq.data as Pais);
      }
    }
    if (cq.data) setC(cq.data as Contacto);
    if (nq.data) setNotas(nq.data as any);
  }, [id, sb]);

  useEffect(() => { setMe(getRepresentante()); load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const ch = sb.channel(`contacto:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contactos", filter: `participante_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas",     filter: `participante_id=eq.${id}` }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [id, sb, load]);

  async function setEstado(e: Estado) {
    if (!c || !me) return;
    setBusy(true);
    const { error } = await sb.from("contactos").update({ estado: e, representante_id: me.id }).eq("id", c.id);
    setBusy(false);
    if (error) alert("No se pudo actualizar: " + error.message);
  }

  async function toggleAlta() {
    if (!c || !me) return;
    setBusy(true);
    const { error } = await sb.from("contactos")
      .update({ alta_prioridad: !c.alta_prioridad, representante_id: me.id })
      .eq("id", c.id);
    setBusy(false);
    if (error) alert("No se pudo actualizar: " + error.message);
  }

  async function generarBrief() {
    if (!id || briefLoading) return;
    setBrief("");
    setBriefError(null);
    setBriefLoading(true);
    try {
      const res = await fetch(`/api/brief/${id}`);
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "Error generando brief");
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setBrief(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: any) {
      setBriefError(e?.message ?? "Error inesperado");
    } finally {
      setBriefLoading(false);
    }
  }

  async function addNota() {
    if (!draft.trim() || !me || !p) return;
    setBusy(true);
    const { error } = await sb.from("notas").insert({
      participante_id: p.id,
      representante_id: me.id,
      texto: draft.trim()
    });
    setBusy(false);
    if (error) { alert("No se pudo guardar la nota: " + error.message); return; }
    setDraft("");
  }

  if (!p) return <main className="app-shell"><div className="shimmer h-32 rounded-xl" /></main>;

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>

      <header className="card card-pad">
        <h1 className="text-xl font-bold text-ink">{p.nombre_completo}</h1>
        <div className="mt-1 text-sm text-slate-600">
          {p.pais_label}{p.organizacion ? ` · ${p.organizacion}` : ""}
        </div>
        {p.cargo_principal && (
          <div className="mt-2 inline-flex items-center rounded-md bg-gold-grad px-2 py-1 text-[11px] font-semibold uppercase tracking-smallcaps text-brand-900">
            {p.cargo_principal}
          </div>
        )}
        {p.roles_raw && <div className="mt-3 text-xs text-slate-500">{p.roles_raw}</div>}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {p.email    && <a href={`mailto:${p.email}`} className="text-brand-700 underline underline-offset-2">{p.email}</a>}
          {p.telefono && <a href={`tel:${p.telefono}`}  className="text-brand-700 underline underline-offset-2 num">{p.telefono}</a>}
        </div>
      </header>

      {/* snippet del país: contexto comercial directo */}
      {pais && (
        <Link
          href={`/paises/${pais.id}`}
          className="mt-3 block card card-hover p-3 active:bg-brand-50"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="label">{pais.continente ?? "—"}</div>
              <div className="font-semibold text-ink truncate">{pais.nombre}</div>
              <div className="num mt-0.5 text-xs text-slate-500">
                {pais.cantidad_habitantes ? `${fmtMillones(pais.cantidad_habitantes)} habs` : ""}
                {pais.cantidad_notarios ? ` · ${fmtMillones(pais.cantidad_notarios)} notarios` : ""}
                {pais.consumo_anual ? ` · ${fmtMillones(pais.consumo_anual)} fojas/año` : ""}
              </div>
            </div>
            <span className={`shrink-0 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-smallcaps ${segColor(nivelSeguridad(pais.caracteristicas_tecnicas))}`}>
              {segLabel(nivelSeguridad(pais.caracteristicas_tecnicas))}
            </span>
          </div>
        </Link>
      )}

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="app-h2">Brief IA</h2>
          <button
            onClick={generarBrief}
            disabled={briefLoading}
            className="btn-ghost text-xs disabled:opacity-50"
          >
            {briefLoading ? "Generando…" : brief ? "Regenerar" : "Generar"}
          </button>
        </div>
        {!brief && !briefLoading && !briefError && (
          <div className="ph py-4">Tap «Generar» para preparar la reunión</div>
        )}
        {briefLoading && !brief && (
          <div className="shimmer h-24 rounded-xl" />
        )}
        {briefError && (
          <div className="card card-pad text-sm text-red-600">⚠ {briefError}</div>
        )}
        {brief && (
          <div className="card card-pad whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {brief}
          </div>
        )}
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="app-h2">Estado</h2>
          {c && <EstadoBadge estado={c.estado} alta={c.alta_prioridad} size="md" />}
        </div>

        {/* toggle alta prioridad — independiente del estado */}
        <button
          disabled={busy || !c}
          onClick={toggleAlta}
          className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
            c?.alta_prioridad
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-ink active:bg-brand-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className={`text-base ${c?.alta_prioridad ? "text-gold-600" : "text-slate-300"}`}>★</span>
            Alta prioridad
          </span>
          <span className={`text-[11px] uppercase tracking-smallcaps ${c?.alta_prioridad ? "text-brand-700" : "text-slate-400"}`}>
            {c?.alta_prioridad ? "Activa" : "Tap para marcar"}
          </span>
        </button>

        {/* picker de estado de contacto */}
        <div className="grid grid-cols-3 gap-2">
          {ESTADOS.map(e => {
            const active = c?.estado === e;
            return (
              <button
                key={e}
                disabled={busy || active}
                onClick={() => setEstado(e)}
                className={`rounded-lg px-2 py-2.5 text-xs font-semibold border ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-ink active:bg-brand-50"
                }`}
              >{estadoLabel(e)}</button>
            );
          })}
        </div>
        {c?.updated_at && <div className="num mt-2 text-xs text-slate-400">Actualizado {fmtFecha(c.updated_at)}</div>}
      </section>

      <section className="mt-5">
        <h2 className="app-h2 mb-2">Notas del equipo</h2>
        <div className="card card-pad">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Agregar una nota rápida…"
            rows={3}
            className="input resize-none"
          />
          <button
            onClick={addNota}
            disabled={busy || !draft.trim()}
            className="btn-gold mt-2 w-full disabled:opacity-50"
          >Guardar nota</button>
        </div>

        <ul className="mt-3 space-y-2">
          {notas.map(n => (
            <li key={n.id} className="card card-pad">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: n.rep?.color }}>{n.rep?.nombre ?? "—"}</span>
                <span className="num text-slate-400">{fmtFecha(n.created_at)}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{n.texto}</div>
            </li>
          ))}
          {notas.length === 0 && <li className="ph py-4">Sin notas todavía</li>}
        </ul>
      </section>
    </main>
  );
}
