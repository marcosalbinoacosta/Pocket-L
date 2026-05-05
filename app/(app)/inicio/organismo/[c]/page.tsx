"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import EstadoBadge from "@/components/ui/EstadoBadge";

interface OrganismoInfo { codigo: string; nombre: string; tipo: string }
interface MiembroFila {
  id: string;
  nombre_completo: string;
  pais_label: string | null;
  cargo_en_organismo: string | null;
  cargo_principal: string | null;
  estado: "pendiente" | "contactado" | "no_interesado";
  alta_prioridad: boolean;
  peso: number;
}

const PESO: Record<string, number> = {
  "Presidente": 40, "Presidenta": 40,
  "Vicepresidente": 25, "Vicepresidenta": 25,
  "Secretario": 15, "Secretaria": 15,
  "Tesorero": 12, "Tesorera": 12,
  "Responsable": 30,
  "Miembro": 5
};

export default function InicioOrganismoPage() {
  const params = useParams<{ c: string }>();
  const router = useRouter();
  const codigo = decodeURIComponent(params?.c ?? "");
  const [info, setInfo] = useState<OrganismoInfo | null>(null);
  const [miembros, setMiembros] = useState<MiembroFila[] | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from("comisiones").select("*").eq("codigo", codigo).single()
      .then(({ data }) => setInfo(data as OrganismoInfo));

    sb.from("participaciones")
      .select("cargo, participante:participantes!inner(id,nombre_completo,pais_label,cargo_principal,contacto:contactos(estado,alta_prioridad))")
      .eq("comision_codigo", codigo)
      .then(({ data }) => {
        const filas: MiembroFila[] = (data ?? []).map((row: any) => {
          const p = Array.isArray(row.participante) ? row.participante[0] : row.participante;
          const contacto = Array.isArray(p?.contacto) ? p.contacto[0] : p?.contacto;
          return {
            id: p.id,
            nombre_completo: p.nombre_completo,
            pais_label: p.pais_label,
            cargo_en_organismo: row.cargo,
            cargo_principal: p.cargo_principal,
            estado: contacto?.estado ?? "pendiente",
            alta_prioridad: contacto?.alta_prioridad ?? false,
            peso: PESO[row.cargo ?? "Miembro"] ?? 5
          };
        });
        filas.sort((a, b) => b.peso - a.peso || a.nombre_completo.localeCompare(b.nombre_completo));
        setMiembros(filas);
      });
  }, [codigo]);

  const tipoLabel = info?.tipo === "consejo" ? "Consejo"
                  : info?.tipo === "comision" ? "Comisión"
                  : info?.tipo === "grupo_trabajo" ? "Grupo de Trabajo"
                  : info?.tipo === "asamblea" ? "Asamblea" : "";

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>

      <header className="card card-pad">
        <div className="label">{tipoLabel} · {codigo}</div>
        <h1 className="app-h1 mt-1">{info?.nombre ?? "—"}</h1>
        <p className="num mt-1 text-xs text-slate-500">
          {miembros?.length ?? "—"} miembros
        </p>
      </header>

      <div className="mt-4 space-y-2">
        {miembros === null && [0,1,2,3].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
        {miembros?.length === 0 && <div className="ph py-6">Sin miembros registrados</div>}
        {miembros?.map(m => (
          <Link key={m.id} href={`/contacto/${m.id}`} className="card card-hover block p-3 active:bg-brand-50">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{m.nombre_completo}</div>
                <div className="text-xs text-slate-500 truncate">{m.pais_label}</div>
                {m.cargo_en_organismo && (
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-smallcaps text-gold-600 truncate">
                    {m.cargo_en_organismo} {codigo}
                  </div>
                )}
              </div>
              <EstadoBadge estado={m.estado} alta={m.alta_prioridad} />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
