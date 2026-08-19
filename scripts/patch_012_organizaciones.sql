-- =============================================================================
-- Patch 012 — Organizaciones (sub-entidades de países federales)
--
-- Motivo: `paises` asume 1 fila = 1 país = 1 organización notarial. México
-- rompe ese supuesto: 32 colegios estatales, cada uno con su propio consumo,
-- notarios y autoridad — más el Colegio Nacional del Notariado Mexicano A.C.
-- a nivel federal, que coordina pero no emite ni consume directamente.
-- Mismo patrón les va a servir a otros países federales (Argentina, Brasil)
-- si en algún momento se necesita ese nivel de detalle.
--
-- `paises` no se toca: México sigue existiendo como fila país (para FK de
-- participantes, continente, idioma, etc.), pero sus campos comerciales
-- (cantidad_notarios, consumo_anual) quedan en null ahí — el detalle real
-- vive en `organizaciones` y se agrega con la vista `v_paises_con_organizaciones`.
--
-- Pegá este archivo entero en Supabase → SQL Editor → Run (después del 011).
-- =============================================================================

create table if not exists organizaciones (
  id text primary key,                 -- slug: "mexico-jalisco", "mexico-cnnm"
  pais_id text not null references paises(id),
  nombre text not null,                -- "Colegio de Notarios del Estado de Jalisco"
  subdivision text,                    -- "Jalisco" — nombre corto del estado/provincia, si aplica
  tipo text not null default 'colegio_estatal'
    check (tipo in ('colegio_estatal', 'consejo_nacional', 'otro')),
  autoridad text,                      -- presidente / notario responsable
  cantidad_notarios int,
  consumo_anual bigint,
  foja_tipo text,
  emisor_fojas boolean,
  impresor_fojas text,
  notas_comerciales text,
  created_at timestamptz default now()
);
create index if not exists idx_organizaciones_pais on organizaciones(pais_id);
create index if not exists idx_organizaciones_tipo on organizaciones(tipo);

-- -----------------------------------------------------------------------------
-- VIEW: países con el detalle de sus organizaciones agregado
--   Para países sin subdivisiones (la mayoría), *_total = el valor de `paises`.
--   Para México, *_total = suma de sus organizaciones.
-- -----------------------------------------------------------------------------
create or replace view v_paises_con_organizaciones as
select
  p.*,
  coalesce(o.cantidad_notarios, p.cantidad_notarios) as cantidad_notarios_total,
  coalesce(o.consumo_anual, p.consumo_anual)         as consumo_anual_total,
  coalesce(o.cantidad_organizaciones, 0)             as cantidad_organizaciones
from paises p
left join (
  select
    pais_id,
    sum(cantidad_notarios) filter (where tipo = 'colegio_estatal') as cantidad_notarios,
    sum(consumo_anual)     filter (where tipo = 'colegio_estatal') as consumo_anual,
    count(*)                                                       as cantidad_organizaciones
  from organizaciones
  group by pais_id
) o on o.pais_id = p.id;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table organizaciones enable row level security;

drop policy if exists "lectura abierta" on organizaciones;
create policy "lectura abierta" on organizaciones for select using (true);
