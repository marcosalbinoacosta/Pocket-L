"use client";
/**
 * Foto que se abre en grande al tocarla.
 *
 * Va solo en la ficha del contacto, no en las listas: ahí la fila entera es el
 * área táctil para abrir la persona, y meterle otra acción adentro hace que
 * tocar donde parece natural haga algo distinto de lo esperado.
 */
import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

export default function FotoAmpliable({ src, alt = "", className = "" }: Props) {
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    document.addEventListener("keydown", onKey);
    // evita que el fondo scrollee detrás del overlay
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={`shrink-0 overflow-hidden rounded-full border border-slate-200 shadow-soft active:opacity-80 ${className}`}
        aria-label="Ver la foto en grande"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setAbierta(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-lift"
          />
          <button
            type="button"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white backdrop-blur active:bg-white/25"
          >
            ×
          </button>
          <p className="absolute bottom-6 left-0 right-0 text-center text-[11px] uppercase tracking-smallcaps text-white/50">
            Tocá para cerrar
          </p>
        </div>
      )}
    </>
  );
}
