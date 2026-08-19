-- =============================================================================
-- Patch 015 — Rollback de eventos: la UINL es un solo evento que rota de país
--
-- Motivo: los patches 011 y 014 partían la base por congreso (`eventos` +
-- `inscripciones`), con un selector en la UI. Decisión de producto: no va.
-- La UINL es *el* evento y va cambiando de sede todo el tiempo, así que todos
-- los contactos viven en una sola base — el estado y las notas de cada persona
-- se arrastran de un congreso al siguiente sin que nadie tenga que elegir nada.
--
-- Qué NO toca este patch:
--   · `organizaciones` (patch 012) — los 32 colegios mexicanos con su info
--     comercial siguen igual, no dependían de eventos.
--   · `participantes`, `contactos`, `notas` — intactos. Nunca colgaron de
--     `eventos`: la FK iba al revés.
--
-- ⚠ Este patch BORRA las tablas `eventos` e `inscripciones`. Lo único que se
--   pierde es el backfill que generamos nosotros (una fila por participante
--   apuntando a "bolivia-2026"), que ya no significa nada. Ningún dato de
--   contacto, nota o participante depende de esas tablas.
--
-- Pegá este archivo entero en Supabase → SQL Editor → Run.
-- =============================================================================

-- 1 · Funciones y vistas que consultaban por evento
drop function if exists stats_dashboard_evento(text);
drop function if exists stats_continente_evento(text);
drop view if exists v_stats_evento;

-- 2 · La función de dedupe devolvía los eventos de cada candidato.
--     Se rearma sin eso y devolviendo la organización, que es lo que sirve
--     para desambiguar dos personas con nombre parecido.
drop function if exists buscar_participante_similar(text, text, real);

create or replace function buscar_participante_similar(
  p_nombre text,
  p_pais_id text default null,
  p_umbral real default 0.45
)
returns table(
  id uuid,
  nombre_completo text,
  pais_id text,
  pais_label text,
  organizacion text,
  similitud real
)
language sql stable
as $$
  select
    part.id,
    part.nombre_completo,
    part.pais_id,
    part.pais_label,
    part.organizacion,
    similarity(
      public.f_unaccent(lower(part.nombre_completo)),
      public.f_unaccent(lower(p_nombre))
    ) as similitud
  from participantes part
  where similarity(
          public.f_unaccent(lower(part.nombre_completo)),
          public.f_unaccent(lower(p_nombre))
        ) >= p_umbral
  order by
    case when p_pais_id is not null and part.pais_id = p_pais_id then 0 else 1 end,
    similitud desc
  limit 8;
$$;

revoke all on function buscar_participante_similar(text, text, real) from public;
grant execute on function buscar_participante_similar(text, text, real) to anon, authenticated;

-- 3 · Las tablas de evento
drop table if exists inscripciones;
drop table if exists eventos;

-- Verificación: las tres deben devolver los números de siempre.
-- select count(*) from participantes;  -- 358 + los que se agreguen
-- select count(*) from contactos;      -- igual que participantes
-- select count(*) from organizaciones; -- 33 (los colegios de México)
