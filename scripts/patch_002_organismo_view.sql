-- Patch 002: vista de stats por organismo (consejo / comisión / GT)

create or replace view v_stats_organismo as
select
  co.codigo,
  co.nombre,
  co.tipo,
  count(distinct p.id)::int                                                  as total,
  count(distinct p.id) filter (where c.estado = 'contactado')::int           as contactados,
  count(distinct p.id) filter (where c.estado = 'alta_prioridad')::int       as alta_prioridad
from comisiones co
left join participaciones pp on pp.comision_codigo = co.codigo
left join participantes p    on p.id  = pp.participante_id
left join contactos    c     on c.participante_id = p.id
group by co.codigo, co.nombre, co.tipo
order by
  case co.tipo
    when 'consejo' then 1
    when 'comision' then 2
    when 'grupo_trabajo' then 3
    when 'asamblea' then 4
  end,
  co.codigo;
