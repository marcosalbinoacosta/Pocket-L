-- Patch 009: unificar variantes acentuadas de continente
-- "África" -> "Africa", "América" -> "America", etc.
-- Asume que ya existe public.f_unaccent (patch 007).
-- Pegá este archivo entero en Supabase → SQL Editor → Run

update paises
set continente = public.f_unaccent(continente)
where continente is not null
  and continente <> public.f_unaccent(continente);

update participantes
set continente = public.f_unaccent(continente)
where continente is not null
  and continente <> public.f_unaccent(continente);

-- reporte
select continente, count(*)::int as n
from participantes
where continente is not null
group by continente
order by continente;
