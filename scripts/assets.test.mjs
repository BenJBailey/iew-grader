import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSETS, ROOT } from './copy-static-assets.mjs'

/**
 * The offline guarantee rests on these files being served from /public. If a
 * pdfjs-dist or tesseract.js bump relocates one, the copy script would fail the
 * build -- but a stale public/ from a previous run would let it through and the
 * Pi would 404 at the worst possible moment. Fail here instead.
 */
describe('vendored static assets', () => {
  it.each(ASSETS.map((asset) => asset.from ?? asset.fromDir))('%s exists', (source) => {
    expect(existsSync(join(ROOT, source))).toBe(true)
  })
})
