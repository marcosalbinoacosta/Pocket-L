"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { codigoPais } from "@/lib/country-codes";
import { quitarAcentos } from "@/lib/utils";
import type {
  CanalContacto,
  DesarrolloTipo,
  ImpresorTipo,
  ModalidadCompra,
  Pais,
  Participante,
  ProximoPaso,
  SistemaEmision,
  StandContacto
} from "@/lib/types";

export interface StandFormValues {
  participante_id: string | null;
  institucion: string | null;
  contacto_nombre: string;
  cargo: string | null;
  pais_id: string | null;
  pais_label: string | null;
  email: string | null;
  telefono: string | null;

  p1_notarios_aprox: number | null;
  p2_emite_formularios: boolean | null;
  p3_lineas_formularios: number | null;
  p4_sistema_emision: SistemaEmision | null;

  p5_falsificaciones: boolean | null;
  p6_riesgos: string | null;

  p7_seguridad_fisica: string | null;
  p8_consumo_folios: string | null;
  p9_modalidad_compra: ModalidadCompra | null;
  p10_impresor: ImpresorTipo | null;
  p11_proveedor_impresion: string | null;

  p12_seguridad_digital: string | null;
  p13_herramientas: string | null;
  p14_desarrollo: DesarrolloTipo | null;
  p14_proveedor_desarrollo: string | null;

  p15_proximos_pasos: ProximoPaso[];
  p16_canal_contacto: CanalContacto[];

  observaciones: string | null;
  fecha: string; // YYYY-MM-DD
  tarjeta_file?: File | null;
  tarjeta_url?: string | null;
}

interface Props {
  initial?: Partial<StandContacto>;
  /** Si se setea, deshabilita el buscador de participante y fija la FK */
  lockedParticipante?: { id: string; nombre_completo: string } | null;
  submitLabel: string;
  onSubmit: (v: StandFormValues) => Promise<void>;
}

const PROXIMOS: { v: ProximoPaso; l: string }[] = [
  { v: "reunion_virtual", l: "Reunión virtual" },
  { v: "visita_presencial", l: "Visita presencial" },
  { v: "cotizacion", l: "Envío de cotización" },
  { v: "info", l: "Envío de información" }
];
const CANALES: { v: CanalContacto; l: string }[] = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "linkedin", l: "LinkedIn" },
  { v: "email", l: "Email" },
  { v: "telefono", l: "Teléfono" }
];

export default function StandContactoForm({ initial, lockedParticipante, submitLabel, onSubmit }: Props) {
  const sb = useMemo(() => supabaseBrowser(), []);

  // Estado base
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Vínculo opcional con participante UINL
  const [participanteId, setParticipanteId] = useState<string | null>(
    lockedParticipante?.id ?? initial?.participante_id ?? null
  );
  const [partQuery, setPartQuery] = useState(lockedParticipante?.nombre_completo ?? "");
  const [partSugs, setPartSugs] = useState<Pick<Participante, "id" | "nombre_completo" | "pais_id" | "pais_label" | "email" | "telefono" | "organizacion" | "cargo_principal">[]>([]);
  const [showPartSugs, setShowPartSugs] = useState(false);
  const partWrapRef = useRef<HTMLDivElement>(null);

  // País
  const [paises, setPaises] = useState<Pais[] | null>(null);
  const [paisQuery, setPaisQuery] = useState(initial?.pais_label ?? "");
  const [paisId, setPaisId] = useState<string | null>(initial?.pais_id ?? null);
  const [paisLabel, setPaisLabel] = useState<string | null>(initial?.pais_label ?? null);
  const [showPaisSugs, setShowPaisSugs] = useState(false);
  const paisWrapRef = useRef<HTMLDivElement>(null);

  // Cabecera
  const [institucion, setInstitucion] = useState(initial?.institucion ?? "");
  const [contactoNombre, setContactoNombre] = useState(initial?.contacto_nombre ?? "");
  const [cargo, setCargo] = useState(initial?.cargo ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");

  // Datos institucionales (1-4)
  const [p1, setP1] = useState<number | null>(initial?.p1_notarios_aprox ?? null);
  const [p2, setP2] = useState<boolean | null>(initial?.p2_emite_formularios ?? null);
  const [p3, setP3] = useState<number | null>(initial?.p3_lineas_formularios ?? null);
  const [p4, setP4] = useState<SistemaEmision | null>(initial?.p4_sistema_emision ?? null);

  // Seguridad documental (5-6)
  const [p5, setP5] = useState<boolean | null>(initial?.p5_falsificaciones ?? null);
  const [p6, setP6] = useState(initial?.p6_riesgos ?? "");

  // Solución física (7-11)
  const [p7, setP7] = useState(initial?.p7_seguridad_fisica ?? "");
  const [p8, setP8] = useState(initial?.p8_consumo_folios ?? "");
  const [p9, setP9] = useState<ModalidadCompra | null>(initial?.p9_modalidad_compra ?? null);
  const [p10, setP10] = useState<ImpresorTipo | null>(initial?.p10_impresor ?? null);
  const [p11, setP11] = useState(initial?.p11_proveedor_impresion ?? "");

  // Solución digital (12-14)
  const [p12, setP12] = useState(initial?.p12_seguridad_digital ?? "");
  const [p13, setP13] = useState(initial?.p13_herramientas ?? "");
  const [p14, setP14] = useState<DesarrolloTipo | null>(initial?.p14_desarrollo ?? null);
  const [p14prov, setP14prov] = useState(initial?.p14_proveedor_desarrollo ?? "");

  // Próximos pasos (15-16)
  const [p15, setP15] = useState<ProximoPaso[]>(initial?.p15_proximos_pasos ?? []);
  const [p16, setP16] = useState<CanalContacto[]>(initial?.p16_canal_contacto ?? []);

  // Cierre
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [fecha, setFecha] = useState(initial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [tarjetaFile, setTarjetaFile] = useState<File | null>(null);
  const [tarjetaPreview, setTarjetaPreview] = useState<string | null>(initial?.tarjeta_url ?? null);

  // Cargar países
  useEffect(() => {
    sb.from("paises").select("*").order("nombre").then(({ data }) => setPaises((data ?? []) as Pais[]));
  }, [sb]);

  // Cerrar dropdowns al click afuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!paisWrapRef.current?.contains(e.target as Node)) setShowPaisSugs(false);
      if (!partWrapRef.current?.contains(e.target as Node)) setShowPartSugs(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Buscar participantes UINL (debounce simple por largo > 2)
  useEffect(() => {
    if (lockedParticipante) return;
    if (participanteId) return; // ya hay uno seleccionado
    const q = partQuery.trim();
    if (q.length < 2) { setPartSugs([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const term = quitarAcentos(q.toLowerCase());
      const { data } = await sb
        .from("participantes")
        .select("id,nombre_completo,pais_id,pais_label,email,telefono,organizacion,cargo_principal")
        .ilike("search_text", `%${term}%`)
        .limit(8);
      if (alive) setPartSugs((data ?? []) as any);
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [partQuery, participanteId, sb, lockedParticipante]);

  const sugerenciasPais = useMemo(() => {
    if (!paises) return [];
    const q = paisQuery.trim().toLowerCase();
    if (!q) return paises.slice(0, 10);
    return paises.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 10);
  }, [paisQuery, paises]);

  function pickParticipante(p: typeof partSugs[number]) {
    setParticipanteId(p.id);
    setPartQuery(p.nombre_completo);
    setShowPartSugs(false);
    if (p.pais_id) { setPaisId(p.pais_id); setPaisQuery(p.pais_label ?? ""); setPaisLabel(p.pais_label); }
    if (!institucion && p.organizacion) setInstitucion(p.organizacion);
    if (!contactoNombre) setContactoNombre(p.nombre_completo);
    if (!cargo && p.cargo_principal) setCargo(p.cargo_principal);
    if (!email && p.email) setEmail(p.email);
    if (!telefono && p.telefono) setTelefono(p.telefono);
  }
  function clearParticipante() {
    if (lockedParticipante) return;
    setParticipanteId(null);
    setPartQuery("");
  }

  function pickPais(p: Pais) {
    setPaisId(p.id);
    setPaisLabel(p.nombre);
    setPaisQuery(p.nombre);
    setShowPaisSugs(false);
    const prefix = codigoPais(p.id);
    if (prefix && !telefono.trim()) setTelefono(prefix + " ");
  }
  function clearPais() {
    setPaisId(null);
    setPaisLabel(null);
    setPaisQuery("");
  }

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  }

  function onTarjetaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setTarjetaFile(f);
    if (f) setTarjetaPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactoNombre.trim()) { setErr("El nombre del contacto es obligatorio"); return; }
    setErr(null);
    setBusy(true);
    try {
      const finalPaisLabel = paisId ? paisLabel : (paisQuery.trim() || null);
      await onSubmit({
        participante_id: participanteId,
        institucion: institucion.trim() || null,
        contacto_nombre: contactoNombre.trim(),
        cargo: cargo.trim() || null,
        pais_id: paisId,
        pais_label: finalPaisLabel,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        p1_notarios_aprox: p1,
        p2_emite_formularios: p2,
        p3_lineas_formularios: p3,
        p4_sistema_emision: p4,
        p5_falsificaciones: p5,
        p6_riesgos: p6.trim() || null,
        p7_seguridad_fisica: p7.trim() || null,
        p8_consumo_folios: p8.trim() || null,
        p9_modalidad_compra: p9,
        p10_impresor: p10,
        p11_proveedor_impresion: p11.trim() || null,
        p12_seguridad_digital: p12.trim() || null,
        p13_herramientas: p13.trim() || null,
        p14_desarrollo: p14,
        p14_proveedor_desarrollo: p14prov.trim() || null,
        p15_proximos_pasos: p15,
        p16_canal_contacto: p16,
        observaciones: observaciones.trim() || null,
        fecha,
        tarjeta_file: tarjetaFile,
        tarjeta_url: tarjetaPreview && !tarjetaFile ? tarjetaPreview : null
      });
    } catch (e: any) {
      setErr(e?.message ?? "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Vínculo participante UINL */}
      {!lockedParticipante && (
        <section ref={partWrapRef} className="card card-pad">
          <label className="label mb-1 block">¿Está en la lista UINL? (opcional)</label>
          <div className="relative">
            <input
              value={partQuery}
              onChange={e => { setPartQuery(e.target.value); setParticipanteId(null); setShowPartSugs(true); }}
              onFocus={() => setShowPartSugs(true)}
              placeholder="Buscar por nombre…"
              className="input pr-9"
              disabled={!!participanteId}
            />
            {participanteId && (
              <button type="button" onClick={clearParticipante} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label="Quitar vínculo">×</button>
            )}
          </div>
          {showPartSugs && partSugs.length > 0 && !participanteId && (
            <ul className="mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lift">
              {partSugs.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pickParticipante(p)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-brand-50"
                  >
                    <span className="font-medium text-ink">{p.nombre_completo}</span>
                    <span className="text-[11px] text-slate-500">{p.pais_label ?? ""}{p.cargo_principal ? ` · ${p.cargo_principal}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {participanteId && (
            <p className="mt-1 text-[11px] text-emerald-700">✓ Ligado al participante UINL — los datos se prellenaron</p>
          )}
        </section>
      )}

      {lockedParticipante && (
        <div className="card card-pad bg-brand-50/50 text-sm">
          <div className="label">F.0024-02 ligado a</div>
          <div className="font-semibold text-ink">{lockedParticipante.nombre_completo}</div>
        </div>
      )}

      {/* CABECERA */}
      <section className="space-y-3">
        <h2 className="app-h2">Datos del contacto</h2>
        <div>
          <label className="label mb-1 block">Institución</label>
          <input value={institucion} onChange={e => setInstitucion(e.target.value)} placeholder="Colegio de Notarios de…" className="input" />
        </div>
        <div>
          <label className="label mb-1 block">Contacto *</label>
          <input value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Nombre y apellido" className="input" autoFocus={!lockedParticipante} />
        </div>
        <div>
          <label className="label mb-1 block">Cargo</label>
          <input value={cargo} onChange={e => setCargo(e.target.value)} className="input" />
        </div>

        <div ref={paisWrapRef} className="relative">
          <label className="label mb-1 block">País</label>
          <div className="relative">
            <input
              value={paisQuery}
              onChange={e => { setPaisQuery(e.target.value); setPaisId(null); setShowPaisSugs(true); }}
              onFocus={() => setShowPaisSugs(true)}
              placeholder="Buscar país…"
              className="input pr-9"
            />
            {paisQuery && (
              <button type="button" onClick={clearPais} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label="Limpiar país">×</button>
            )}
          </div>
          {showPaisSugs && sugerenciasPais.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lift">
              {sugerenciasPais.map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => pickPais(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50">
                    <span className="text-ink">{p.nombre}</span>
                    <span className="text-[11px] uppercase tracking-smallcaps text-slate-400">{p.continente ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ej@dominio.com" className="input" />
          </div>
          <div>
            <label className="label mb-1 block">Cel</label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+591…" className="input num" />
          </div>
        </div>
      </section>

      <Divisor titulo="Datos institucionales generales" />

      {/* P1 */}
      <Pregunta numero={1} texto="¿Cuántos notarios hay aproximadamente en el país?">
        <input type="number" min={0} value={p1 ?? ""} onChange={e => setP1(e.target.value === "" ? null : parseInt(e.target.value, 10))} className="input num" />
      </Pregunta>

      {/* P2 */}
      <Pregunta numero={2} texto="¿Su institución es quien emite los formularios notariales?">
        <BoolRadio value={p2} onChange={setP2} />
      </Pregunta>

      {/* P3 */}
      <Pregunta numero={3} texto="¿Cuántas líneas de formularios utilizan actualmente?" opcional>
        <input type="number" min={0} value={p3 ?? ""} onChange={e => setP3(e.target.value === "" ? null : parseInt(e.target.value, 10))} className="input num" />
      </Pregunta>

      {/* P4 */}
      <Pregunta numero={4} texto="¿Es un sistema de emisión…?">
        <ChipsRadio<SistemaEmision>
          value={p4}
          onChange={setP4}
          options={[
            { v: "fisico", l: "100% físico" },
            { v: "digital", l: "100% digital" },
            { v: "mixto", l: "Mixto" }
          ]}
        />
      </Pregunta>

      <Divisor titulo="Seguridad documental" />

      {/* P5 */}
      <Pregunta numero={5} texto="¿Han detectado casos de falsificación o adulteración en el último año?">
        <BoolRadio value={p5} onChange={setP5} />
      </Pregunta>

      {/* P6 */}
      <Pregunta numero={6} texto="¿Dónde identifican hoy los mayores riesgos u oportunidades de mejora en su proceso?">
        <textarea value={p6} onChange={e => setP6(e.target.value)} rows={3} className="input resize-none" />
      </Pregunta>

      <Divisor titulo="Solución física" />

      {/* P7 */}
      <Pregunta numero={7} texto="¿Qué características de seguridad incorporan actualmente en formulario físico?">
        <textarea value={p7} onChange={e => setP7(e.target.value)} rows={2} className="input resize-none" />
      </Pregunta>

      {/* P8 */}
      <Pregunta numero={8} texto="¿Cuál es el consumo aproximado mensual/anual de folios?">
        <input value={p8} onChange={e => setP8(e.target.value)} placeholder="ej: 250.000 folios/año" className="input" />
      </Pregunta>

      {/* P9 */}
      <Pregunta numero={9} texto="¿Qué modalidad de compra utilizan?">
        <ChipsRadio<ModalidadCompra>
          value={p9}
          onChange={setP9}
          options={[
            { v: "compra_directa", l: "Compra directa" },
            { v: "licitacion_publica", l: "Licitación pública" },
            { v: "otro", l: "Otro" }
          ]}
        />
      </Pregunta>

      {/* P10 */}
      <Pregunta numero={10} texto="¿La impresión la realiza una entidad estatal o una empresa privada?">
        <ChipsRadio<ImpresorTipo>
          value={p10}
          onChange={setP10}
          options={[
            { v: "estatal", l: "Estatal" },
            { v: "privada", l: "Privada" },
            { v: "mixto", l: "Mixto" }
          ]}
        />
      </Pregunta>

      {/* P11 */}
      <Pregunta numero={11} texto="¿Quién es su proveedor actual de impresión de formularios?" opcional>
        <input value={p11} onChange={e => setP11(e.target.value)} className="input" />
      </Pregunta>

      <Divisor titulo="Solución digital" />

      {/* P12 */}
      <Pregunta numero={12} texto="¿Qué medidas de seguridad digital tienen implementadas?">
        <textarea value={p12} onChange={e => setP12(e.target.value)} rows={2} className="input resize-none" />
      </Pregunta>

      {/* P13 */}
      <Pregunta numero={13} texto="¿Qué herramientas o software utilizan para la gestión de documentos digitales nativos?">
        <textarea value={p13} onChange={e => setP13(e.target.value)} rows={2} className="input resize-none" />
      </Pregunta>

      {/* P14 */}
      <Pregunta numero={14} texto="¿El desarrollo es propio o externo?">
        <ChipsRadio<DesarrolloTipo>
          value={p14}
          onChange={setP14}
          options={[
            { v: "propio", l: "Propio" },
            { v: "externo", l: "Externo" }
          ]}
        />
        {p14 === "externo" && (
          <input
            value={p14prov}
            onChange={e => setP14prov(e.target.value)}
            placeholder="Proveedor (opcional)"
            className="input mt-2"
          />
        )}
      </Pregunta>

      <Divisor titulo="Próximos pasos" />

      {/* P15 multi */}
      <Pregunta numero={15} texto="¿Qué tipo de contacto prefieren para la siguiente etapa?">
        <div className="flex flex-wrap gap-2">
          {PROXIMOS.map(o => {
            const active = p15.includes(o.v);
            return (
              <button
                type="button"
                key={o.v}
                onClick={() => setP15(toggle(p15, o.v))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 active:bg-brand-50"
                }`}
              >{active ? "✓ " : ""}{o.l}</button>
            );
          })}
        </div>
      </Pregunta>

      {/* P16 multi */}
      <Pregunta numero={16} texto="¿Cuál es el mejor canal de contacto?">
        <div className="flex flex-wrap gap-2">
          {CANALES.map(o => {
            const active = p16.includes(o.v);
            return (
              <button
                type="button"
                key={o.v}
                onClick={() => setP16(toggle(p16, o.v))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 active:bg-brand-50"
                }`}
              >{active ? "✓ " : ""}{o.l}</button>
            );
          })}
        </div>
      </Pregunta>

      <Divisor titulo="Cierre" />

      <div>
        <label className="label mb-1 block">Observaciones</label>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={4} className="input resize-none" placeholder="Detalles, pendientes, contexto…" />
      </div>

      <div>
        <label className="label mb-1 block">Tarjeta personal (foto)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onTarjetaChange}
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
        />
        {tarjetaPreview && (
          <div className="mt-2">
            <img src={tarjetaPreview} alt="Tarjeta" className="max-h-40 rounded-lg border border-slate-200 object-cover" />
            {tarjetaFile && <p className="mt-1 text-[11px] text-slate-500">Se subirá al guardar.</p>}
          </div>
        )}
      </div>

      <div>
        <label className="label mb-1 block">Fecha</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input num w-44" />
      </div>

      {err && <div className="card card-pad text-sm text-red-600">⚠ {err}</div>}

      <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-50">
        {busy ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

// ============================================================================
// Subcomponentes presentacionales
// ============================================================================

function Divisor({ titulo }: { titulo: string }) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <h3 className="text-[11px] font-semibold uppercase tracking-smallcaps text-brand-700">{titulo}</h3>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}

function Pregunta({ numero, texto, opcional, children }: { numero: number; texto: string; opcional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="num text-[11px] font-bold text-brand-500">{numero}.</span>
        <label className="block text-sm text-ink">
          {texto}
          {opcional && <span className="ml-1 text-[10px] uppercase tracking-smallcaps text-slate-400">opcional</span>}
        </label>
      </div>
      {children}
    </div>
  );
}

function BoolRadio({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, l: "Sí" },
        { v: false, l: "No" }
      ].map(o => {
        const active = value === o.v;
        return (
          <button
            type="button"
            key={String(o.v)}
            onClick={() => onChange(active ? null : o.v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 active:bg-brand-50"
            }`}
          >{o.l}</button>
        );
      })}
    </div>
  );
}

function ChipsRadio<T extends string>({ value, onChange, options }: { value: T | null; onChange: (v: T | null) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = value === o.v;
        return (
          <button
            type="button"
            key={o.v}
            onClick={() => onChange(active ? null : o.v)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 active:bg-brand-50"
            }`}
          >{o.l}</button>
        );
      })}
    </div>
  );
}
