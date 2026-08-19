"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import ParticipantCard from "@/components/ui/ParticipantCard";
import type { ParticipanteConEstado } from "@/lib/types";

export default function InicioContinentePage() {
  const params = useParams<{ c: string }>();
  const router = useRouter();
  const continente = decodeURIComponent(params?.c ?? "");
  const [items, setItems] = useState<ParticipanteConEstado[] | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from("participantes")
      .select("id,nombre_completo,pais_label,continente,organizacion,cargo_principal,roles_raw,prioridad_score,foto_url,contacto:contactos(estado,alta_prioridad,updated_at,representante_id)")
      .eq("continente", continente)
      .order("prioridad_score", { ascending: false })
      .order("nombre_completo")
      .then(({ data }) => {
        const norm = (data ?? []).map((r: any) => ({
          ...r,
          contacto: Array.isArray(r.contacto) ? r.contacto[0] ?? null : r.contacto
        })) as ParticipanteConEstado[];
        setItems(norm);
      });
  }, [continente]);

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>
      <h1 className="app-h1 mb-1">{continente}</h1>
      <p className="num mb-4 text-xs text-slate-500">{items?.length ?? "—"} participantes</p>

      <div className="space-y-2">
        {items === null && [0,1,2,3].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
        {items?.map(p => <ParticipantCard key={p.id} p={p} />)}
        {items?.length === 0 && <div className="ph py-6">Sin participantes en {continente}</div>}
      </div>
    </main>
  );
}
