-- =============================================================================
-- Patch 017 — `ultimo_contacto_at`: cuándo fue la última vez que pasó algo real
--
-- Motivo: hoy no hay forma de distinguir el trabajo de un congreso del de otro.
-- `estado` es acumulativo (se prende una vez y se queda prendido) y `updated_at`
-- se mueve con cualquier escritura sobre la fila, así que ninguno de los dos
-- sirve como corte entre sedes.
--
-- Esta columna solo se mueve cuando hubo contacto real. Con eso:
--   · el dashboard puede mostrar solo lo de este congreso (fecha >= inicio),
--   · el re-contacto queda registrado sin agregar estados nuevos ni romper los
--     conteos históricos: alguien contactado en mayo que reaparece en agosto
--     ES un re-contacto, y se ve en la fecha,
--   · la ficha puede decir "contactado — última vez hace 3 meses".
--
-- No se agrega tabla de eventos: mientras haya un solo corte alcanza con la
-- fecha. Si en la tercera sede hace falta traducir fechas a nombres de sede, se
-- agrega ahí un calendario `eventos(id, nombre, desde, hasta)` del que no cuelga
-- nada — distinto de los patches 011/014, que particionaban la base y fueron
-- revertidos en el 015.
--
-- Pegá este archivo entero en Supabase -> SQL Editor -> Run.
-- Es idempotente: se puede correr más de una vez sin pisar datos nuevos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La columna
-- -----------------------------------------------------------------------------
alter table contactos
  add column if not exists ultimo_contacto_at timestamptz;

comment on column contactos.ultimo_contacto_at is
  'Ultima vez que hubo contacto real con la persona. La mueven: una nota nueva, o el paso a estado contactado. NO la mueve una edicion cualquiera de la fila (para eso esta updated_at).';

create index if not exists idx_contactos_ultimo_contacto
  on contactos(ultimo_contacto_at desc nulls last);

-- -----------------------------------------------------------------------------
-- 2 · Cada nota nueva marca contacto
--
-- Es el camino principal: el equipo ya escribe notas en el stand (en Bolivia, 82
-- de los 98 contactados tienen al menos una), así que la fecha se mantiene sola,
-- sin pedirle un gesto nuevo a nadie.
--
-- greatest() evita que cargar una nota vieja tire la fecha para atrás.
-- -----------------------------------------------------------------------------
create or replace function touch_ultimo_contacto() returns trigger as $$
begin
  update contactos
     set ultimo_contacto_at = greatest(coalesce(ultimo_contacto_at, new.created_at), new.created_at)
   where participante_id = new.participante_id;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_notas_ultimo_contacto on notas;
create trigger trg_notas_ultimo_contacto
  after insert on notas
  for each row execute function touch_ultimo_contacto();

-- -----------------------------------------------------------------------------
-- 3 · Pasar a "contactado" también marca contacto
--
-- Cubre los casos en que se toca el botón sin dejar nota.
--
-- Ojo: solo dispara en la TRANSICIÓN a contactado. Si la persona ya venía
-- contactada de otro congreso y se la vuelve a abordar, el estado no cambia y
-- este trigger no hace nada — ese re-contacto lo registra la nota (bloque 2).
-- Es a propósito: el estado no puede representar dos veces lo mismo.
--
-- Convive con trg_contactos_updated: ambos son BEFORE UPDATE y escriben campos
-- distintos de NEW, no compiten.
-- -----------------------------------------------------------------------------
create or replace function marcar_contacto_por_estado() returns trigger as $$
begin
  if new.estado = 'contactado' and old.estado is distinct from 'contactado' then
    new.ultimo_contacto_at = now();
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_contactos_ultimo_contacto on contactos;
create trigger trg_contactos_ultimo_contacto
  before update on contactos
  for each row execute function marcar_contacto_por_estado();

-- -----------------------------------------------------------------------------
-- 4 · Backfill — la columna nace con la verdad histórica, no en null
--
-- 4.a · Los 82 que tienen notas: la fecha real es la de su última nota.
-- -----------------------------------------------------------------------------
update contactos c
   set ultimo_contacto_at = n.ultima
  from (select participante_id, max(created_at) as ultima from notas group by participante_id) n
 where c.participante_id = n.participante_id
   and c.ultimo_contacto_at is null;

-- -----------------------------------------------------------------------------
-- 4.b · Los 16 contactados que no dejaron nota.
--
-- Para estos la fecha real estaba en contactos.updated_at, pero ese campo ya no
-- sirve: el script de prioridades del 26/08 lo pisó con la fecha de hoy en 113
-- filas. Los valores de abajo salen del snapshot previo
-- backups/2026-08-26_13-40-13/contactos.json, que conserva las fechas buenas.
-- Por eso van explícitos y no calculados: es la única copia de ese dato.
-- Todas caen en mayo/junio 2026, o sea Bolivia.
-- -----------------------------------------------------------------------------
update contactos c
   set ultimo_contacto_at = v.ts
  from (values
  ('ec900909-baaf-4d02-b4fd-2eaaeb3adb65'::uuid, '2026-05-19T23:18:28.401095+00:00'::timestamptz),  -- Graciela Curuchelar
  ('64a60dd6-6f9a-4952-baab-bc4e933189de'::uuid, '2026-05-13T16:39:16.089532+00:00'::timestamptz),  -- Elinalva Henrique
  ('a4129c5a-2d41-4d96-94e5-4988eb58e659'::uuid, '2026-05-15T20:03:46.699838+00:00'::timestamptz),  -- Marina Gabriela Reyes Miranda
  ('3f75ddb7-e16a-4fff-9155-11a642511862'::uuid, '2026-05-12T17:51:41.255066+00:00'::timestamptz),  -- ADELA ISABEL PEREZ ROCA
  ('4d8a7725-be19-4379-965d-4a2d3ea7de7d'::uuid, '2026-05-14T15:43:46.915376+00:00'::timestamptz),  -- Gabor
  ('301ef19e-a81e-4013-95a9-12cd286d1162'::uuid, '2026-05-12T20:45:28.832688+00:00'::timestamptz),  -- Laura Fernanda Camejo
  ('5ca1237f-555d-4b52-80b2-203a92538235'::uuid, '2026-05-15T15:34:10.672936+00:00'::timestamptz),  -- Licda. Jorleny Ugalde
  ('3565638a-5c37-40d9-9abd-91f30824e81a'::uuid, '2026-05-15T16:48:40.910361+00:00'::timestamptz),  -- Bitty-kouyate Christiane
  ('f6c30fed-fdf1-4f24-b7b7-f0e0a23c27a3'::uuid, '2026-05-12T15:31:30.162205+00:00'::timestamptz),  -- Jaymarie Correa
  ('f29d4856-a85f-4a70-b42c-0760390006dd'::uuid, '2026-05-12T17:16:31.343181+00:00'::timestamptz),  -- Lidia María DURÁN CAPELLÁN
  ('7683a39d-6070-43d6-8221-7c254361c256'::uuid, '2026-05-12T18:46:48.14226+00:00'::timestamptz),  -- MARIA ALEJANDRA CASTELLON ARRIETA
  ('e7997bed-1c5b-4723-933d-e67d7e10ab7f'::uuid, '2026-05-13T20:33:42.067944+00:00'::timestamptz),  -- JHANDIRA JIMENEZ SANCHEZ
  ('85df5d42-c94b-4526-a4eb-813a4e25934c'::uuid, '2026-05-18T19:46:51.712411+00:00'::timestamptz),  -- MOKOKO FRéDY CYRIAQUE
  ('27d70ccf-7382-407f-ba42-2ed1ef84b6a9'::uuid, '2026-05-12T15:02:24.98165+00:00'::timestamptz),  -- Esc. Verónica
  ('40fd0d76-33c2-4b63-9bed-683d973a6d16'::uuid, '2026-05-14T16:14:33.80428+00:00'::timestamptz),  -- Noel Humboldt
  ('0345eb40-fde6-42c6-aa1f-a9e9cedee939'::uuid, '2026-05-13T21:33:41.034655+00:00'::timestamptz)  -- Gilda Krisch
  ) as v(participante_id, ts)
 where c.participante_id = v.participante_id
   and c.ultimo_contacto_at is null;

-- -----------------------------------------------------------------------------
-- 5 · Verificación — correr después y comparar con lo esperado
-- -----------------------------------------------------------------------------
-- Esperado: 98 con fecha, 290 en null (los que nunca se tocaron).
--   select count(*) filter (where ultimo_contacto_at is not null) as con_fecha,
--          count(*) filter (where ultimo_contacto_at is null)     as sin_fecha
--     from contactos;
--
-- Esperado: solo 2026-05 y 2026-06. Ninguna fila en 2026-08.
--   select to_char(ultimo_contacto_at,'YYYY-MM') as mes, count(*)
--     from contactos where ultimo_contacto_at is not null
--    group by 1 order by 1;
--
-- Esperado: 0 filas. Ningún contactado debería quedar sin fecha.
--   select count(*) from contactos
--    where estado <> 'pendiente' and ultimo_contacto_at is null;
