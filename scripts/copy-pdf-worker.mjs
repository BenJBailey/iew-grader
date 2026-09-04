/**
 * Copies the pdf.js worker into /public.
 *
 * pdf.js runs parsing in a web worker loaded by URL at runtime. Bundler-resolved
 * worker paths don't survive `output: 'export'`, so the file is served as a
 * static asset from a literal path instead (see lib/extract/pdf.ts). Runs from
 * predev/prebuild so it can't be forgotten.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
const destination = join(root, 'public/pdf.worker.min.mjs')

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)
console.log('Copied pdf.js worker to public/pdf.worker.min.mjs')
