"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import ParticipantCard from "@/components/ui/ParticipantCard";
import type { Pais, ParticipanteConEstado, Organizacion } from "@/lib/types";
import { fmtMillones, fmtNumero, nivelSeguridad, segLabel, segColor } from "@/lib/format";

type PaisConRollup = Pais & { cantidad_notarios_total: number | null; consumo_anual_total: number | null; cantidad_organizaciones: number };

export default function PaisDetallePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [pais, setPais] = useState<PaisConRollup | null>(null);
  const [items, setItems] = useState<ParticipanteConEstado[] | null>(null);
  const [colegios, setColegios] = useState<Organizacion[] | null>(null);

  useEffect(() => {
    if (!id) return;
    const sb = supabaseBrowser();
    sb.from("v_paises_con_organizaciones").select("*").eq("id", id).single()
      .then(({ data }) => setPais(data as PaisConRollup));
    sb.from("organizaciones").select("*").eq("pais_id", id).order("consumo_anual", { ascending: false, nullsFirst: false })
      .then(({ data }) => setColegios((data ?? []) as Organizacion[]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setItems(null);
    const sb = supabaseBrowser();
    sb.from("participantes")
      .select("id,nombre_completo,pais_label,continente,organizacion,cargo_principal,roles_raw,prioridad_score,foto_url,contacto:contactos(estado,alta_prioridad,updated_at,representante_id)")
      .eq("pais_id", id)
      .order("prioridad_score", { ascending: false })
      .order("nombre_completo")
      .then(({ data }) => {
        const norm = (data ?? []).map((r: any) => ({
          ...r,
          contacto: Array.isArray(r.contacto) ? r.contacto[0] ?? null : r.contacto
        })) as ParticipanteConEstado[];
        setItems(norm);
      });
  }, [id]);

  if (!pais) {
    return <main className="app-shell"><div className="shimmer h-32 rounded-xl" /></main>;
  }

  const seg = nivelSeguridad(pais.caracteristicas_tecnicas);
  const consumoTotal = pais.consumo_anual_total ?? pais.consumo_anual;
  const notariosTotal = pais.cantidad_notarios_total ?? pais.cantidad_notarios;
  const consumoPerNotario = consumoTotal && notariosTotal
    ? Math.round(consumoTotal / notariosTotal)
    : null;

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>

      {/* aviso de datos por confirmar */}
      {pais.notas_comerciales?.toLowerCase().startsWith("datos por confirmar") && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="label !text-amber-700">Datos por confirmar</div>
          <div className="mt-0.5">{pais.notas_comerciales}</div>
        </div>
      )}

      {/* header con nombre + badge seguridad */}
      <header className="card card-pad">
        <div className="label">{pais.continente ?? "—"} · {pais.idioma_oficial ?? ""}</div>
        <h1 className="app-h1 mt-1">{pais.nombre}</h1>
        {pais.organizacion_notarial && (
          <div className="mt-1 text-sm text-slate-600">{pais.organizacion_notarial}</div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-smallcaps ${segColor(seg)}`}>
            {segLabel(seg)}
          </span>
          {pais.foja_tipo && (
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-smallcaps text-slate-600">
              {pais.foja_tipo}
            </span>
          )}
          {pais.miembro_desde && (
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-smallcaps text-slate-600">
              UINL desde {pais.miembro_desde}
            </span>
          )}
        </div>
      </header>

      {/* grid de métricas comerciales — si hay organizaciones (país federal), el total es la suma real */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Consumo anual"   value={fmtMillones(consumoTotal)} unit="fojas" big />
        <Metric label="Notarios"        value={fmtNumero(notariosTotal)} />
        <Metric label="Habitantes"      value={fmtMillones(pais.cantidad_habitantes)} />
        <Metric label="Fojas/notario"   value={consumoPerNotario != null ? fmtNumero(consumoPerNotario) : "—"} unit="x año" />
      </div>
      {pais.cantidad_organizaciones > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Suma de {pais.cantidad_organizaciones} colegios estatales, no el agregado nacional genérico.
        </p>
      )}

      {/* extras */}
      {(pais.impresor_fojas || pais.consejo_emisor_fojas != null) && (
        <div className="mt-3 card card-pad text-xs">
          {pais.impresor_fojas && (
            <div className="flex justify-between py-1">
              <span className="label">Impresor</span>
              <span className="font-medium text-ink">{pais.impresor_fojas}</span>
            </div>
          )}
          {pais.consejo_emisor_fojas != null && (
            <div className="flex justify-between py-1">
              <span className="label">Consejo emisor</span>
              <span className="font-medium text-ink">{pais.consejo_emisor_fojas ? "Sí" : "No"}</span>
            </div>
          )}
        </div>
      )}

      {/* ángulo comercial sugerido */}
      {seg === "nula" && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <div className="label mb-0.5 !text-rose-700">Oportunidad alta</div>
          País sin papel de seguridad implementado. Consumo de {fmtMillones(pais.consumo_anual)} fojas/año.
        </div>
      )}
      {seg === "media" && pais.consumo_anual && pais.consumo_anual > 10_000_000 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="label mb-0.5 !text-amber-700">Oportunidad media</div>
          Volumen alto ({fmtMillones(pais.consumo_anual)} fojas) con esquema híbrido — potencial de upgrade a digital end-to-end.
        </div>
      )}

      {/* colegios estatales (países federales, ej. México) */}
      {colegios !== null && colegios.length > 0 && (
        <>
          <div className="mt-6 mb-2 flex items-end justify-between">
            <h2 className="app-h2">Colegios</h2>
            <span className="label">{colegios.length}</span>
          </div>
          <div className="card overflow-hidden">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Colegio</th>
                  <th className="text-right">Notarios</th>
                  <th className="text-right">Consumo</th>
                </tr>
              </thead>
              <tbody>
                {colegios.map(o => (
                  <tr key={o.id} className="cursor-pointer">
                    <td>
                      <Link href={`/colegios/${o.id}`} className="block">
                        <div className="font-semibold text-ink">{o.subdivision ?? o.nombre}</div>
                        {o.autoridad && <div className="text-[11px] text-slate-400">{o.autoridad}</div>}
                        {o.tipo === "consejo_nacional" && (
                          <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-smallcaps text-slate-500">
                            Coordina, no compra
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="num text-right text-ink">{fmtNumero(o.cantidad_notarios)}</td>
                    <td className="num text-right text-ink">{fmtMillones(o.consumo_anual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* inscriptos */}
      <div className="mt-6 mb-2 flex items-end justify-between">
        <h2 className="app-h2">Inscriptos al congreso</h2>
        <span className="label">{items?.length ?? "—"}</span>
      </div>
      <div className="space-y-2">
        {items === null && [0,1,2].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
        {items?.length === 0 && <div className="ph py-5">Sin inscriptos de {pais.nombre}</div>}
        {items?.map(p => <ParticipantCard key={p.id} p={p} />)}
      </div>
    </main>
  );
}

function Metric({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
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
