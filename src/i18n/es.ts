import type { DriftGroup, DriftRelation, Dict } from './types';

/**
 * Spanish for Guatemala. Uses INSIVUMEH's own terms where the bulletin has
 * them: columna de ceniza, m s.n.m., barrancas, incandescencia, caída de
 * ceniza, desplazamiento. Addresses the reader as usted.
 */

const NBSP = ' ';

/** "y" becomes "e" before a word that starts with an i sound: "Morelia e Isla". */
function and(next: string): string {
  return /^h?i(?![aeouáéóú])/i.test(next) ? 'e' : 'y';
}

/** "a", "a y b", "a, b y c". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items.at(-1) as string;
  return `${items.slice(0, -1).join(', ')} ${and(last)} ${last}`;
}

const COMPASS: Record<string, string> = {
  N: 'norte', NE: 'noreste', E: 'este', SE: 'sureste',
  S: 'sur', SW: 'suroeste', W: 'oeste', NW: 'noroeste',
};

const RELATION_FIRST: Record<DriftRelation, string> = {
  towards: 'en dirección al Acatenango',
  away: 'alejándose del Acatenango',
  side: 'hacia un costado del Acatenango',
};
const RELATION_AGAIN: Record<DriftRelation, string> = {
  towards: 'en dirección a él',
  away: 'alejándose de él',
  side: 'hacia un costado de él',
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const es: Dict = {
  locale: 'es',
  htmlLang: 'es',
  meta: {
    title: 'Fuego: en vivo desde el macizo del Acatenango',
    description: 'Un archivo no oficial del Volcán de Fuego, Guatemala, representado con datos reales de elevación.',
    ogAlt: 'El Fuego en erupción junto al Acatenango',
    ogLocale: 'es_GT',
  },
  languageName: 'Español',
  switchLabel: 'Leer esta página en español',
  notice: {
    label: 'Acerca de este registro',
    lead: 'Archivo no oficial.',
    body: 'Este sitio, Fuego, no es un servicio de alertas. Copia el boletín diario del INSIVUMEH una o dos veces al día, así que siempre va con retraso respecto al observatorio.',
    linksLabel: 'Fuentes oficiales',
    insivumeh: 'Vulcanología del INSIVUMEH',
    conred: 'Alertas de la CONRED',
  },
  topbar: {
    representative: 'Datos representativos',
    unread: (n) => `${n} ${plural(n, 'campo sin leer', 'campos sin leer')}`,
    latest: 'Último boletín',
    replaying: 'Día seleccionado',
    replayingOn: (d) => `Día seleccionado: ${d}`,
  },
  age: {
    label: (days) => (days === 0 ? 'hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`),
    behind: 'el registro va atrasado',
  },
  compass: COMPASS,
  compassAbbr: { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SO', W: 'O', NW: 'NO' },
  list,
  readout: {
    notReported: 'Sin reporte',
    explosions: 'Explosiones',
    continuous: 'continua',
    emission: 'emisión',
    perHour: 'por hora',
    ashColumn: 'Columna de ceniza',
    mAsl: 'm s.n.m.',
    aboveSummit: 'Sobre la cumbre',
    metres: 'm',
    drift: 'Desplazamiento',
    heading: (dirs) => `rumbo ${dirs}`,
    km: (dirs) => `km ${dirs}`,
    ashfallIn: 'Caída de ceniza en',
    drainages: 'Barrancas',
    ashfall: 'Caída de ceniza',
    noneNamed: 'Ninguna nombrada',
    plumeShows: (d) => `la columna muestra el ${d}`,
  },
  marks: {
    label: 'Cómo se marca cada dato',
    word: {
      reported: 'Reportado',
      saidNone: 'Ninguno',
      notReported: 'Sin reporte',
      held: 'Retenido',
      continuous: 'Continua',
    },
    hint: {
      reported: 'La cifra tal como la escribió el boletín.',
      saidNone: 'El boletín lo menciona pero no nombra ninguno.',
      notReported: 'El boletín no lo indica. Nunca se dibuja como 0.',
      held: 'La columna muestra un día anterior, que se nombra.',
      continuous: 'Emisión sin conteo por hora.',
    },
  },
  replay: {
    label: 'Viendo un boletín anterior',
    previous: 'Día anterior',
    next: 'Día siguiente',
    back: (d) => `Volver al ${d}`,
  },
  notes: {
    bothHeld: (d) => `Este boletín no da tasa ni columna de ceniza; la pluma mantiene la tasa y la columna del ${d}.`,
    rateHeld: (d) => `Este boletín no da tasa de explosiones; la pluma mantiene la tasa del ${d}.`,
    rateNone: 'Ni este boletín ni ninguno anterior da una tasa de explosiones.',
    columnHeld: (d) => `Este boletín no da columna de ceniza; la pluma mantiene la altura del ${d}.`,
    columnNone: 'Ni este boletín ni ninguno anterior da una columna de ceniza.',
  },
  massif: {
    canvasLabel: 'Vista tridimensional del macizo del Acatenango y el Fuego, construida con datos de elevación',
    erupting: 'en erupción',
    yourCamp: 'campamento',
    viewsLabel: 'Vista de la cámara',
    orbit: 'Órbita',
    fromCamp: 'Desde el campamento',
    loading: 'Cargando datos de elevación…',
    unsupported: 'Esta vista necesita WebGL. Las lecturas de abajo funcionan sin ella.',
    failed: 'Terreno no disponible. Las lecturas de abajo no se ven afectadas.',
  },
  scrollcue: 'El registro de abajo mueve la montaña',
  record: {
    title: 'Ritmo de las explosiones',
    intro:
      'Recorra el registro y la montaña lo sigue: la pluma sube hasta la columna de ceniza que reportó el boletín de ese día y se inclina hacia donde lo anotó el observador. La gráfica y el volcán son el mismo dato, dibujado dos veces.',
    days: 'Días',
    tallest: 'Columna más alta',
    peakRate: 'Tasa máxima',
    notReported: 'Sin reporte',
    perHour: (v) => `${v} /h`,
    daysOf: (n, total) => `${n} de ${total} días`,
  },
  tempo: {
    aria: (days, missing, continuous) =>
      `Explosiones por hora durante ${days} días; ${missing} no dieron tasa y quedan como huecos${continuous ? `, y ${continuous} fueron emisión continua, sin conteo por hora` : ''}`,
    rate: (r) => `${r} explosiones/h`,
    continuous: 'Emisión continua, sin conteo por hora',
    rateMissing: 'Tasa de explosiones sin reporte',
    ash: (m) => `ceniza ${m} m`,
    ashMissing: 'ceniza sin reporte',
    drift: (km) => `desplazamiento ${km} km`,
    driftMissing: 'desplazamiento sin reporte',
    valueText: (date, rate) => `${date}: ${rate}`,
    keyDays: (n, total) => `${n} de ${total} días`,
  },
  lanes: {
    figureLabel: 'Datos diarios del boletín, en los mismos días que la gráfica de arriba',
    sliderLabel: 'Día seleccionado',
    driftTitle: 'Desplazamiento',
    glowTitle: 'Altura de la incandescencia',
    drainagesTitle: 'Barrancas nombradas',
    townsTitle: 'Comunidades con caída de ceniza',
    daysOf: (n, total) => `${n} de ${total} días`,
    campRow: 'fila discontinua: hacia el campamento',
    glowNote: (m) => (m === null ? 'sin reporte' : `hasta ${m} m sobre el cráter`),
    notReported: 'sin reporte',
    dayDrift: (dirs) => `Desplazamiento ${dirs === null ? 'sin reporte' : `hacia ${dirs}`}`,
    dayGlow: (m) => `Incandescencia ${m === null ? 'sin reporte' : `${m} m`}`,
    dayDrainages: (names) => `Barrancas ${names ?? 'sin reporte'}`,
    dayTowns: (names) => `Comunidades ${names ?? 'sin reporte'}`,
    dayTownsNone: 'Caída de ceniza, sin comunidades nombradas',
    commonDrift: 'Desplazamiento más frecuente',
    commonDriftValue: (dirs, days) => `${capital(list(dirs.map((d) => COMPASS[d] ?? d)))} (${days} ${plural(days, 'día', 'días')})`,
    commonDriftNote: (n) => `de los ${n} días que indicaron uno`,
    drainagesNamed: 'Barrancas nombradas',
    drainagesNote: (n) => `días en que se nombró cada una, de los ${n} días con alguna barranca nombrada`,
  },
  gvp: {
    sectionLabel: 'Cotejo con el reporte semanal del Smithsonian',
    title: 'Reporte semanal del Smithsonian',
    notStated: 'no indicado',
    range: (min, max, unit) => `${max === null ? min : `${min} a ${max}`} ${unit}`,
    perHour: 'por hora',
    mAsl: 'm s.n.m.',
    explosions: 'Explosiones',
    ashColumn: 'Columna de ceniza',
    check: (what, gvp, bulletins) => `${what}: GVP ${gvp}; boletines ${bulletins}`,
    noneYet: 'aún no se han recopilado reportes semanales',
    read: (weeks, differ) =>
      `${weeks} ${plural(weeks, 'semana leída', 'semanas leídas')} · ${differ} ${plural(differ, 'difiere', 'difieren')}`,
    keyMissing: 'Sin reporte del GVP recopilado para la semana',
    keyDiffer: 'Las dos fuentes difieren',
    agree: 'Ninguna semana tiene cifras que discrepen claramente de las de los boletines.',
    differIntro:
      'En estas semanas las cifras del reporte y las de los boletines quedan claramente separadas. Puede deberse a un escaneo mal leído, a un error del analizador o a una diferencia en lo que cuenta cada fuente. Ninguna se da por correcta, y aquí no se ha corregido nada.',
    week: (from, to) => `${from} a ${to}`,
    report: 'Reporte semanal del GVP',
    bulletins: 'Boletines del INSIVUMEH:',
    bulletinLabel: (d) => `Boletín del INSIVUMEH, ${d}`,
    credit: 'Cifras semanales del {gvp}, Weekly Volcanic Activity Reports sobre el Fuego.',
    programme: 'Programa Global de Vulcanismo del Smithsonian',
  },
  camp: {
    title: 'Desde el campamento',
    representative: 'Datos representativos',
    bulletinOf: 'Boletín del {date}',
    empty:
      'Todavía no se ha archivado ningún boletín. Cuando se lea el primero, aquí se describirá lo que reportó tal como se ve desde el Acatenango.',
    foot: (km, bearing, point) =>
      `El campamento se sitúa en la cumbre del Acatenango, a ${km} km del cráter del Fuego, con rumbo de ${bearing}°, aproximadamente al ${point}. La ceniza que se desplaza dentro de un cuarto de la rosa de los vientos alrededor de ese rumbo se describe como en dirección al Acatenango; la del cuarto opuesto, como alejándose, y el resto, como hacia un costado.`,
    advice:
      'Esto describe lo que reportó el boletín. No es un consejo sobre si subir o acampar: lea el {notice} y consulte al {insivumeh} y a la {conred} para ver las alertas.',
    noticeLink: 'aviso de arriba',
    labels: { rate: 'Explosiones', column: 'Columna de ceniza', drift: 'Desplazamiento respecto al campamento', ashfall: 'Caída de ceniza' },
    rate: (figure, one) => `${figure} ${one ? 'explosión' : 'explosiones'} por hora`,
    rateLine: (rate) => `${rate}.`,
    continuous: 'emisión continua',
    continuousLine: 'Emisión continua, por lo que el boletín no da un conteo por hora.',
    rateMissing: 'El boletín no dio tasa de explosiones.',
    columnRange: (min, top, above) =>
      `Columnas de ceniza de ${min} a ${top}${NBSP}m s.n.m., hasta ${above}${NBSP}m sobre la cumbre del Fuego.`,
    columnSingle: (top, above) => `Ceniza hasta ${top}${NBSP}m s.n.m., ${above}${NBSP}m sobre la cumbre del Fuego.`,
    columnMissing: 'El boletín no dio la altura de la columna de ceniza.',
    range: (min, max) => `${min} a ${max}`,
    driftPhrase: (groups: DriftGroup[]) =>
      groups
        .map((g, i) => `hacia ${list(g.directions.map((d) => `el ${COMPASS[d]}`))}, ${(i === 0 ? RELATION_FIRST : RELATION_AGAIN)[g.relation]}`)
        .join(', y '),
    driftFull: (km, where) => `La ceniza se desplaza ${km}${NBSP}km ${where}.`,
    driftNoKm: (where) => `La ceniza se desplaza ${where}. El boletín no dio la distancia del desplazamiento.`,
    driftNoDirection: (km) =>
      `La ceniza se desplaza ${km}${NBSP}km. El boletín no dio la dirección, así que no se sabe hacia dónde fue respecto al Acatenango.`,
    driftMissing: 'El boletín no dio distancia ni dirección del desplazamiento.',
    ashfall: (places) => `Caída de ceniza reportada en ${places}.`,
    ashfallUnnamed: 'Caída de ceniza reportada; el boletín no nombró comunidades.',
    ashfallMissing: 'El boletín no mencionó caída de ceniza.',
    summaryAsh: (top, where) => `ceniza hasta ${top}${NBSP}m${where ? `, desplazándose ${where}` : ''}`,
    summaryDrift: (where) => `ceniza desplazándose ${where}`,
    summaryNone: 'El boletín no dio tasa de explosiones, columna de ceniza ni desplazamiento.',
  },
  colophon: {
    terrain: (dem, published, exaggeration, relief, across) =>
      `Terreno de {aws}, derivado de SRTM y de dominio público. En el modelo, el Fuego mide ${dem} m, frente a los ${published} m publicados. El relieve vertical está exagerado ×${exaggeration} para que sus ${relief} km de desnivel en ${across} km se lean como se ven desde la cresta.`,
    representative: 'La serie que se muestra es representativa mientras se completa el archivo.',
    record: (count, first, last) =>
      `${count} boletines del {insivumeh}, del ${first} al ${last}, leídos de PDF escaneados mediante OCR. No todos los boletines indican todas las cifras, y una cifra omitida se muestra como un hueco, nunca como 0.`,
    field: { rate: 'tasa de explosiones', column: 'altura de la columna de ceniza', drift: 'distancia del desplazamiento' },
    completeness: (field, reported, total, continuous) =>
      `La ${field} se reportó en ${reported} de ${total} días${continuous ? `, y ${continuous} más fueron emisión continua, que no tiene conteo por hora` : ''}.`,
    rawKept:
      'Se guarda el texto original de cada boletín, así que mejorar el analizador vuelve a derivar todo el registro sin descargar nada de nuevo.',
  },
};
