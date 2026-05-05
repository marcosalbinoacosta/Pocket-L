"use client";
import SearchBar from "@/components/ui/SearchBar";

export default function BuscarPage() {
  return (
    <main className="app-shell">
      <h1 className="app-h1 mb-1">Buscar</h1>
      <p className="mb-4 text-sm text-slate-500">Resultados instantáneos por nombre, país, organización o cargo.</p>
      <SearchBar autoFocus />
    </main>
  );
}
