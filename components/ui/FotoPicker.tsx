"use client";
/**
 * Selector de foto para un participante.
 *
 * En el celular abre cámara o galería (no forzamos `capture` para que el rep
 * pueda elegir una foto que ya tenga). Antes de subir la reescala en el propio
 * navegador: una foto de cámara son 3-5 MB y como avatar alcanza con ~60 KB —
 * importa por el wifi del congreso y por lo que después tarda cada lista en
 * cargar en la mano de cuatro personas a la vez.
 */
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

const BUCKET = "fotos-participantes";
const LADO_MAX = 640;

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  nombre?: string;
}

async function reescalar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
      "image/jpeg",
      0.85
    );
  });
}

export default function FotoPicker({ value, onChange, nombre }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const iniciales = (nombre || "")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Ese archivo no es una imagen"); return; }

    setErr(null);
    setSubiendo(true);
    try {
      const blob = await reescalar(file);
      const key = `subidas/${crypto.randomUUID()}.jpg`;
      const sb = supabaseBrowser();
      const { error } = await sb.storage.from(BUCKET).upload(key, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      onChange(sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <label className="label mb-1 block">Foto</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-50 active:opacity-80 disabled:opacity-50"
          aria-label={value ? "Cambiar foto" : "Agregar foto"}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-lg font-bold text-slate-300">
              {iniciales || "+"}
            </span>
          )}
          {subiendo && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] font-semibold uppercase tracking-smallcaps text-brand-700">
              Subiendo…
            </span>
          )}
        </button>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="btn-secondary !py-2 !text-sm disabled:opacity-50"
          >
            {value ? "Cambiar foto" : "Sacar o elegir foto"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="btn-ghost !py-1 !text-xs !text-slate-500"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={elegir}
        className="hidden"
      />
      {err && <p className="mt-1.5 text-xs text-red-600">⚠ {err}</p>}
    </div>
  );
}
