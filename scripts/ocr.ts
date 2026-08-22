/**
 * Rasterise-and-recognise for the scanned INSIVUMEH bulletins.
 *
 * The daily PDF has no text layer — every page is a single scanned image — so
 * the only way in is OCR. Pages are rendered at 300 dpi greyscale with pdftoppm
 * and read by tesseract with the Spanish model.
 *
 * Requires `poppler-utils` and `tesseract-ocr` + `tesseract-ocr-spa`, installed
 * by .github/workflows/collect.yml.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { FUEGO_PAGE_CERTAIN, scoreFuegoPage, selectFuegoPage } from '../src/lib/ocr';

const exec = promisify(execFile);

/** Bulletins run to a handful of pages; a wildly longer one is not a bulletin. */
const MAX_PAGES = 12;

export async function ocrPdf(pdf: Buffer): Promise<string[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'bvd-'));
  try {
    const pdfPath = path.join(dir, 'in.pdf');
    await writeFile(pdfPath, pdf);

    // 300 dpi greyscale: enough for 9pt body text, and far cheaper than colour.
    await exec('pdftoppm', [
      '-r', '300', '-gray', '-png', '-l', String(MAX_PAGES), pdfPath, path.join(dir, 'pg'),
    ]);

    const pages = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    const texts: string[] = [];
    for (const page of pages) {
      // `--psm 6` treats the page as a uniform block, which handles the
      // bulletin's two-column sidebar-plus-body layout far better than auto.
      const { stdout } = await exec('tesseract', [
        path.join(dir, page), 'stdout', '-l', 'spa', '--psm', '6',
      ], { maxBuffer: 8 << 20 });
      texts.push(stdout);

      // Stop once the cover (for the date) and an unmistakable Fuego page are
      // both in hand. The remaining pages are Santiaguito and Pacaya, and OCR
      // at 300 dpi is by far the slowest step in the collector.
      if (texts.length > 1 && scoreFuegoPage(stdout) >= FUEGO_PAGE_CERTAIN) break;
    }
    return texts;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface OcrBulletin {
  /** The Volcán de Fuego page, or null if none of the pages is Fuego's. */
  fuego: string | null;
  /** Every page's text, in order. Page 0 is the cover, which carries the date. */
  pages: string[];
}

/**
 * OCRs a bulletin, returning the Fuego page and the whole document.
 *
 * Both are needed: activity is parsed from the Fuego page alone, but the
 * bulletin prints its own date on the cover, so verifying the date requires
 * text this record will not otherwise keep.
 */
export async function ocrBulletin(pdf: Buffer): Promise<OcrBulletin> {
  const pages = await ocrPdf(pdf);
  return { fuego: selectFuegoPage(pages)?.text ?? null, pages };
}

/** True when the OCR tooling this module shells out to is present. */
export async function ocrAvailable(): Promise<boolean> {
  try {
    await Promise.all([exec('pdftoppm', ['-v']), exec('tesseract', ['--version'])]);
    return true;
  } catch {
    return false;
  }
}
