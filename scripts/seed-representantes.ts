/**
 * Crea/actualiza los 4 representantes con sus PINs.
 *
 * EDITAR ANTES DE CORRER: cambiá los nombres y PINs en `REPS`.
 *
 * Uso: npm run seed:reps
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ⚠️ EDITÁ ESTO antes de correr el seed
const REPS: { nombre: string; pin: string; color: string }[] = [
  { nombre: "Marcos Acosta", pin: "1234", color: "#82399F" },
  { nombre: "Carlos Velez",  pin: "4567", color: "#C9A961" }
];

(async () => {
  for (const r of REPS) {
    const pin_hash = await bcrypt.hash(r.pin, 10);
    const { error } = await sb.from("representantes")
      .upsert({ nombre: r.nombre, pin_hash, color: r.color, activo: true }, { onConflict: "nombre" });
    if (error) console.error("  ✗", r.nombre, error.message);
    else console.log(`  ✓ ${r.nombre}  (PIN ${r.pin})`);
  }
  console.log("\nGuardá los PINs en un lugar seguro. Después podés rotarlos editando este archivo y corriendo de nuevo.");
})();
