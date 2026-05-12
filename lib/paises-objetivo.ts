/**
 * Países objetivo de la campaña comercial — agrupados por continente para
 * facilitar la edición. El filtro hace lookup en O(1) usando el Set.
 *
 * Los valores son los `id` (slug) de la tabla `paises`. Verificado contra
 * el snapshot de la DB: los 28 existen.
 */
export const PAISES_OBJETIVO = new Set<string>([
  // Africa (8)
  "benin",
  "burkina-faso",
  "burundi",
  "camerun",
  "chad",
  "congo",
  "costa-de-marfil",
  "senegal",
  // America (7)
  "bolivia",
  "colombia",
  "guatemala",
  "mexico",
  "peru",
  "republica-dominicana",
  "uruguay",
  // Asia (2)
  "indonesia",
  "libano",
  // Europa (11)
  "albania",
  "bulgaria",
  "eslovaquia",
  "eslovenia",
  "estonia",
  "hungria",
  "letonia",
  "lituania",
  "montenegro",
  "republica-checa",
  "rumania",
]);
