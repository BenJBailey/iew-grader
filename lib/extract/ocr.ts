import type { LoggerMessage, Worker, WorkerOptions } from 'tesseract.js'
import { joinIntoParagraphs } from './layout'
import { linesFromBlocks } from './ocrLines'
import { OCR_DPI, releaseCanvas } from './raster'

/**
 * Reading a page image with Tesseract, in the browser and nowhere else.
 *
 * Tesseract.js fetches its worker script, its wasm core and its English model
 * from a CDN by default -- three separate places, three separate options to
 * override. All three are pinned below to files served from this same site, so
 * a scanned paper is readable on a Raspberry Pi with the network unplugged and
 * the paper still never leaves the machine.
 *
 * Changing any path here without adding the file to
 * scripts/copy-static-assets.mjs silently reintroduces a CDN call. The only
 * honest test is DevTools' offline mode -- grepping the build for CDN hostnames
 * finds the unused defaults baked into Tesseract's own worker and tells you
 * nothing.
 */

const WORKER_OPTIONS: Partial<WorkerOptions> = {
  workerPath: '/tesseract/worker.min.js',
  // A directory, so Tesseract feature-detects SIMD and picks a core. Must not
  // end in "js" -- that's how it decides this is a directory and not a file.
  corePath: '/tesseract/',
  langPath: '/tessdata',
  // Default is a blob: URL wrapping an importScripts of the same file. Loading
  // the same-origin worker directly is one less indirection to explain.
  workerBlobURL: false,
  // Default mirrors the 5MB decompressed model into IndexedDB. On a shared
  // classroom machine that is real disk, to save re-fetching a file from a
  // server on the same LAN that the HTTP cache already holds.
  cacheMethod: 'none',
  legacyCore: false,
  legacyLang: false,
}

export type OcrPhase = 'starting' | 'model' | 'rendering' | 'reading'

export type OcrProgress = {
  phase: OcrPhase
  page: number
  pageCount: number
  /** How far into recognizing the current page, 0..1, when Tesseract says. */
  progress?: number
}

export type OcrSource = {
  pageNumber: number
  /** Rasterize this page. Called one at a time, immediately before reading it. */
  render: () => Promise<HTMLCanvasElement>
}

export type OcrPage = {
  pageNumber: number
  text: string
  /** How far the page had to be rotated to straighten it, in radians. */
  rotateRadians: number
}

export type OcrOptions = {
  onProgress?: (progress: OcrProgress) => void
  signal?: AbortSignal
}

const PHASE_FOR_STATUS: Record<string, OcrPhase> = {
  'loading tesseract core': 'starting',
  'initializing tesseract': 'starting',
  'initializing api': 'starting',
  'loading language traineddata': 'model',
  'recognizing text': 'reading',
}

function abortIfCancelled(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new DOMException('Reading was cancelled.', 'AbortError')
}

/**
 * OCR each page in turn, returning the text with paragraph breaks re-derived
 * from the geometry of the recognized lines.
 *
 * Strictly sequential, and each canvas is released as soon as it's been read: a
 * single letter-size page at 300dpi is ~34MB of RGBA before Tesseract makes its
 * own copy.
 */
export async function recognizePages(
  sources: OcrSource[],
  { onProgress, signal }: OcrOptions = {},
): Promise<OcrPage[]> {
  const tesseract = (await import('tesseract.js')).default

  // The logger is bound once, at worker creation, and starts reporting before
  // any page exists -- so it reads the page it should attribute progress to
  // from here rather than being told.
  let current = 0
  const report = (phase: OcrPhase, progress?: number) =>
    onProgress?.({ phase, page: current, pageCount: sources.length, progress })

  abortIfCancelled(signal)
  report('starting')

  const worker: Worker = await tesseract.createWorker('eng', tesseract.OEM.LSTM_ONLY, {
    ...WORKER_OPTIONS,
    logger: (message: LoggerMessage) => {
      const phase = PHASE_FOR_STATUS[message.status]
      if (phase) report(phase, phase === 'reading' ? message.progress : undefined)
    },
  })

  try {
    // Without this Tesseract estimates resolution from the image, and a page
    // rendered edge to edge gives it nothing to estimate from.
    await worker.setParameters({ user_defined_dpi: String(OCR_DPI) })

    // Tesseract's adaptive (Sauvola) thresholding is the textbook answer to a
    // shadowed photo, and it was measured against one here: it did read a few
    // more words correctly on the shadowed page, but it also found enough new
    // noise to fragment that page into eight paragraphs instead of one and to
    // push specks into two clean pages. Left on the default Otsu deliberately.

    const pages: OcrPage[] = []

    for (const source of sources) {
      abortIfCancelled(signal)
      current = source.pageNumber
      report('rendering')

      const canvas = await source.render()

      try {
        abortIfCancelled(signal)

        // rotateAuto fits the baselines and re-sets the image straightened,
        // which matters mostly for recognition accuracy -- Tesseract's line
        // recognizer degrades on tilted text. It does not fully straighten a
        // photographed page (a real one came back with ~2 degrees of margin
        // drift still in it), so layout.ts fits the margin as a sloped line
        // rather than trusting this to have finished the job.
        const { data } = await worker.recognize(canvas, { rotateAuto: true }, { blocks: true })

        pages.push({
          pageNumber: source.pageNumber,
          // Never data.text: Tesseract ends every visual line with a newline,
          // and one newline is one paragraph downstream.
          text: joinIntoParagraphs(linesFromBlocks(data.blocks, OCR_DPI)).join('\n'),
          rotateRadians: data.rotateRadians ?? 0,
        })
      } finally {
        releaseCanvas(canvas)
      }
    }

    return pages
  } finally {
    // Kills the underlying Web Worker outright, so a cancel takes effect even
    // mid-page.
    await worker.terminate()
  }
}
