-- =============================================================================
-- Patch 010 — Lockdown de delete en `notas`
--
-- Motivo: el policy original "delete propias notas" estaba con `using (true)`,
-- lo que permite a cualquier cliente con la anon key (que vive en el JS del
-- browser, es pública por diseño) borrar CUALQUIER nota de la DB. La UI no
-- usa delete; solo inserta. Quitamos el policy.
--
-- Efectos:
--   ✓ Anon ya no puede borrar notas via PostgREST.
--   ✓ El cascade `participantes → notas` sigue funcionando (es a nivel
--     constraint, no RLS).
--   ✓ Service role (SQL Editor de Supabase) puede seguir borrando si hace
--     falta para mantenimiento.
--
-- Para revertir (si algún día agregás un "borrar nota propia" en la UI):
--   create policy "delete propias notas" on notas
--     for delete using (representante_id = current_setting('app.rep_id',true)::uuid);
--   y pasar el rep_id en la sesión desde la app.
-- =============================================================================

drop policy if exists "delete propias notas" on notas;

-- Verificación: este SELECT debe devolver CERO filas con cmd='d' para notas.
-- (Lo dejo comentado; lo corrés vos si querés confirmar.)
-- select polname, polcmd from pg_policy
--   where polrelid = 'public.notas'::regclass and polcmd = 'd';
