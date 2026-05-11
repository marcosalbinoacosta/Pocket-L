-- Patch 006: desglosar v_stand_stats por tipo de proximo paso
-- Pegá este archivo entero en Supabase → SQL Editor → Run
create or replace view v_stand_stats as
select
  count(*)::int                                                              as total,
  count(*) filter (where fecha = current_date)::int                          as hoy,
  count(*) filter (where fecha >= current_date - interval '7 days')::int     as ultima_semana,
  count(*) filter (where participante_id is not null)::int                   as ligados_uinl,
  count(distinct pais_id) filter (where pais_id is not null)::int            as paises_distintos,
  count(*) filter (where array_length(p15_proximos_pasos, 1) > 0)::int       as con_proximos_pasos,
  count(*) filter (where 'reunion_virtual'   = any(p15_proximos_pasos))::int as accion_reunion,
  count(*) filter (where 'visita_presencial' = any(p15_proximos_pasos))::int as accion_visita,
  count(*) filter (where 'cotizacion'        = any(p15_proximos_pasos))::int as accion_cotizacion,
  count(*) filter (where 'info'              = any(p15_proximos_pasos))::int as accion_info
from stand_contactos;
