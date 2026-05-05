-- Patch: en Supabase pgcrypto vive en el schema `extensions`. La función
-- verificar_pin tenía search_path = public y no encontraba crypt(). Pegá esto
-- entero en SQL Editor → Run.

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
