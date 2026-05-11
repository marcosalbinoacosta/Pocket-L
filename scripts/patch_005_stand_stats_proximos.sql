-- Patch 005: sumar contador "con próximo paso" a v_stand_stats
-- Pegá este archivo entero en Supabase → SQL Editor → Run
create or replace view v_stand_stats as
select
  count(*)::int                                                              as total,
  count(*) filter (where fecha = current_date)::int                          as hoy,
  count(*) filter (where fecha >= current_date - interval '7 days')::int     as ultima_semana,
  count(*) filter (where participante_id is not null)::int                   as ligados_uinl,
  count(distinct pais_id) filter (where pais_id is not null)::int            as paises_distintos,
  count(*) filter (where array_length(p15_proximos_pasos, 1) > 0)::int       as con_proximos_pasos
from stand_contactos;
