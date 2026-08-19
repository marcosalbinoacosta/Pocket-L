"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { codigoPais } from "@/lib/country-codes";
import FotoPicker from "@/components/ui/FotoPicker";
import type { Participante, Pais } from "@/lib/types";

export interface ParticipanteFormValues {
  nombre_completo: string;
  pais_id: string | null;
  pais_label: string | null;
  continente: string | null;
  email: string | null;
  telefono: string | null;
  organizacion: string | null;
  cargo_principal: string | null;
  roles_raw: string | null;
  prioridad_score: number;
  notas_publicas: string | null;
  foto_url: string | null;
}

interface Props {
  initial?: Partial<Participante>;
  submitLabel: string;
  onSubmit: (v: ParticipanteFormValues) => Promise<void>;
}

export default function ParticipanteForm({ initial, submitLabel, onSubmit }: Props) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [paises, setPaises] = useState<Pais[] | null>(null);
  const [paisQuery, setPaisQuery] = useState(initial?.pais_label ?? "");
  const [paisId, setPaisId] = useState<string | null>(initial?.pais_id ?? null);
  const [paisLabel, setPaisLabel] = useState<string | null>(initial?.pais_label ?? null);
  const [continente, setContinente] = useState<string | null>(initial?.continente ?? null);
  const [showSugs, setShowSugs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [nombre, setNombre] = useState(initial?.nombre_completo ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [organizacion, setOrganizacion] = useState(initial?.organizacion ?? "");
  const [cargo, setCargo] = useState(initial?.cargo_principal ?? "");
  const [rolesRaw, setRolesRaw] = useState(initial?.roles_raw ?? "");
  const [prioridad, setPrioridad] = useState<number>(initial?.prioridad_score ?? 0);
  const [notasPub, setNotasPub] = useState(initial?.notas_publicas ?? "");
  const [fotoUrl, setFotoUrl] = useState<string | null>(initial?.foto_url ?? null);

  useEffect(() => {
    sb.from("paises").select("*").order("nombre").then(({ data }) => setPaises((data ?? []) as Pais[]));
  }, [sb]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setShowSugs(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const sugerencias = useMemo(() => {
    if (!paises) return [];
    const q = paisQuery.trim().toLowerCase();
    if (!q) return paises.slice(0, 10);
    return paises.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 10);
  }, [paisQuery, paises]);

  function pickPais(p: Pais) {
    setPaisId(p.id);
    setPaisLabel(p.nombre);
    setPaisQuery(p.nombre);
    setContinente(p.continente);
    setShowSugs(false);
    // prefill teléfono con el prefijo del país (sólo si el campo está vacío)
    const prefix = codigoPais(p.id);
    if (prefix && !telefono.trim()) setTelefono(prefix + " ");
  }

  function clearPais() {
    setPaisId(null);
    setPaisLabel(null);
    setPaisQuery("");
    setContinente(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    setErr(null);
    setBusy(true);
    try {
      // Si tipearon un país que no está en la lista, lo guardamos sólo como label libre
      const finalPaisLabel = paisId ? paisLabel : (paisQuery.trim() || null);
      await onSubmit({
        nombre_completo: nombre.trim(),
        pais_id: paisId,
        pais_label: finalPaisLabel,
        continente,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        organizacion: organizacion.trim() || null,
        cargo_principal: cargo.trim() || null,
        roles_raw: rolesRaw.trim() || null,
        prioridad_score: Number.isFinite(prioridad) ? Math.max(0, Math.min(100, prioridad)) : 0,
        notas_publicas: notasPub.trim() || null,
        foto_url: fotoUrl
      });
    } catch (e: any) {
      setErr(e?.message ?? "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FotoPicker value={fotoUrl} onChange={setFotoUrl} nombre={nombre} />

      <div>
        <label className="label mb-1 block">Nombre completo *</label>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Juan Pérez"
          className="input"
          autoFocus
        />
      </div>

      <div ref={wrapRef} className="relative">
        <label className="label mb-1 block">País</label>
        <div className="relative">
          <input
            value={paisQuery}
            onChange={e => { setPaisQuery(e.target.value); setPaisId(null); setShowSugs(true); }}
            onFocus={() => setShowSugs(true)}
            placeholder="Buscar país…"
            className="input pr-9"
          />
          {paisQuery && (
            <button
              type="button"
              onClick={clearPais}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100"
              aria-label="Limpiar país"
            >×</button>
          )}
        </div>
        {showSugs && sugerencias.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lift">
            {sugerencias.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickPais(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
                >
                  <span className="text-ink">{p.nombre}</span>
                  <span className="text-[11px] uppercase tracking-smallcaps text-slate-400">{p.continente ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!paisId && paisQuery.trim() && (
          <p className="mt-1 text-[11px] text-slate-500">
            Si no aparece en la lista se guarda como texto libre (sin contexto comercial).
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ej@dominio.com"
            className="input"
          />
        </div>
        <div>
          <label className="label mb-1 block">Teléfono</label>
          <input
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="+591…"
            className="input num"
          />
        </div>
      </div>

      <div>
        <label className="label mb-1 block">Organización</label>
        <input
          value={organizacion}
          onChange={e => setOrganizacion(e.target.value)}
          placeholder="Colegio de Notarios de…"
          className="input"
        />
      </div>

      <div>
        <label className="label mb-1 block">Cargo principal</label>
        <input
          value={cargo}
          onChange={e => setCargo(e.target.value)}
          placeholder="Presidente CAAm"
          className="input"
        />
      </div>

      <div>
        <label className="label mb-1 block">Roles UINL</label>
        <textarea
          value={rolesRaw}
          onChange={e => setRolesRaw(e.target.value)}
          placeholder="Texto libre con todos los roles (CAAm: Presidente; CDH: Miembro; ...)"
          rows={3}
          className="input resize-none"
        />
      </div>

      <div>
        <label className="label mb-1 block">Prioridad (0-100)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={prioridad}
          onChange={e => setPrioridad(parseInt(e.target.value || "0", 10))}
          className="input num w-28"
        />
      </div>

      <div>
        <label className="label mb-1 block">Notas públicas</label>
        <textarea
          value={notasPub}
          onChange={e => setNotasPub(e.target.value)}
          placeholder="Información visible a todo el equipo"
          rows={3}
          className="input resize-none"
        />
      </div>

      {err && <div className="card card-pad text-sm text-red-600">⚠ {err}</div>}

      <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-50">
        {busy ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
