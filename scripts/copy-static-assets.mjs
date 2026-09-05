/**
 * Copies the pdf.js and Tesseract runtime assets into /public.
 *
 * Both libraries load parts of themselves by URL at runtime -- web workers,
 * wasm decoders, and Tesseract's English model -- and by default Tesseract
 * fetches its worker, core and traineddata from a CDN. That would break the
 * whole point of this app: it has to grade a paper on a LAN-only Raspberry Pi
 * with no internet, and student work must never leave the machine.
 *
 * So every one of those files is served from /public and pinned to a literal
 * path in the code (see lib/extract/pdf.ts and lib/extract/ocr.ts). Bundler-
 * resolved worker URLs wouldn't survive `output: 'export'` either way.
 *
 * Runs from predev/prebuild so it can't be forgotten, and the manifest is
 * exported so scripts/assets.test.mjs can fail the build when a dependency
 * bump moves one of these files.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * `from` copies one file, `fromDir` copies a directory's files (non-recursive).
 * Paths are relative to the repo root.
 */
export const ASSETS = [
  {
    from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
    to: 'public/pdf.worker.min.mjs',
  },
  // JPEG 2000 / JBIG2 / colour decoders. Only needed once we rasterize a page,
  // which is exactly what a scanned PDF makes us do.
  {
    fromDir: 'node_modules/pdfjs-dist/wasm',
    to: 'public/pdfjs/wasm',
  },
  {
    from: 'node_modules/tesseract.js/dist/worker.min.js',
    to: 'public/tesseract/worker.min.js',
  },
  // All three LSTM cores. Pointing `corePath` at a directory means Tesseract
  // feature-detects SIMD support and picks one at runtime, so a browser with
  // relaxed-SIMD would importScripts a 404 if we shipped only the baseline.
  // Each browser downloads exactly one; the other two just sit on disk.
  //
  // The `.wasm.js` files base64-embed the wasm, and the sibling `.wasm`
  // binaries are never fetched -- which also means the Pi's web server needs no
  // `application/wasm` MIME type configured. Don't "optimise" by copying the
  // raw .wasm files instead.
  {
    from: 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
    to: 'public/tesseract/tesseract-core-lstm.wasm.js',
  },
  {
    from: 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    to: 'public/tesseract/tesseract-core-simd-lstm.wasm.js',
  },
  {
    from: 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
    to: 'public/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js',
  },
  // `4.0.0_best_int` (2.8MB) rather than `4.0.0` (10.4MB): the larger file only
  // adds the legacy non-LSTM engine, which we don't use. This is the same model
  // Tesseract would fetch from its CDN by default.
  {
    from: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    to: 'public/tessdata/eng.traineddata.gz',
  },
]

function copy(source, destination) {
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
  return statSync(destination).size
}

export function copyStaticAssets() {
  let total = 0
  let files = 0

  for (const asset of ASSETS) {
    if (asset.fromDir) {
      const sourceDir = join(ROOT, asset.fromDir)
      for (const name of readdirSync(sourceDir)) {
        const source = join(sourceDir, name)
        if (!statSync(source).isFile()) continue
        total += copy(source, join(ROOT, asset.to, name))
        files += 1
      }
    } else {
      total += copy(join(ROOT, asset.from), join(ROOT, asset.to))
      files += 1
    }
  }

  return { files, megabytes: total / 1024 / 1024 }
}

// Only when run as a script, so the manifest can be imported by a test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { files, megabytes } = copyStaticAssets()
  console.log(`Copied ${files} static assets into public/ (${megabytes.toFixed(1)} MB)`)
}
