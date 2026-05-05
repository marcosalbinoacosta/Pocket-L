-- Patch 003: separar `alta_prioridad` como flag independiente del estado.
-- Antes: estado ∈ {pendiente, contactado, alta_prioridad, no_interesado}
-- Ahora: estado ∈ {pendiente, contactado, no_interesado} + alta_prioridad boolean
--
-- Pegá este archivo entero en Supabase → SQL Editor → Run

alter table contactos
  add column if not exists alta_prioridad boolean not null default false;

-- migrar filas existentes: las que estaban en 'alta_prioridad' ahora son
-- alta_prioridad = true y estado = 'pendiente' (asunción conservadora)
update contactos
   set alta_prioridad = true, estado = 'pendiente'
 where estado = 'alta_prioridad';

-- reemplazar el CHECK
alter table contactos drop constraint if exists contactos_estado_check;
alter table contactos
  add constraint contactos_estado_check
  check (estado in ('pendiente','contactado','no_interesado'));

-- vista dashboard: alta_prioridad ahora cuenta el flag, sin importar estado
create or replace view v_dashboard_stats as
select
  count(*)::int                                            as total,
  count(*) filter (where estado = 'pendiente')::int        as pendientes,
  count(*) filter (where estado = 'contactado')::int       as contactados,
  count(*) filter (where alta_prioridad = true)::int       as alta_prioridad,
  count(*) filter (where estado = 'no_interesado')::int    as no_interesado
from contactos;

-- vista por continente
create or replace view v_stats_continente as
select
  p.continente,
  count(*)::int                                                              as total,
  count(*) filter (where c.estado = 'contactado')::int                       as contactados,
  count(*) filter (where c.alta_prioridad = true)::int                       as alta_prioridad
from participantes p
left join contactos c on c.participante_id = p.id
where p.continente is not null
group by p.continente
order by p.continente;
