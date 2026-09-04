import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { normalizeText } from '../nlp/tokenize'

/**
 * PDF text extraction.
 *
 * This is the least reliable input path in the app, and knowingly so: pdf.js
 * returns positioned text runs, not paragraphs, so paragraph structure has to be
 * inferred from coordinates. Since IEW grades per paragraph, a wrong break would
 * silently corrupt every checklist row -- which is exactly why the UI routes this
 * through an editable review step instead of grading it straight away.
 *
 * The heuristics below are deliberately simple and easy to correct by hand.
 */

type Line = { text: string; y: number; x: number }

/** Group positioned runs into visual lines by their y coordinate. */
function groupIntoLines(items: TextItem[]): Line[] {
  const lines: Line[] = []
  const Y_TOLERANCE = 2

  for (const item of items) {
    if (!item.str) continue
    const x = item.transform[4]
    const y = item.transform[5]

    const current = lines[lines.length - 1]
    if (current && Math.abs(current.y - y) <= Y_TOLERANCE) {
      // Same line: insert a space only if the runs aren't already touching.
      const needsSpace = !current.text.endsWith(' ') && !item.str.startsWith(' ')
      current.text += (needsSpace ? ' ' : '') + item.str
    } else {
      lines.push({ text: item.str, y, x })
    }
  }

  return lines.map((line) => ({ ...line, text: line.text.trim() })).filter((line) => line.text)
}

/**
 * Join lines into paragraphs. A new paragraph starts on an unusually large
 * vertical gap, or on a first-line indent -- the two cues that actually survive
 * into a PDF's coordinates.
 */
function joinIntoParagraphs(lines: Line[]): string[] {
  if (lines.length === 0) return []

  // Typical line spacing for this page, as a median of observed gaps.
  const gaps = lines
    .slice(1)
    .map((line, i) => Math.abs(lines[i].y - line.y))
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b)
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0

  const leftMargin = Math.min(...lines.map((line) => line.x))

  const paragraphs: string[] = []
  let current = lines[0].text

  for (let i = 1; i < lines.length; i++) {
    const gap = Math.abs(lines[i - 1].y - lines[i].y)
    const isNewBlock = medianGap > 0 && gap > medianGap * 1.5
    const isIndented = lines[i].x > leftMargin + 10

    if (isNewBlock || isIndented) {
      paragraphs.push(current)
      current = lines[i].text
      continue
    }

    // Same paragraph: repair words split by an end-of-line hyphen.
    if (current.endsWith('-')) current = current.slice(0, -1) + lines[i].text
    else current += ' ' + lines[i].text
  }

  paragraphs.push(current)
  return paragraphs.filter((p) => p.trim())
}

export async function extractPdf(file: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')

  // The worker is copied into /public by scripts/copy-pdf-worker.mjs. A literal
  // path is required because bundler-resolved worker URLs don't survive
  // `output: 'export'`.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const pdf = await pdfjs.getDocument({ data: file }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => 'str' in item)
    pages.push(joinIntoParagraphs(groupIntoLines(items)).join('\n\n'))
  }

  return normalizeText(pages.join('\n\n'))
}
