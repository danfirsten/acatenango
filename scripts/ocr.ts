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

import { selectFuegoPage } from '../src/lib/ocr';

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
    }
    return texts;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** OCRs a bulletin and returns just the Volcán de Fuego page. */
export async function ocrFuegoPage(pdf: Buffer): Promise<string | null> {
  const pages = await ocrPdf(pdf);
  return selectFuegoPage(pages)?.text ?? null;
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
