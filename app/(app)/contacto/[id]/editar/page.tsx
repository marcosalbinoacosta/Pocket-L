"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import type { Participante } from "@/lib/types";
import ParticipanteForm, { ParticipanteFormValues } from "@/components/ParticipanteForm";

export default function EditarContactoPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Participante | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const sb = supabaseBrowser();
    sb.from("participantes").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error) { setLoadErr(error.message); return; }
      setP(data as Participante);
    });
  }, [id]);

  async function onSubmit(v: ParticipanteFormValues) {
    const res = await fetch(`/api/participantes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "No se pudo guardar");
    }
    router.push(`/contacto/${id}`);
  }

  if (loadErr) return <main className="app-shell"><div className="card card-pad text-sm text-red-600">⚠ {loadErr}</div></main>;
  if (!p) return <main className="app-shell"><div className="shimmer h-32 rounded-xl" /></main>;

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>
      <h1 className="app-h1 mb-4">Editar participante</h1>
      <ParticipanteForm initial={p} submitLabel="Guardar cambios" onSubmit={onSubmit} />
    </main>
  );
}
