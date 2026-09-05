import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api'
import { groupIntoLines, joinIntoParagraphs } from './layout'

/**
 * PDF text extraction.
 *
 * A PDF stores positioned text runs, not paragraphs, so paragraph structure has
 * to be inferred from coordinates -- see lib/extract/layout.ts, which does that
 * for this path and for OCR alike. Of the input formats with a text layer this
 * is the least reliable, which is why the UI routes it through an editable
 * review step instead of grading it straight away.
 *
 * A PDF that is really a photograph -- a phone "scan" -- has no text layer at
 * all, and comes back with `needsOcr` set. Reading those is a separate, much
 * slower path the user opts into; see lib/extract/ocr.ts.
 */

export type PdfPageText = {
  pageNumber: number
  text: string
  /** No usable text layer: this page is an image and only OCR will read it. */
  needsOcr: boolean
}

/**
 * Below this many letters and digits, a page is treated as having no text
 * layer. A bare emptiness test isn't enough -- phone scanner apps stamp a page
 * number, a date or a filename onto the page as real text, and that would hide
 * a photograph behind a text layer of three characters. A real page of prose is
 * an order of magnitude past this.
 */
const MIN_ALPHANUMERICS = 40

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')

  // Both of these are copied into /public by scripts/copy-static-assets.mjs.
  // Literal paths are required because bundler-resolved URLs don't survive
  // `output: 'export'`.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjs
}

/**
 * Read whatever text layer the PDF has, a page at a time.
 *
 * The document is returned still open, because rasterizing for OCR needs it.
 * Callers own it and must `destroy()` it.
 */
export async function readPdfText(
  file: ArrayBuffer,
): Promise<{ pdf: PDFDocumentProxy; pages: PdfPageText[] }> {
  const pdfjs = await loadPdfjs()

  const pdf = await pdfjs.getDocument({
    data: file,
    // JPEG 2000, JBIG2 and colour decoding are wasm in pdf.js v6, and it
    // refuses to guess where they live. Only rasterizing needs them, so the
    // text-layer path never noticed this was missing. Trailing slash required.
    wasmUrl: '/pdfjs/wasm/',
  }).promise

  const pages: PdfPageText[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => 'str' in item)
    const text = joinIntoParagraphs(groupIntoLines(items)).join('\n')
    const alphanumerics = text.replace(/[^\p{L}\p{N}]/gu, '').length

    pages.push({ pageNumber, text, needsOcr: alphanumerics < MIN_ALPHANUMERICS })
  }

  return { pdf, pages }
}
