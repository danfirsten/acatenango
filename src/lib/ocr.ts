/**
 * Text-side helpers for reading OCR'd INSIVUMEH bulletins.
 *
 * The daily bulletin is a scanned PDF covering three volcanoes — Fuego,
 * Santiaguito and Pacaya — one per page. Each has its own explosion rate and
 * ash column, so parsing the document as a whole would blend them into
 * nonsense. Pages are OCR'd individually and the Fuego page is selected before
 * any parsing happens.
 *
 * Pure functions only; the rasterising and tesseract calls live in scripts/ocr.ts.
 */

/** How strongly a page looks like the Volcán de Fuego section. */
export function scoreFuegoPage(text: string): number {
  const t = text.toLowerCase();
  let score = 0;
  if (/ovfgo/.test(t)) score += 5;              // the Fuego observatory's code
  if (/volc[aá]n\s+de\s+fuego/.test(t)) score += 4;
  if (/3763|3,763/.test(t)) score += 2;         // Fuego's summit elevation
  // The other two volcanoes in the same bulletin.
  if (/ovsan|santiaguito|caliente/.test(t)) score -= 6;
  if (/ovpac|pacaya|mackenney/.test(t)) score -= 6;
  return score;
}

/** Picks the Fuego page from per-page OCR output, or null if none qualifies. */
export function selectFuegoPage(pages: string[]): { index: number; text: string } | null {
  let best = -1;
  let bestScore = 0;
  pages.forEach((text, i) => {
    const score = scoreFuegoPage(text);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best === -1 ? null : { index: best, text: pages[best] };
}

/**
 * Repairs the OCR damage that actually shows up in these scans, and nothing
 * else — an aggressive cleaner would invent numbers that were never printed.
 */
export function cleanOcrText(text: string): string {
  return text
    // Letter O read for a zero, but only when surrounded by digits.
    .replace(/(?<=\d)[OoQ](?=\d)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)/g, '1')
    // "4.200" / "4 200" thousands that lost their comma.
    .replace(/(?<=\d)\s(?=\d{3}\b)/g, ',')
    // msnm arrives in many broken spellings.
    .replace(/\bm\s?s\s?n\s?m\b/gi, 'msnm')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Narrows to the "Actividad" paragraph when it can be found. The sidebar of the
 * Fuego page carries the summit elevation and the observatory altitude, which
 * are easy to mistake for an ash column height.
 */
export function activitySection(text: string): string {
  const m = /Actividad\b([\s\S]{40,2600})/i.exec(text);
  return m ? m[1] : text;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

/**
 * Every date the document prints anywhere, as ISO strings.
 *
 * Returns all of them rather than picking one on purpose. These scans carry
 * more than one date — the bulletin's own, and sometimes site furniture caught
 * in the image ("lunes, 17 de agosto de 2026 ... Editar"). Choosing between
 * them by position would be guesswork; asking "does the document mention the
 * date we are about to file it under" is answerable.
 */
export function printedDates(text: string): string[] {
  const found = new Set<string>();
  const re = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    const day = Number(m[1]);
    if (day < 1 || day > 31) continue;
    found.add(`${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return [...found];
}

/**
 * Whether a bulletin filed under `date` actually says so.
 *
 * INSIVUMEH occasionally leaves a stale PDF at a day's URL. Filing that under
 * the requested date would silently attribute one day's volcano to another —
 * the same class of quiet wrong value that got the earlier link-scraping
 * approach removed.
 *
 * The cover page carries the bulletin's own date and is treated as the
 * authority. Later pages are only consulted when the cover yields nothing,
 * because they contain site furniture with unrelated dates of its own — real
 * page 2 of BVD-2026-08-21 prints "lunes, 17 de agosto de 2026 ... Editar".
 * Trusting that line would reject a perfectly good bulletin.
 *
 * A document with no legible date at all is accepted: OCR loses decorative
 * mastheads often enough that rejecting on silence would throw away real days.
 */
export function documentMentionsDate(pages: string[], date: string): boolean {
  const cover = pages.length > 0 ? printedDates(pages[0]) : [];
  const candidates = cover.length > 0 ? cover : printedDates(pages.join('\n'));
  return candidates.length === 0 ? true : candidates.includes(date);
}
