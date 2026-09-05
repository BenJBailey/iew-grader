import type { Block, Word } from 'tesseract.js'
import type { Line } from './layout'

/**
 * Tesseract's line boxes -> the positioned lines layout.ts understands.
 *
 * Pure and browser-free on purpose: this is the part of OCR whose failures are
 * silent (a wrong paragraph break corrupts every checklist row without ever
 * looking wrong), so it needs to be testable without a canvas or a wasm engine.
 */

/**
 * Below this, a "line" is a speck: a pencil mark, a staple hole, the edge of
 * whatever the page was photographed against. Real prose comes back around 95.
 */
const MIN_LINE_CONFIDENCE = 50
const MIN_CHARACTERS = 2

/**
 * A word this short and this badly recognized, at the very start or end of a
 * line, is not a word.
 *
 * This matters far more than it looks. A speck in the margin -- a pencil tick,
 * a shadow edge, a staple -- gets swept into the line's bounding box, and since
 * the paragraph indent is measured from where the line *starts*, one stray mark
 * moves the line hundreds of pixels left and makes a first-line indent
 * disappear. Measuring from the first real word instead is what makes indent
 * detection survive a photograph.
 */
const MIN_WORD_CONFIDENCE = 70
const MAX_SPECK_CHARACTERS = 2

const isSpeck = (word: Word) =>
  word.confidence < MIN_WORD_CONFIDENCE && word.text.trim().length <= MAX_SPECK_CHARACTERS

/** Drop specks from both ends. Interior ones are left alone -- they're words. */
function trimSpecks(words: Word[]): Word[] {
  let start = 0
  let end = words.length

  while (start < end && isSpeck(words[start])) start += 1
  while (end > start && isSpeck(words[end - 1])) end -= 1

  return words.slice(start, end)
}

export function linesFromBlocks(blocks: Block[] | null | undefined, dpi: number): Line[] {
  /**
   * Pixels -> PDF points. This conversion is the whole reason the OCR path can
   * share layout.ts: that file's indent threshold is 10 points, tuned against
   * real PDFs. Left in 300dpi pixels, 10 units would be a third of a
   * millimetre -- less than the wobble between two flush-left lines -- and
   * every single line would read as an indent, turning a five-paragraph essay
   * into sixty one-line paragraphs.
   */
  const toPoints = POINTS_PER_INCH / dpi
  const lines: Line[] = []

  // Flattened in Tesseract's own order, which is reading order -- it has
  // already done layout analysis. Sorting by y would gain nothing on an essay
  // and would scramble anything in columns.
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = trimSpecks(line.words ?? [])

        // Rebuilt from the surviving words rather than taken from line.text,
        // which still carries the specks -- and the newline Tesseract puts on
        // every visual line. Those newlines especially have to go:
        // findParagraphs() treats any newline as a paragraph break, so passing
        // them through would make every line its own paragraph. Re-deriving the
        // real breaks from geometry is the point of this file.
        const text = (words.length ? words.map((word) => word.text).join(' ') : line.text)
          .replace(/\s+/g, ' ')
          .trim()

        const confidence = words.length
          ? words.reduce((total, word) => total + word.confidence, 0) / words.length
          : line.confidence

        if (text.length < MIN_CHARACTERS) continue
        if (confidence < MIN_LINE_CONFIDENCE) continue

        lines.push({
          text,
          x: (words.length ? words[0].bbox.x0 : line.bbox.x0) * toPoints,
          // Image y grows downward where a PDF's grows upward. Nothing to do:
          // layout.ts only ever compares y as a magnitude.
          y: line.bbox.y0 * toPoints,
        })
      }
    }
  }

  return lines
}

const POINTS_PER_INCH = 72
