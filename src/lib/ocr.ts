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
