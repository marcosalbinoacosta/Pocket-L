# +LATINA · UINL

PWA mobile-first para gestionar contactos comerciales del equipo de +LATINA durante el Congreso UINL.

## Stack
- Next.js 14 App Router
- Supabase (Postgres + Realtime + RLS)
- Tailwind CSS
- TypeScript

## Setup

### 1. Instalar
```bash
npm install
```

### 2. Crear proyecto Supabase
1. Crear proyecto en https://supabase.com
2. Copiar `URL` y `anon key` y `service_role key`
3. Crear `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

### 3. Crear schema
1. Abrir Supabase → SQL Editor
2. Pegar `scripts/schema.sql` y ejecutar
3. Habilitar Realtime para `contactos` y `notas` (lo hace el script al final con `alter publication`)

### 4. Cargar representantes (PINs)
Editar `scripts/seed-representantes.ts` con los nombres y PINs reales del equipo, luego:
```bash
npm run seed:reps
```

### 5. Importar participantes y países desde Excel
Los `.xlsx` deben estar en la raíz del proyecto (ya están). Después:
```bash
npm run import
```

### 6. Levantar dev
```bash
npm run dev
```
Abrir en celular/escritorio: http://localhost:3000

## Estructura

```
app/
  pin/                          login con PIN
  (app)/                        protegido por sesión local
    inicio/                     navegación por continente
    inicio/[continente]/        listado de un continente
    buscar/                     búsqueda global instantánea
    contacto/[id]/              ficha + estado + notas (realtime)
    dashboard/                  stats del equipo
    yo/                         sesión actual / logout
components/ui/                  SearchBar, BottomNav, EstadoBadge, etc.
lib/
  supabase.ts                   clientes (browser y service)
  types.ts                      tipos del schema
  auth.ts                       login con PIN, sesión en localStorage
  utils.ts                      helpers
scripts/
  schema.sql                    schema completo (correr una vez)
  seed-representantes.ts        crea/actualiza los 4 PINs
  import-excel.ts               carga participantes + países desde xlsx
```

## Decisiones clave

- **Sin `dia_sesion`**: el Excel no trae cronograma confirmado, agrupamos por continente en su lugar.
- **PIN + RLS abierta**: equipo de 4, anon key + RLS lectura/escritura libre. La validación del PIN hace `bcrypt.compare` contra `representantes.pin_hash`.
- **Notas en tabla aparte**: historial real con quién y cuándo (no se sobreescribe).
- **`participaciones` (M:N)**: un participante puede estar en varias comisiones. Permite filtros como "todos los presidentes de CAAm".
- **`prioridad_score`** auto-calculado al importar: presidentes (40), vicepresidentes (25), secretarios (15), miembros (5). Se acumula. Sirve para ordenar listados.
- **`paises` enriquecido** con consumo de fojas, papel de seguridad, cantidad de notarios, etc. — info comercial directa para +LATINA.
- **Realtime** sobre `contactos` y `notas`: cualquier cambio aparece instantáneo en los 4 dispositivos.
- **Offline**: SWR + cache HTTP del SW de Next; mutaciones requieren red. Si llega a fallar mucho, se puede agregar cola con IndexedDB en una v2.

## Rotación de PINs
Editar `scripts/seed-representantes.ts` y volver a correr `npm run seed:reps`. El upsert reemplaza el hash.

## Deploy a Vercel
```bash
npx vercel
```
Configurar env vars en el dashboard de Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(`SUPABASE_SERVICE_ROLE_KEY` no va a Vercel — se usa solo en scripts locales.)
