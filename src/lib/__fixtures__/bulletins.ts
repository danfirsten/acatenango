/**
 * Representative INSIVUMEH bulletin text.
 *
 * These reproduce the phrasing patterns the real bulletins use, including the
 * variations that matter to the parser: range separators ("de X a Y" vs
 * "entre X y Y"), thousands separators, accent inconsistency in barranca names,
 * and the fact that "ceniza" appears both as a drainage name and as the
 * ordinary word for ash.
 *
 * Every fixture should be replaced with a verbatim captured bulletin as the
 * collector accumulates real ones — see scripts/collect.ts, which archives raw
 * text for exactly this purpose.
 */

export const TYPICAL = `
BOLETIN VULCANOLOGICO DIARIO
VOLCAN DE FUEGO (1402-09)
Actividad: Se observa desgasificacion de color blanco a una altura aproximada
de 4,300 msnm (14,107 pies) que se dispersa hacia el Oeste y Suroeste a una
distancia de 15 kilometros. Se registran de 5 a 8 explosiones por hora de
caracteristicas debiles a moderadas, las cuales expulsan columnas de ceniza a
una altura de 4,500 a 4,800 msnm (14,763 a 15,748 pies). Las explosiones
generan retumbos debiles a moderados con ondas de choque que hacen vibrar
techos y ventanas de las comunidades cercanas. Se registran avalanchas
moderadas hacia las barrancas Seca, Ceniza, Trinidad y Las Lajas. Durante la
noche y madrugada se observaron pulsos incandescentes de 200 a 300 metros
sobre el crater.
`;

/** A paroxysm: higher rates, a lava flow, lahars, "entre X y Y" phrasing. */
export const PAROXYSM = `
BOLETIN VULCANOLOGICO ESPECIAL BEFGO-025-2026
Se registran entre 12 y 16 explosiones por hora, expulsando columnas de ceniza
que alcanzan entre 4.700 y 5.200 msnm, dispersandose hacia el Suroeste a 40
kilometros. Se mantiene un flujo de lava de 1,200 metros de longitud hacia la
barranca Taniluya. Se generan lahares en la barranca Las Lajas y El Jute con
caida de ceniza en comunidades al Suroeste.
`;

/** A quiet day: single explosion figure, no dispersal clause. */
export const QUIET = `
VOLCAN DE FUEGO
Se registra 1 explosion por hora de caracteristicas debiles, con desgasificacion
constante. No se reportan avalanchas significativas.
`;

/** Format the parser is not expected to understand — should degrade, not throw. */
export const MALFORMED = `
VOLCAN DE FUEGO - sin datos disponibles por falla en la estacion sismica.
`;
