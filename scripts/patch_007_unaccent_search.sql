-- Patch 007: busqueda insensible a acentos
-- "Maria" debe matchear "María", "anez" debe matchear "Añez", etc.
-- Pegá este archivo entero en Supabase → SQL Editor → Run

-- 1) Extension unaccent en el schema de Supabase
create extension if not exists unaccent with schema extensions;

-- 2) Wrapper IMMUTABLE (unaccent es STABLE, pero las generated columns
--    y los indices exigen IMMUTABLE). Patron canonico de Supabase.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent('extensions.unaccent', $1)
$$;

-- 3) Recrear search_text aplicando f_unaccent + lower
drop index if exists idx_participantes_search;
alter table participantes drop column search_text;
alter table participantes add column search_text text generated always as (
  public.f_unaccent(lower(
    coalesce(nombre_completo,'') || ' ' ||
    coalesce(pais_label,'')      || ' ' ||
    coalesce(organizacion,'')    || ' ' ||
    coalesce(cargo_principal,'') || ' ' ||
    coalesce(roles_raw,'')
  ))
) stored;

-- 4) Recrear GIN trigram index
create index idx_participantes_search on participantes using gin (search_text gin_trgm_ops);
