/**
 * Source-agnostic text retrieval for bulletins.
 *
 * INSIVUMEH publishes some bulletins as HTML posts and some as PDFs, and which
 * one you get varies by day. Rather than guess, detect from the response and
 * extract accordingly.
 */

const USER_AGENT =
  'acatenango-fuego-monitor (+https://github.com/danfirsten/acatenango)';

export async function fetchWithRetry(
  url: string,
  attempts = 4,
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'follow',
      });
      if (res.ok) return res;
      // 4xx other than 429 will not improve on retry.
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`${url} returned ${res.status}`);
      }
      lastError = new Error(`${url} returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Strips markup, scripts and styles, leaving readable text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:p|div|br|li|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  // Imported lazily so the HTML path costs nothing.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // In pdfjs 6, destroy() lives on the loading task, not the document.
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Text extraction only — no canvas, no font rendering.
    useSystemFonts: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' '),
      );
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join('\n').trim();
}

/** Fetches a URL and returns its readable text, whether HTML or PDF. */
export async function fetchDocumentText(url: string): Promise<string> {
  const res = await fetchWithRetry(url);
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('pdf') || /\.pdf(?:$|\?)/i.test(url)) {
    return pdfToText(await res.arrayBuffer());
  }
  return htmlToText(await res.text());
}
