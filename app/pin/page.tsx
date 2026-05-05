"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PinPad from "@/components/ui/PinPad";
import { loginConPin } from "@/lib/auth";

export default function PinPage() {
  const r = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handle(pin: string) {
    setError(null);
    const rep = await loginConPin(pin);
    if (!rep) { setError("PIN incorrecto"); return; }
    r.replace("/inicio");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-grad px-4 py-10 text-white">
      {/* glow */}
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-300/20 blur-3xl" />

      <div className="relative z-10 mb-10 text-center">
        <div className="mb-2 hand text-4xl text-gold-300">+ latina</div>
        <div className="text-3xl font-black tracking-tight">+LATINA</div>
        <div className="mt-1 text-[11px] uppercase tracking-smallcaps text-gold-300">Congreso UINL</div>
      </div>

      <p className="relative z-10 mb-6 text-sm text-white/70">Ingresá tu PIN de 4 dígitos</p>
      <div className="relative z-10">
        <PinPad onSubmit={handle} error={error} />
      </div>
    </main>
  );
}
