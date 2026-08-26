-- =============================================================================
-- Patch 018 — La ficha del stand también marca contacto
--
-- Motivo: cargar un formulario F.0024-02 escribe solo en `stand_contactos`,
-- incluso cuando la ficha viene ligada a un participante de la UINL. Como
-- `ultimo_contacto_at` (patch 017) solo se mueve por una nota nueva o por el
-- cambio de estado, esa persona seguía figurando en "Por abordar" y no sumaba
-- al progreso del congreso, aunque el equipo la hubiera atendido y le hubiera
-- llenado el formulario entero.
--
-- En Bolivia el hueco no se notó: las 22 fichas cargadas estaban ligadas a 18
-- participantes y los 18 ya tenían fecha por otra vía. Fue costumbre del equipo,
-- no diseño — y en el stand de México el formulario puede ser el único gesto.
-- Por eso no hace falta backfill: este patch es solo hacia adelante.
--
-- Pegá este archivo entero en Supabase -> SQL Editor -> Run.
-- Es idempotente y no modifica ninguna fila existente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sobre la hora que se usa
--
-- `stand_contactos.fecha` es un `date` sin hora. Convertirlo directo a
-- timestamptz lo clava a medianoche, y con el desfase de México (UTC-6) una
-- ficha de hoy caería seis horas ANTES del inicio del congreso — o sea que el
-- dashboard la contaría como trabajo de la sede anterior.
--
-- Se usa el mediodía de esa fecha, que queda lejos de los dos bordes y sobrevive
-- a cualquier huso razonable. La hora exacta del abordaje no importa: lo que
-- importa es de qué día es.
-- -----------------------------------------------------------------------------
create or replace function touch_ultimo_contacto_stand() returns trigger as $$
declare
  cuando timestamptz;
begin
  if new.participante_id is null then
    return new;
  end if;

  cuando := coalesce(new.fecha, current_date)::timestamptz + interval '12 hours';

  update contactos
     set ultimo_contacto_at = greatest(coalesce(ultimo_contacto_at, cuando), cuando)
   where participante_id = new.participante_id;

  return new;
end; $$ language plpgsql;

-- Dispara también en update: una ficha puede cargarse suelta y vincularse al
-- participante después, cuando alguien la reconoce en la lista.
drop trigger if exists trg_stand_ultimo_contacto on stand_contactos;
create trigger trg_stand_ultimo_contacto
  after insert or update of participante_id, fecha on stand_contactos
  for each row execute function touch_ultimo_contacto_stand();

-- -----------------------------------------------------------------------------
-- Verificación
-- -----------------------------------------------------------------------------
-- Esperado: 1 fila, el trigger recién creado.
--   select tgname from pg_trigger
--    where tgrelid = 'public.stand_contactos'::regclass and not tgisinternal;
--
-- Esperado: 0 filas. Ninguna ficha ligada debería quedar sin fecha de contacto.
--   select s.id, s.contacto_nombre, s.fecha
--     from stand_contactos s
--     join contactos c on c.participante_id = s.participante_id
--    where s.participante_id is not null
--      and c.ultimo_contacto_at is null;
--
-- Prueba en vivo (después de cargar la primera ficha real del stand):
-- esa persona debería desaparecer de "Por abordar" y aparecer en "Trabajado acá".
