"use client";
import { useState } from "react";

export default function PinPad({ onSubmit, error }: { onSubmit: (pin: string) => void; error?: string | null }) {
  const [pin, setPin] = useState("");

  function press(d: string) {
    if (d === "←") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) onSubmit(next);
  }

  const keys = ["1","2","3","4","5","6","7","8","9","","0","←"];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition-colors ${pin.length > i ? "bg-gold-500 shadow-[0_0_0_2px_rgba(226,201,136,0.3)]" : "bg-white/15"}`}
          />
        ))}
      </div>
      {error && <div className="text-sm font-medium text-gold-300">{error}</div>}
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {keys.map((k, i) => k === "" ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => press(k)}
            className="num h-16 rounded-xl bg-white/10 text-2xl font-semibold text-white shadow-soft backdrop-blur-sm active:bg-white/20"
          >{k}</button>
        ))}
      </div>
    </div>
  );
}
