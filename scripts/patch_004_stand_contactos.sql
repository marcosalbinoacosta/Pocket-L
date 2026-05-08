-- Patch 004: Formulario F.0024-02 "Contactos de stand"
-- Tabla independiente con FK opcional a participantes (caso "mixto":
-- el visitante puede o no estar en la lista UINL).
--
-- Pegá este archivo entero en Supabase → SQL Editor → Run
-- Después: en Storage, crear un bucket público llamado `tarjetas-stand`
-- (o correr el bloque comentado al final si se prefiere por SQL).

-- -----------------------------------------------------------------------------
-- TABLA
-- -----------------------------------------------------------------------------
create table if not exists stand_contactos (
  id uuid primary key default uuid_generate_v4(),

  -- vínculo opcional con un participante UINL ya cargado
  participante_id uuid references participantes(id) on delete set null,

  -- Cabecera del formulario
  institucion text,
  contacto_nombre text not null,
  cargo text,
  pais_id text references paises(id),
  pais_label text,
  email text,
  telefono text,

  -- Datos institucionales generales
  p1_notarios_aprox int,
  p2_emite_formularios boolean,
  p3_lineas_formularios int,
  p4_sistema_emision text check (p4_sistema_emision in ('fisico','digital','mixto') or p4_sistema_emision is null),

  -- Seguridad documental
  p5_falsificaciones boolean,
  p6_riesgos text,

  -- Solución física
  p7_seguridad_fisica text,
  p8_consumo_folios text,
  p9_modalidad_compra text check (p9_modalidad_compra in ('compra_directa','licitacion_publica','otro') or p9_modalidad_compra is null),
  p10_impresor text check (p10_impresor in ('estatal','privada','mixto') or p10_impresor is null),
  p11_proveedor_impresion text,

  -- Solución digital
  p12_seguridad_digital text,
  p13_herramientas text,
  p14_desarrollo text check (p14_desarrollo in ('propio','externo') or p14_desarrollo is null),
  p14_proveedor_desarrollo text,

  -- Próximos pasos (multi)
  p15_proximos_pasos text[] default '{}',  -- subset de {reunion_virtual, visita_presencial, cotizacion, info}
  p16_canal_contacto text[] default '{}',  -- subset de {whatsapp, linkedin, email, telefono}

  -- Cierre
  observaciones text,
  recepcionado_por uuid references representantes(id),
  fecha date not null default current_date,
  tarjeta_url text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_stand_contactos_fecha on stand_contactos(fecha desc);
create index if not exists idx_stand_contactos_participante on stand_contactos(participante_id);
create index if not exists idx_stand_contactos_pais on stand_contactos(pais_id);
create index if not exists idx_stand_contactos_recep on stand_contactos(recepcionado_por);

-- search ligero (institución / contacto / país libre)
create index if not exists idx_stand_contactos_search on stand_contactos using gin (
  (
    lower(
      coalesce(institucion,'') || ' ' ||
      coalesce(contacto_nombre,'') || ' ' ||
      coalesce(pais_label,'') || ' ' ||
      coalesce(email,'')
    )
  ) gin_trgm_ops
);

-- updated_at automático
drop trigger if exists trg_stand_contactos_updated on stand_contactos;
create trigger trg_stand_contactos_updated
  before update on stand_contactos
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- VISTA: stats para dashboard
-- -----------------------------------------------------------------------------
create or replace view v_stand_stats as
select
  count(*)::int                                                              as total,
  count(*) filter (where fecha = current_date)::int                          as hoy,
  count(*) filter (where fecha >= current_date - interval '7 days')::int     as ultima_semana,
  count(*) filter (where participante_id is not null)::int                   as ligados_uinl,
  count(distinct pais_id) filter (where pais_id is not null)::int            as paises_distintos
from stand_contactos;

-- -----------------------------------------------------------------------------
-- REALTIME
-- -----------------------------------------------------------------------------
do $$ begin
  begin
    alter publication supabase_realtime add table stand_contactos;
  exception when duplicate_object then null;
  end;
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table stand_contactos enable row level security;

drop policy if exists "lectura abierta" on stand_contactos;
create policy "lectura abierta" on stand_contactos for select using (true);

drop policy if exists "insert stand" on stand_contactos;
create policy "insert stand" on stand_contactos for insert with check (true);

drop policy if exists "update stand" on stand_contactos;
create policy "update stand" on stand_contactos for update using (true) with check (true);

drop policy if exists "delete stand" on stand_contactos;
create policy "delete stand" on stand_contactos for delete using (true);

-- -----------------------------------------------------------------------------
-- STORAGE: bucket "tarjetas-stand" (foto/scan de la tarjeta personal)
--   Crearlo desde el dashboard de Supabase → Storage → New bucket → "tarjetas-stand" (Public).
--   Política de lectura pública + escritura para anon (los reps suben desde el celular).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tarjetas-stand', 'tarjetas-stand', true)
on conflict (id) do nothing;

drop policy if exists "tarjetas-stand lectura" on storage.objects;
create policy "tarjetas-stand lectura" on storage.objects
  for select using (bucket_id = 'tarjetas-stand');

drop policy if exists "tarjetas-stand upload" on storage.objects;
create policy "tarjetas-stand upload" on storage.objects
  for insert with check (bucket_id = 'tarjetas-stand');

drop policy if exists "tarjetas-stand update" on storage.objects;
create policy "tarjetas-stand update" on storage.objects
  for update using (bucket_id = 'tarjetas-stand') with check (bucket_id = 'tarjetas-stand');

drop policy if exists "tarjetas-stand delete" on storage.objects;
create policy "tarjetas-stand delete" on storage.objects
  for delete using (bucket_id = 'tarjetas-stand');
