-- =============================================================================
-- Patch 013 — Búsqueda de participantes similares (dedupe entre eventos)
--
-- Motivo: la base es única (la UINL rota de país, no se separa por congreso),
-- así que cada import nuevo cae sobre los contactos que ya están. La misma
-- persona puede volver a aparecer escrita distinto ("Not. Gabriel Tláloc Cantú
-- Cantú" vs "Gabriel Tláloc Cantú Cantú", con/sin tilde, con/sin prefijo
-- "Lic./Pte./Dr."). Un match exacto por `nombre_completo` deja pasar
-- duplicados; fusionar a ciegas por similitud alta es peligroso (dos "Juan
-- Pérez" de países distintos no son la misma persona). Esta función solo
-- *sugiere* candidatos — el import decide, no fusiona sola.
--
-- Pegá este archivo entero en Supabase → SQL Editor → Run.
-- =============================================================================

create or replace function buscar_participante_similar(
  p_nombre text,
  p_pais_id text default null,
  p_umbral real default 0.45
)
returns table(
  id uuid,
  nombre_completo text,
  pais_id text,
  pais_label text,
  organizacion text,
  similitud real
)
language sql stable
as $$
  select
    part.id,
    part.nombre_completo,
    part.pais_id,
    part.pais_label,
    part.organizacion,
    similarity(
      public.f_unaccent(lower(part.nombre_completo)),
      public.f_unaccent(lower(p_nombre))
    ) as similitud
  from participantes part
  where similarity(
          public.f_unaccent(lower(part.nombre_completo)),
          public.f_unaccent(lower(p_nombre))
        ) >= p_umbral
  -- si se pasa país, prioriza coincidencias del mismo país pero no descarta
  -- las de país nulo (puede venir sin dato en alguno de los dos lados)
  order by
    case when p_pais_id is not null and part.pais_id = p_pais_id then 0 else 1 end,
    similitud desc
  limit 8;
$$;

revoke all on function buscar_participante_similar(text, text, real) from public;
grant execute on function buscar_participante_similar(text, text, real) to anon, authenticated;
