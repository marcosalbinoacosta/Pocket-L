"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { getRepresentante } from "@/lib/auth";
import StandContactoForm, { StandFormValues } from "@/components/StandContactoForm";

export default function StandNuevoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const participanteIdParam = params.get("participante");
  const [locked, setLocked] = useState<{ id: string; nombre_completo: string } | null>(null);
  const [initialPart, setInitialPart] = useState<any | null>(null);
  const [ready, setReady] = useState(!participanteIdParam);

  useEffect(() => {
    if (!participanteIdParam) return;
    const sb = supabaseBrowser();
    sb.from("participantes")
      .select("id,nombre_completo,pais_id,pais_label,email,telefono,organizacion,cargo_principal")
      .eq("id", participanteIdParam)
      .single()
      .then(({ data }) => {
        if (data) {
          setLocked({ id: data.id, nombre_completo: data.nombre_completo });
          setInitialPart(data);
        }
        setReady(true);
      });
  }, [participanteIdParam]);

  async function onSubmit(v: StandFormValues) {
    const me = getRepresentante();
    const payload: any = { ...v };
    delete payload.tarjeta_file;
    if (me) payload.recepcionado_por = me.id;
    if (locked) payload.participante_id = locked.id;

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (v.tarjeta_file) fd.append("tarjeta", v.tarjeta_file);

    const res = await fetch("/api/stand", { method: "POST", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "No se pudo guardar el formulario");
    }
    const { id } = await res.json();
    router.push(`/stand/${id}`);
  }

  if (!ready) {
    return <main className="app-shell"><div className="shimmer h-32 rounded-xl" /></main>;
  }

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>
      <h1 className="app-h1 mb-1">Nuevo F.0024-02</h1>
      <p className="mb-4 text-sm text-slate-500">
        Cuestionario de diagnóstico para contactos de stand. Completá lo que tengas; sólo el nombre del contacto es obligatorio.
      </p>
      <StandContactoForm
        submitLabel="Guardar formulario"
        lockedParticipante={locked}
        initial={initialPart ? {
          institucion: initialPart.organizacion ?? null,
          contacto_nombre: initialPart.nombre_completo,
          cargo: initialPart.cargo_principal ?? null,
          pais_id: initialPart.pais_id ?? null,
          pais_label: initialPart.pais_label ?? null,
          email: initialPart.email ?? null,
          telefono: initialPart.telefono ?? null
        } : undefined}
        onSubmit={onSubmit}
      />
    </main>
  );
}
