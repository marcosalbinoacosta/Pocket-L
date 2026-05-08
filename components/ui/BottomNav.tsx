"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/inicio",    label: "Inicio",  icon: "◎" },
  { href: "/buscar",    label: "Buscar",  icon: "⌕" },
  { href: "/paises",    label: "Países",  icon: "◈" },
  { href: "/stand",     label: "Stand",   icon: "▣" },
  { href: "/dashboard", label: "Equipo",  icon: "▤" }
];

export default function BottomNav() {
  const path = usePathname() || "";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-cream/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 ${active ? "text-brand-700" : "text-slate-500"}`}
              >
                <span className={`text-xl ${active ? "text-brand-500" : ""}`}>{t.icon}</span>
                <span className="text-[11px] font-semibold uppercase tracking-smallcaps">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
