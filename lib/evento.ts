/**
 * Congreso en curso.
 *
 * La UINL es un solo evento que rota de sede, así que la base de contactos es
 * una sola y perpetua (ver scripts/patch_015_rollback_eventos.sql). Lo único
 * que separa un congreso del anterior es la fecha: todo lo que tiene contacto
 * posterior a `INICIO_EVENTO` es trabajo de esta sede; lo de antes es historia
 * y se sigue viendo en la ficha de cada persona.
 *
 * Para cambiar de sede alcanza con tocar estas tres líneas.
 */
export const EVENTO_ACTUAL = "México 2026";

/** Medianoche del 26/08/2026 en Ciudad de México (UTC-6, sin horario de verano). */
export const INICIO_EVENTO = "2026-08-26T00:00:00-06:00";

/** Misma fecha en formato `date`, para columnas sin hora (stand_contactos.fecha). */
export const INICIO_EVENTO_FECHA = "2026-08-26";

const INICIO_MS = new Date(INICIO_EVENTO).getTime();

/** ¿Este timestamp corresponde al congreso en curso? Compara en milisegundos:
 *  los ISO vienen con offsets distintos y no se pueden comparar como texto. */
export function esDeEsteEvento(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).getTime() >= INICIO_MS;
}
