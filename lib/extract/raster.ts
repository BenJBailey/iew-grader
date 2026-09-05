import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'

/**
 * Turning pages into pixels for OCR.
 *
 * Everything here is browser-only and deliberately sequential: one page-sized
 * canvas is already ~34MB of RGBA, and Tesseract allocates its own copy on top,
 * so holding several at once is how you take a Chromebook's tab down.
 */

/**
 * Render resolution. 300dpi puts a 12pt capital at roughly 35px, comfortably
 * above the ~20px Tesseract wants, with margin for a shadowed or skewed photo.
 * 200 is noticeably faster and still legible if that trade is ever worth making.
 */
export const OCR_DPI = 300

/** PDF user space is 1/72in, so a scale of dpi/72 renders at that resolution. */
const POINTS_PER_INCH = 72

/**
 * Refuse to allocate more than this. A stray oversized page (a poster, an A0
 * scan) at 300dpi would otherwise ask for hundreds of megabytes; scaling it
 * down loses accuracy, but not nearly as much as crashing the tab.
 */
const MAX_PIXELS = 40_000_000

/** Longest edge to feed OCR from a camera photo. */
const MAX_IMAGE_EDGE = 3300

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width)
  canvas.height = Math.ceil(height)
  return canvas
}

/**
 * Free a canvas's backing store immediately rather than waiting for GC -- the
 * same trick pdf.js's own canvas factory uses when it's done with one.
 */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** Rasterize one PDF page. */
export async function renderPdfPage(page: PDFPageProxy, dpi = OCR_DPI): Promise<HTMLCanvasElement> {
  let scale = dpi / POINTS_PER_INCH
  const full = page.getViewport({ scale })

  if (full.width * full.height > MAX_PIXELS) {
    scale *= Math.sqrt(MAX_PIXELS / (full.width * full.height))
  }

  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(viewport.width, viewport.height)

  // pdf.js v6 takes the canvas itself; `canvasContext` is the deprecated path
  // and requires `canvas: null`. Background defaults to white, which is what
  // OCR wants anyway.
  await page.render({ canvas, viewport }).promise

  return canvas
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'])

/**
 * HEIC is the default iPhone photo format and no browser outside Safari on
 * Apple platforms can decode it -- and handing the raw file to Tesseract
 * doesn't help either, since Leptonica has no HEIF support and fails with a
 * useless "Error attempting to read image".
 *
 * Checked by magic bytes as well as by name, because iOS sometimes hands over a
 * HEIC file called `.jpg`.
 */
function isHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const box = String.fromCharCode(...bytes.subarray(4, 8))
  if (box !== 'ftyp') return false
  return HEIF_BRANDS.has(String.fromCharCode(...bytes.subarray(8, 12)))
}

export const HEIC_MESSAGE =
  'iPhone photos in HEIC format can’t be read here. Two ways to get a .jpg: on the phone, ' +
  'Settings → Camera → Formats → Most Compatible, then retake the photo; or share the photo ' +
  'you have by email or AirDrop to a Windows or Android device, which converts it on the way.'

/**
 * Reject an image this browser can't decode, before offering to read it.
 *
 * Worth doing up front rather than when OCR starts: being told "this is a scan,
 * shall I read it?" and only then that it can't be read is a worse experience
 * than being told immediately, and it costs a 12-byte read to avoid.
 */
export async function assertDecodableImage(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (isHeif(bytes)) throw new Error(HEIC_MESSAGE)
}

/**
 * Decode an image file to a canvas, downscaled to something OCR can chew.
 *
 * A 12MP phone photo of a letter-size page is around 475dpi -- past the point
 * of any accuracy gain, and Tesseract's runtime scales with pixel count, so
 * feeding it whole turns 30 seconds into three minutes.
 */
export async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  await assertDecodableImage(file)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Most likely a HEIF variant the sniff above missed.
    throw new Error(`Could not read ${file.name} as an image. ${HEIC_MESSAGE}`)
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser would not provide a canvas to read the image with.')

    // Tesseract binarizes against a light background; a transparent PNG would
    // otherwise composite to black and come back empty.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return canvas
  } finally {
    bitmap.close()
  }
}
