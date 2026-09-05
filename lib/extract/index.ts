import { normalizeText } from '../nlp/tokenize'
import { type OcrProgress, type OcrSource, recognizePages } from './ocr'
import { type PdfPageText, readPdfText } from './pdf'
import { HEIC_MESSAGE, assertDecodableImage, imageFileToCanvas, renderPdfPage } from './raster'

export type ExtractProgress = OcrProgress

export type ExtractOptions = {
  /**
   * Read page images with OCR. Off by default: it downloads several megabytes
   * of recognition model and takes tens of seconds, which is not something to
   * start because someone dropped the wrong file.
   */
  ocr?: boolean
  onProgress?: (progress: ExtractProgress) => void
  signal?: AbortSignal
}

export type ExtractResult = {
  text: string
  /** Shown in the review step so the teacher knows how much to trust the breaks. */
  warning?: string
  /** This file has page images that OCR could read, and OCR wasn't run. */
  ocrAvailable?: boolean
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.webp']

const PDF_WARNING =
  'PDFs store positioned text, not paragraphs, so the breaks below are a best guess. ' +
  'Check them before grading — paragraph breaks drive the per-paragraph checklist.'

const OCR_WARNING =
  'Read from a photo, so check it twice. Expect the odd misread word, and expect wrong ' +
  'paragraph breaks: an image holds no paragraph markers, so breaks are guessed from the ' +
  'first-line indent. Fix both here before grading — the checklist is scored per paragraph. ' +
  'Nothing was uploaded; the recognizer ran in this browser.'

/** Past roughly a degree, the deskew is worth mentioning rather than trusting. */
const NOTABLE_TILT_RADIANS = 0.02

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  // mammoth's package `browser` field swaps in browser-safe unzip internals, so
  // the default entry point works client-side under a bundler.
  const mammoth = (await import('mammoth')).default
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return normalizeText(result.value)
}

function describeOcrPages(pages: PdfPageText[]): string | null {
  const scanned = pages.filter((page) => page.needsOcr).map((page) => page.pageNumber)
  if (scanned.length === 0 || scanned.length === pages.length) return null

  const list = scanned.length === 1 ? `Page ${scanned[0]}` : `Pages ${scanned.join(', ')}`
  return `${list} held no text and ${scanned.length === 1 ? 'was' : 'were'} read from an image; the rest came through as text.`
}

function describeTilt(radians: number[]): string | null {
  const worst = Math.max(0, ...radians.map(Math.abs))
  if (worst < NOTABLE_TILT_RADIANS) return null

  const degrees = (worst * 180) / Math.PI
  return `A page was tilted about ${degrees.toFixed(0)}°, which makes the paragraph breaks less reliable than usual.`
}

async function extractPdfFile(
  buffer: ArrayBuffer,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const { pdf, pages } = await readPdfText(buffer)

  try {
    const scanned = pages.filter((page) => page.needsOcr)

    if (scanned.length === 0) {
      return { text: normalizeText(pages.map((page) => page.text).join('\n')), warning: PDF_WARNING }
    }

    if (!options.ocr) {
      return {
        text: normalizeText(pages.map((page) => page.text).join('\n')),
        ocrAvailable: true,
        // No warning: the UI offers OCR instead, which is the more useful thing
        // to say about a file we can't read yet.
      }
    }

    const sources: OcrSource[] = scanned.map((page) => ({
      pageNumber: page.pageNumber,
      render: async () => renderPdfPage(await pdf.getPage(page.pageNumber)),
    }))

    const recognized = await recognizePages(sources, options)
    const byPage = new Map(recognized.map((page) => [page.pageNumber, page.text]))

    return {
      text: normalizeText(pages.map((page) => byPage.get(page.pageNumber) ?? page.text).join('\n')),
      warning: [OCR_WARNING, describeOcrPages(pages), describeTilt(recognized.map((p) => p.rotateRadians))]
        .filter(Boolean)
        .join(' '),
    }
  } finally {
    // v6 moved teardown off the document: destroying the loading task is what
    // shuts down the pdf.js worker and frees the rendered pages.
    await pdf.loadingTask.destroy()
  }
}

async function extractImage(file: File, options: ExtractOptions): Promise<ExtractResult> {
  // Before offering OCR, not after accepting it -- a file this browser can't
  // decode should say so straight away.
  await assertDecodableImage(file)

  if (!options.ocr) return { text: '', ocrAvailable: true }

  const sources: OcrSource[] = [{ pageNumber: 1, render: () => imageFileToCanvas(file) }]
  const [page] = await recognizePages(sources, options)

  return {
    text: normalizeText(page.text),
    warning: [OCR_WARNING, describeTilt([page.rotateRadians])].filter(Boolean).join(' '),
  }
}

export async function extractFile(file: File, options: ExtractOptions = {}): Promise<ExtractResult> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.docx')) {
    return { text: await extractDocx(await file.arrayBuffer()) }
  }

  if (name.endsWith('.pdf')) {
    return extractPdfFile(await file.arrayBuffer(), options)
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return { text: normalizeText(await file.text()) }
  }

  if (IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return extractImage(file, options)
  }

  if (name.endsWith('.doc')) {
    throw new Error(
      'Legacy .doc files aren’t supported. Open it in Word and save as .docx, or paste the text.',
    )
  }

  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    // The magic-byte sniff would catch this anyway, but there's no reason to
    // download a recognition model before saying so.
    throw new Error(HEIC_MESSAGE)
  }

  throw new Error(`Unsupported file type: ${file.name}. Use .docx, .pdf, .txt, or a photo.`)
}
