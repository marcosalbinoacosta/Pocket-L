-- Patch 008: backfill continente desde paises.continente
-- 158 participantes vienen con continente vacio en el Excel FINAL.
-- Como tenemos pais_id, podemos inferirlo de la tabla paises.
-- Pegá este archivo entero en Supabase → SQL Editor → Run

update participantes p
set continente = pa.continente
from paises pa
where p.pais_id = pa.id
  and p.continente is null
  and pa.continente is not null;

-- reporte
select
  count(*) filter (where continente is null)::int as sin_continente,
  count(*) filter (where continente is not null)::int as con_continente
from participantes;
