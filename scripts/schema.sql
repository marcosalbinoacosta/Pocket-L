-- =============================================================================
-- +LATINA · Congreso UINL · Schema Supabase
-- Pegá este archivo entero en Supabase → SQL Editor → Run
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- PAÍSES (catálogo enriquecido con CUADRO INFO RESUMEN)
-- -----------------------------------------------------------------------------
create table if not exists paises (
  id text primary key,                       -- slug, ej "argentina"
  nombre text not null,                      -- "Argentina"
  continente text,                           -- America | Africa | Asia | Europa | Oceania
  idioma_oficial text,
  organizacion_notarial text,
  miembro_desde int,
  cantidad_notarios int,
  cantidad_habitantes bigint,
  consumo_anual bigint,                      -- consumo de fojas/año
  foja_tipo text,                            -- "Hibrido", "Hibrido + digital", etc
  impresor_fojas text,                       -- "Privado" / "Estatal"
  caracteristicas_tecnicas text,             -- "Papel de seguridad" / "Sin seguridad"
  consejo_emisor_fojas boolean,
  notas_comerciales text                     -- libre
);
create index if not exists idx_paises_continente on paises(continente);

-- -----------------------------------------------------------------------------
-- COMISIONES / GRUPOS DE TRABAJO
-- -----------------------------------------------------------------------------
create table if not exists comisiones (
  codigo text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('comision','grupo_trabajo','consejo','asamblea'))
);

insert into comisiones(codigo, nombre, tipo) values
  ('ASAMBLEA','Asamblea','asamblea'),
  ('PRESIDENCIA','Presidencia UINL','consejo'),
  ('CD','Consejo de Direccion','consejo'),
  ('CG','Consejo General','consejo'),
  ('CVF','Consejo de Vigilancia Financiera','consejo'),
  ('CAAf','Comision de Asuntos Africanos','comision'),
  ('CAAm','Comision de Asuntos Americanos','comision'),
  ('CAAs','Comision de Asuntos Asiaticos','comision'),
  ('CAE','Comision de Asuntos Europeos','comision'),
  ('CCNI','Cooperacion Notarial Internacional','comision'),
  ('CC','Comision Consultiva','comision'),
  ('CSSN','Seguridad Social Notarial','comision'),
  ('CTC','Temas y Congresos','comision'),
  ('CDH','Derechos Humanos','comision'),
  ('CDN','Deontologia Notarial','comision'),
  ('GT_OI','GT Organizaciones Internacionales','grupo_trabajo'),
  ('GT_DIG','GT Digitalizacion y Autenticidad','grupo_trabajo'),
  ('GT_BLA','GT Lucha Blanqueo de Capitales','grupo_trabajo'),
  ('GT_IG','GT Igualdad de Genero','grupo_trabajo')
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- PARTICIPANTES (inscriptos al congreso)
-- -----------------------------------------------------------------------------
create table if not exists participantes (
  id uuid primary key default uuid_generate_v4(),
  nombre_completo text not null,
  pais_id text references paises(id),
  pais_label text,                          -- fallback si no normaliza
  continente text,
  email text,
  telefono text,
  organizacion text,
  cargo_principal text,                     -- "Presidente CAAm", calculado
  roles_raw text,                           -- texto consolidado del Excel
  prioridad_score int default 0,            -- 0-100
  foto_url text,
  notas_publicas text,
  search_text text generated always as (
    lower(
      coalesce(nombre_completo,'') || ' ' ||
      coalesce(pais_label,'') || ' ' ||
      coalesce(organizacion,'') || ' ' ||
      coalesce(cargo_principal,'') || ' ' ||
      coalesce(roles_raw,'')
    )
  ) stored,
  created_at timestamptz default now()
);
create index if not exists idx_participantes_search on participantes using gin (search_text gin_trgm_ops);
create index if not exists idx_participantes_pais on participantes(pais_id);
create index if not exists idx_participantes_continente on participantes(continente);
create index if not exists idx_participantes_prioridad on participantes(prioridad_score desc);

-- -----------------------------------------------------------------------------
-- PARTICIPACIONES (M:N participante - comisión con cargo)
-- -----------------------------------------------------------------------------
create table if not exists participaciones (
  id uuid primary key default uuid_generate_v4(),
  participante_id uuid not null references participantes(id) on delete cascade,
  comision_codigo text not null references comisiones(codigo),
  cargo text,                               -- Presidente | Vicepresidente | Secretario | Miembro | Responsable
  unique (participante_id, comision_codigo)
);
create index if not exists idx_participaciones_p on participaciones(participante_id);
create index if not exists idx_participaciones_c on participaciones(comision_codigo);

-- -----------------------------------------------------------------------------
-- REPRESENTANTES (+LATINA)
-- -----------------------------------------------------------------------------
create table if not exists representantes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  pin_hash text not null,
  color text not null default '#0B1B3B',
  activo boolean default true,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- CONTACTOS (estado por participante; 1:1)
-- -----------------------------------------------------------------------------
create table if not exists contactos (
  id uuid primary key default uuid_generate_v4(),
  participante_id uuid not null unique references participantes(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','contactado','alta_prioridad','no_interesado')),
  representante_id uuid references representantes(id),
  updated_at timestamptz default now()
);
create index if not exists idx_contactos_estado on contactos(estado);

create or replace function init_contacto() returns trigger as $$
begin
  insert into contactos(participante_id) values (new.id) on conflict do nothing;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_init_contacto on participantes;
create trigger trg_init_contacto
  after insert on participantes
  for each row execute function init_contacto();

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_contactos_updated on contactos;
create trigger trg_contactos_updated
  before update on contactos
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- NOTAS (historial)
-- -----------------------------------------------------------------------------
create table if not exists notas (
  id uuid primary key default uuid_generate_v4(),
  participante_id uuid not null references participantes(id) on delete cascade,
  representante_id uuid not null references representantes(id),
  texto text not null,
  created_at timestamptz default now()
);
create index if not exists idx_notas_p on notas(participante_id, created_at desc);

-- -----------------------------------------------------------------------------
-- VIEWS
-- -----------------------------------------------------------------------------
create or replace view v_dashboard_stats as
select
  count(*)::int                                                    as total,
  count(*) filter (where estado = 'pendiente')::int                as pendientes,
  count(*) filter (where estado = 'contactado')::int               as contactados,
  count(*) filter (where estado = 'alta_prioridad')::int           as alta_prioridad,
  count(*) filter (where estado = 'no_interesado')::int            as no_interesado
from contactos;

create or replace view v_stats_continente as
select
  p.continente,
  count(*)::int                                                    as total,
  count(*) filter (where c.estado = 'contactado')::int             as contactados,
  count(*) filter (where c.estado = 'alta_prioridad')::int         as alta_prioridad
from participantes p
left join contactos c on c.participante_id = p.id
where p.continente is not null
group by p.continente
order by p.continente;

-- -----------------------------------------------------------------------------
-- REALTIME
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table contactos;
alter publication supabase_realtime add table notas;

-- -----------------------------------------------------------------------------
-- RLS
--   Política: equipo de 4 personas, todos ven y editan todo. PIN se valida
--   en el cliente contra la tabla representantes (anon key). NO se permite
--   borrar participantes/representantes desde el cliente.
-- -----------------------------------------------------------------------------
alter table paises          enable row level security;
alter table comisiones      enable row level security;
alter table participantes   enable row level security;
alter table participaciones enable row level security;
alter table representantes  enable row level security;
alter table contactos       enable row level security;
alter table notas           enable row level security;

-- lectura abierta para todo
do $$
declare t text;
begin
  for t in select unnest(array['paises','comisiones','participantes','participaciones','representantes','contactos','notas'])
  loop
    execute format('drop policy if exists "lectura abierta" on %I', t);
    execute format('create policy "lectura abierta" on %I for select using (true)', t);
  end loop;
end$$;

-- escritura solo en lo que el equipo modifica desde la app
drop policy if exists "update contactos" on contactos;
create policy "update contactos" on contactos for update using (true) with check (true);

drop policy if exists "insert notas" on notas;
create policy "insert notas" on notas for insert with check (true);

drop policy if exists "delete propias notas" on notas;
create policy "delete propias notas" on notas for delete using (true);

-- representantes: solo lectura desde anon (la creación se hace con service_role en seed)
-- participantes / paises / comisiones / participaciones: idem.

-- -----------------------------------------------------------------------------
-- SEGURIDAD del PIN
--   El default "lectura abierta" expondría pin_hash al anon. Lo cerramos con
--   GRANT a nivel columna: anon puede leer todo MENOS pin_hash. Así se mantiene
--   la FK para que PostgREST embeba notas → representantes sin hacks.
-- -----------------------------------------------------------------------------

revoke all on representantes from anon, authenticated;
grant select (id, nombre, color, activo) on representantes to anon, authenticated;

-- pgcrypto trae crypt(); el hash que generamos en seed es bcrypt (compat con crypt)
create or replace function verificar_pin(pin text)
returns table(id uuid, nombre text, color text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if pin !~ '^[0-9]{4}$' then return; end if;
  return query
    select r.id, r.nombre, r.color
    from representantes r
    where r.activo = true
      and r.pin_hash = extensions.crypt(pin, r.pin_hash);
end;
$$;

revoke all on function verificar_pin(text) from public;
grant execute on function verificar_pin(text) to anon, authenticated;

-- Unique necesario para el upsert del seed
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'representantes_nombre_unique') then
    alter table representantes add constraint representantes_nombre_unique unique (nombre);
  end if;
end $$;

-- Unique necesario para el upsert de participantes en el script de import
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'participantes_nombre_unique') then
    alter table participantes add constraint participantes_nombre_unique unique (nombre_completo);
  end if;
end $$;
