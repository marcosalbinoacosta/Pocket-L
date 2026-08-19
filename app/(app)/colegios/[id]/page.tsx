"use client";
/**
 * Ficha de un colegio, editable.
 *
 * Los datos vienen de la investigación (PPT/Excel) pero envejecen solos: las
 * autoridades cambian por elección y los consumos se ajustan. Sin esto, cada
 * corrección necesita un script y alguien que lo corra.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { fmtMillones, fmtNumero } from "@/lib/format";
import type { Organizacion, ParticipanteConEstado } from "@/lib/types";
import ParticipantCard from "@/components/ui/ParticipantCard";

export default function ColegioPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Organizacion | null>(null);
  const [editando, setEditando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [contactos, setContactos] = useState<ParticipanteConEstado[] | null>(null);

  // borrador del formulario
  const [f, setF] = useState({
    autoridad: "", cantidad_notarios: "", consumo_anual: "",
    foja_tipo: "", impresor_fojas: "", notas_comerciales: "",
  });

  const cargar = useCallback(async () => {
    if (!id) return;
    const sb = supabaseBrowser();
    const { data } = await sb.from("organizaciones").select("*").eq("id", id).single();
    if (!data) return;
    const org = data as Organizacion;
    setO(org);
    setF({
      autoridad: org.autoridad ?? "",
      cantidad_notarios: org.cantidad_notarios?.toString() ?? "",
      consumo_anual: org.consumo_anual?.toString() ?? "",
      foja_tipo: org.foja_tipo ?? "",
      impresor_fojas: org.impresor_fojas ?? "",
      notas_comerciales: org.notas_comerciales ?? "",
    });

    // Las personas de este colegio: se enlazan por el nombre que quedó en
    // `participantes.organizacion`, que es como los cargó el import.
    const { data: gente } = await sb.from("participantes")
      .select("id,nombre_completo,pais_label,continente,organizacion,cargo_principal,roles_raw,prioridad_score,foto_url,contacto:contactos(estado,alta_prioridad,updated_at,representante_id)")
      .eq("organizacion", org.nombre)
      .order("prioridad_score", { ascending: false });
    setContactos((gente ?? []).map((r: any) => ({
      ...r, contacto: Array.isArray(r.contacto) ? r.contacto[0] ?? null : r.contacto,
    })) as ParticipanteConEstado[]);
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/organizaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo guardar");
      }
      setEditando(false);
      await cargar();
    } catch (e: any) {
      setErr(e?.message ?? "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!o) return <main className="app-shell"><div className="shimmer h-32 rounded-xl" /></main>;

  return (
    <main className="app-shell">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => router.back()} className="btn-ghost -ml-2">← volver</button>
        {!editando && (
          <button onClick={() => setEditando(true)} className="btn-ghost text-xs">Editar</button>
        )}
      </div>

      <header className="card card-pad">
        <div className="label">{o.subdivision ?? "Nivel nacional"}</div>
        <h1 className="app-h1 mt-1">{o.nombre}</h1>
        {o.tipo === "consejo_nacional" && (
          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-smallcaps text-slate-600">
            Coordina, no compra
          </span>
        )}
      </header>

      {editando ? (
        <section className="mt-3 card card-pad space-y-3">
          <Campo label="Autoridad" value={f.autoridad} onChange={(v) => setF({ ...f, autoridad: v })} placeholder="Nombre del presidente" />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Notarios" value={f.cantidad_notarios} onChange={(v) => setF({ ...f, cantidad_notarios: v })} numeric />
            <Campo label="Consumo anual" value={f.consumo_anual} onChange={(v) => setF({ ...f, consumo_anual: v })} numeric />
          </div>
          <Campo label="Tipo de foja" value={f.foja_tipo} onChange={(v) => setF({ ...f, foja_tipo: v })} />
          <Campo label="Impresor" value={f.impresor_fojas} onChange={(v) => setF({ ...f, impresor_fojas: v })} />
          <div>
            <label className="label mb-1 block">Notas comerciales</label>
            <textarea
              value={f.notas_comerciales}
              onChange={(e) => setF({ ...f, notas_comerciales: e.target.value })}
              rows={3}
              className="input resize-none"
            />
          </div>

          {err && <div className="text-sm text-red-600">⚠ {err}</div>}

          <div className="flex gap-2">
            <button onClick={guardar} disabled={busy} className="btn-gold flex-1 disabled:opacity-50">
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => { setEditando(false); setErr(null); cargar(); }} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metrica label="Consumo anual" value={fmtMillones(o.consumo_anual)} unit="fojas" big />
            <Metrica label="Notarios" value={fmtNumero(o.cantidad_notarios)} />
          </div>

          <div className="mt-3 card card-pad text-xs">
            <Fila k="Autoridad" v={o.autoridad} />
            <Fila k="Tipo de foja" v={o.foja_tipo} />
            <Fila k="Impresor" v={o.impresor_fojas} />
            <Fila k="Emisor de fojas" v={o.emisor_fojas == null ? null : o.emisor_fojas ? "Sí" : "No"} />
          </div>

          {o.notas_comerciales && (
            <div className="mt-3 card card-pad text-sm leading-relaxed">{o.notas_comerciales}</div>
          )}
        </>
      )}

      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Contactos del colegio</h2>
        <span className="label">{contactos?.length ?? "—"}</span>
      </div>
      <div className="space-y-2">
        {contactos === null && [0, 1].map((i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
        {contactos?.length === 0 && (
          <Link href="/agregar" className="ph block py-5 text-center active:bg-brand-50">
            Sin contactos cargados — tap para agregar
          </Link>
        )}
        {contactos?.map((p) => <ParticipantCard key={p.id} p={p} />)}
      </div>
    </main>
  );
}

function Campo({ label, value, onChange, numeric, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="label mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "numeric" : undefined}
        placeholder={placeholder}
        className={`input ${numeric ? "num" : ""}`}
      />
    </div>
  );
}

function Metrica({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div className="card card-pad">
      <div className="label">{label}</div>
      <div className="mt-1">
        <span className={`num font-bold ${big ? "text-2xl text-brand-700" : "text-xl text-ink"}`}>{value}</span>
        {unit && <span className="ml-1 text-[11px] text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="label shrink-0">{k}</span>
      <span className={`text-right font-medium ${v ? "text-ink" : "text-slate-300"}`}>{v ?? "—"}</span>
    </div>
  );
}
