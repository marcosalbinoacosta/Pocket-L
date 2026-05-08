"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { fmtFecha } from "@/lib/utils";
import StandContactoForm, { StandFormValues } from "@/components/StandContactoForm";
import type { CanalContacto, ProximoPaso, StandContacto } from "@/lib/types";

type Detalle = StandContacto & {
  pais: { id: string; nombre: string; continente: string | null } | null;
  recep: { nombre: string; color: string } | null;
  participante: { id: string; nombre_completo: string } | null;
};

export default function StandDetallePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detalle | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const sb = supabaseBrowser();
    const { data } = await sb
      .from("stand_contactos")
      .select("*, pais:paises(id,nombre,continente), recep:representantes(nombre,color), participante:participantes(id,nombre_completo)")
      .eq("id", id)
      .single();
    if (data) setD(data as any);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const sb = supabaseBrowser();
    const ch = sb.channel(`stand:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stand_contactos", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [id, load]);

  async function onSubmit(v: StandFormValues) {
    const payload: any = { ...v };
    delete payload.tarjeta_file;

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (v.tarjeta_file) fd.append("tarjeta", v.tarjeta_file);

    const res = await fetch(`/api/stand/${id}`, { method: "PATCH", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "No se pudo guardar");
    }
    setEditing(false);
    load();
  }

  async function eliminar() {
    if (!d) return;
    const ok = window.confirm(`¿Eliminar el F.0024-02 de "${d.contacto_nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/stand/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo eliminar");
      }
      router.push("/stand");
    } catch (e: any) {
      alert(e?.message ?? "Error al eliminar");
    } finally {
      setBusy(false);
    }
  }

  if (!d) return <main className="app-shell"><div className="shimmer h-32 rounded-xl" /></main>;

  if (editing) {
    return (
      <main className="app-shell">
        <button onClick={() => setEditing(false)} className="btn-ghost mb-2 -ml-2">← cancelar</button>
        <h1 className="app-h1 mb-3">Editar F.0024-02</h1>
        <StandContactoForm
          submitLabel="Guardar cambios"
          lockedParticipante={d.participante}
          initial={d}
          onSubmit={onSubmit}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => router.back()} className="btn-ghost -ml-2">← volver</button>
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs">Editar</button>
          <button onClick={eliminar} disabled={busy} className="btn-ghost text-xs text-red-600 disabled:opacity-50">Borrar</button>
        </div>
      </div>

      <header className="card card-pad">
        <div className="label">F.0024-02 · {fmtFecha(d.fecha)}</div>
        <h1 className="mt-1 text-xl font-bold text-ink">{d.contacto_nombre}</h1>
        {d.cargo && <div className="text-sm text-slate-600">{d.cargo}</div>}
        {d.institucion && <div className="mt-1 text-sm font-medium text-ink">{d.institucion}</div>}
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {d.pais_label && <span className="rounded-full bg-slate-100 px-2 py-0.5">{d.pais_label}</span>}
          {d.recep && (
            <span className="rounded-full px-2 py-0.5 font-semibold uppercase tracking-smallcaps" style={{ color: d.recep.color, background: `${d.recep.color}15` }}>
              Atendió: {d.recep.nombre}
            </span>
          )}
          {d.participante && (
            <Link href={`/contacto/${d.participante.id}`} className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold uppercase tracking-smallcaps text-emerald-700">
              UINL · ver ficha
            </Link>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {d.email && <a href={`mailto:${d.email}`} className="text-brand-700 underline underline-offset-2">{d.email}</a>}
          {d.telefono && <a href={`tel:${d.telefono}`} className="text-brand-700 underline underline-offset-2 num">{d.telefono}</a>}
        </div>
      </header>

      {d.tarjeta_url && (
        <a href={d.tarjeta_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
          <div className="card card-pad">
            <div className="label mb-1">Tarjeta personal</div>
            <img src={d.tarjeta_url} alt="Tarjeta" className="max-h-48 w-full rounded-lg object-cover" />
          </div>
        </a>
      )}

      <Seccion titulo="Datos institucionales generales">
        <Item n={1} q="¿Cuántos notarios hay aproximadamente en el país?" v={fmtNum(d.p1_notarios_aprox)} />
        <Item n={2} q="¿Su institución emite los formularios notariales?" v={fmtBool(d.p2_emite_formularios)} />
        <Item n={3} q="¿Cuántas líneas de formularios utilizan actualmente?" v={fmtNum(d.p3_lineas_formularios)} />
        <Item n={4} q="¿Es un sistema de emisión…?" v={fmtSistema(d.p4_sistema_emision)} />
      </Seccion>

      <Seccion titulo="Seguridad documental">
        <Item n={5} q="¿Han detectado falsificación o adulteración en el último año?" v={fmtBool(d.p5_falsificaciones)} />
        <Item n={6} q="Mayores riesgos u oportunidades en el proceso" v={d.p6_riesgos} />
      </Seccion>

      <Seccion titulo="Solución física">
        <Item n={7} q="Características de seguridad en formulario físico" v={d.p7_seguridad_fisica} />
        <Item n={8} q="Consumo aproximado mensual/anual de folios" v={d.p8_consumo_folios} />
        <Item n={9} q="Modalidad de compra" v={fmtModalidad(d.p9_modalidad_compra)} />
        <Item n={10} q="Tipo de impresor" v={fmtImpresor(d.p10_impresor)} />
        <Item n={11} q="Proveedor actual de impresión" v={d.p11_proveedor_impresion} />
      </Seccion>

      <Seccion titulo="Solución digital">
        <Item n={12} q="Medidas de seguridad digital implementadas" v={d.p12_seguridad_digital} />
        <Item n={13} q="Herramientas/software para documentos digitales nativos" v={d.p13_herramientas} />
        <Item
          n={14}
          q="Tipo de desarrollo"
          v={d.p14_desarrollo ? `${d.p14_desarrollo === "propio" ? "Propio" : "Externo"}${d.p14_proveedor_desarrollo ? ` · ${d.p14_proveedor_desarrollo}` : ""}` : null}
        />
      </Seccion>

      <Seccion titulo="Próximos pasos">
        <Item n={15} q="Tipo de contacto preferido" v={fmtMulti(d.p15_proximos_pasos, labelProximo)} />
        <Item n={16} q="Mejor canal de contacto" v={fmtMulti(d.p16_canal_contacto, labelCanal)} />
      </Seccion>

      {d.observaciones && (
        <Seccion titulo="Observaciones">
          <div className="card card-pad whitespace-pre-wrap text-sm">{d.observaciones}</div>
        </Seccion>
      )}
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="app-h2 mb-2">{titulo}</h2>
      <div className="card divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function Item({ n, q, v }: { n: number; q: string; v: string | null | undefined }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="num text-[11px] font-bold text-brand-500">{n}.</span>
        <div className="flex-1">
          <div className="text-[12px] text-slate-500">{q}</div>
          <div className={`mt-0.5 text-sm ${v ? "text-ink whitespace-pre-wrap" : "text-slate-300"}`}>{v || "—"}</div>
        </div>
      </div>
    </div>
  );
}

function fmtNum(n: number | null) { return n != null ? n.toLocaleString("es-AR") : null; }
function fmtBool(b: boolean | null) { return b == null ? null : b ? "Sí" : "No"; }
function fmtSistema(s: string | null) {
  if (!s) return null;
  return ({ fisico: "100% físico", digital: "100% digital", mixto: "Mixto" } as any)[s] ?? s;
}
function fmtModalidad(s: string | null) {
  if (!s) return null;
  return ({ compra_directa: "Compra directa", licitacion_publica: "Licitación pública", otro: "Otro" } as any)[s] ?? s;
}
function fmtImpresor(s: string | null) {
  if (!s) return null;
  return ({ estatal: "Estatal", privada: "Privada", mixto: "Mixto" } as any)[s] ?? s;
}
function fmtMulti<T extends string>(arr: T[] | null, fn: (v: T) => string) {
  if (!arr || arr.length === 0) return null;
  return arr.map(fn).join(" · ");
}
function labelProximo(p: ProximoPaso) {
  return ({ reunion_virtual: "Reunión virtual", visita_presencial: "Visita presencial", cotizacion: "Envío de cotización", info: "Envío de información" } as any)[p];
}
function labelCanal(c: CanalContacto) {
  return ({ whatsapp: "WhatsApp", linkedin: "LinkedIn", email: "Email", telefono: "Teléfono" } as any)[c];
}
