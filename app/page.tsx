"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRepresentante } from "@/lib/auth";

export default function Home() {
  const r = useRouter();
  useEffect(() => {
    const rep = getRepresentante();
    r.replace(rep ? "/inicio" : "/pin");
  }, [r]);
  return (
    <main className="app-shell">
      <div className="shimmer h-12 rounded-xl" />
    </main>
  );
}
