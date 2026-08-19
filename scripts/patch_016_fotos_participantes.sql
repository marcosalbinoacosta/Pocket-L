-- =============================================================================
-- Patch 016 — Bucket de fotos de participantes
--
-- `participantes.foto_url` ya existía en el schema original pero nunca se usó:
-- los 358 contactos del congreso de Bolivia están todos sin foto. Este patch
-- crea el bucket donde viven las imágenes; la columna no se toca.
--
-- Mismo criterio que `tarjetas-stand` (patch 004): bucket público, escritura
-- abierta para anon. Los reps suben desde el celular con la anon key y no hay
-- login por usuario, así que no hay a quién atarle permisos más finos.
--
-- Pegá este archivo entero en Supabase → SQL Editor → Run.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('fotos-participantes', 'fotos-participantes', true)
on conflict (id) do nothing;

drop policy if exists "fotos-participantes lectura" on storage.objects;
create policy "fotos-participantes lectura" on storage.objects
  for select using (bucket_id = 'fotos-participantes');

drop policy if exists "fotos-participantes upload" on storage.objects;
create policy "fotos-participantes upload" on storage.objects
  for insert with check (bucket_id = 'fotos-participantes');

drop policy if exists "fotos-participantes update" on storage.objects;
create policy "fotos-participantes update" on storage.objects
  for update using (bucket_id = 'fotos-participantes') with check (bucket_id = 'fotos-participantes');

drop policy if exists "fotos-participantes delete" on storage.objects;
create policy "fotos-participantes delete" on storage.objects
  for delete using (bucket_id = 'fotos-participantes');
