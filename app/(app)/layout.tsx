"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/ui/BottomNav";
import { getRepresentante } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!getRepresentante()) r.replace("/pin");
    else setOk(true);
  }, [r]);
  if (!ok) return null;
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
