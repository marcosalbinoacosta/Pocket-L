"use client";
import { useRouter } from "next/navigation";
import ParticipanteForm, { ParticipanteFormValues } from "@/components/ParticipanteForm";

export default function AgregarPage() {
  const router = useRouter();

  async function onSubmit(v: ParticipanteFormValues) {
    const res = await fetch("/api/participantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "No se pudo crear el participante");
    }
    const { id } = await res.json();
    router.push(`/contacto/${id}`);
  }

  return (
    <main className="app-shell">
      <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2">← volver</button>
      <h1 className="app-h1 mb-1">Nuevo participante</h1>
      <p className="mb-4 text-sm text-slate-500">
        Completá lo que tengas. El nombre es lo único obligatorio; el resto se puede editar después.
      </p>
      <ParticipanteForm submitLabel="Crear participante" onSubmit={onSubmit} />
    </main>
  );
}
