import type { Block } from 'tesseract.js'
import { describe, expect, it } from 'vitest'
import { joinIntoParagraphs } from './layout'
import { linesFromBlocks } from './ocrLines'

const DPI = 300
const inches = (n: number) => n * DPI

/** One Tesseract line box, in image pixels. */
type Box = { text: string; x: number; y: number; confidence?: number }

/** Rough per-character advance at 300dpi, only used to lay out fixture words. */
const CHARACTER_WIDTH = 25

/** Wrap boxes in the block/paragraph nesting Tesseract actually returns. */
function blocks(boxes: Box[]): Block[] {
  return [
    {
      paragraphs: [
        {
          lines: boxes.map((box) => {
            const confidence = box.confidence ?? 90
            let cursor = box.x

            const words = box.text.split(' ').map((text) => {
              const x0 = cursor
              cursor += (text.length + 1) * CHARACTER_WIDTH
              return {
                text,
                confidence,
                bbox: { x0, y0: box.y, x1: cursor - CHARACTER_WIDTH, y1: box.y + 40 },
              }
            })

            return {
              // Tesseract newline-terminates every visual line.
              text: `${box.text}\n`,
              confidence,
              bbox: { x0: box.x, y0: box.y, x1: cursor, y1: box.y + 40 },
              baseline: { x0: 0, y0: 0, x1: 0, y1: 0 },
              rowAttributes: { ascenders: 0, descenders: 0, rowHeight: 40 },
              words,
            }
          }),
        },
      ],
    },
  ] as unknown as Block[]
}

/**
 * A double-spaced MLA page as OCR would see it, skewed by `degrees`.
 *
 * A tilted page drags the left margin sideways as it goes down: x drifts by
 * tan(angle) * y. That is the exact quantity the indent cue measures, which is
 * why the skew has to be corrected before these boxes are produced.
 */
const MARGIN = inches(1)
const INDENT = inches(0.5)
const PITCH = inches(24 / 72) // double-spaced 12pt
const LINES_PER_PARAGRAPH = 10

/**
 * Per-line horizontal jitter, in pixels. Real line boxes are never flush to the
 * pixel: bbox.x0 is the leftmost ink, and a line opening with `W` starts
 * measurably left of one opening with `I` or a quotation mark. Deterministic so
 * the tests are.
 */
const jitter = (i: number) => ((i * 7) % 11) * 2

function mlaPage(degrees: number): Block[] {
  const slope = Math.tan((degrees * Math.PI) / 180)

  return blocks(
    Array.from({ length: LINES_PER_PARAGRAPH * 2 }, (_, i) => {
      const y = inches(1) + i * PITCH
      const startsParagraph = i % LINES_PER_PARAGRAPH === 0
      return {
        text: `line ${i}`,
        x: MARGIN + (startsParagraph ? INDENT : 0) + slope * y + jitter(i),
        y,
      }
    }),
  )
}

describe('linesFromBlocks', () => {
  it('converts pixel boxes to points', () => {
    const [line] = linesFromBlocks(blocks([{ text: 'Julius Caesar', x: inches(1), y: inches(2) }]), DPI)

    expect(line).toEqual({ text: 'Julius Caesar', x: 72, y: 144 })
  })

  it('strips the newline Tesseract puts on every line', () => {
    const [line] = linesFromBlocks(blocks([{ text: 'Julius Caesar', x: 0, y: 0 }]), DPI)

    expect(line.text).toBe('Julius Caesar')
  })

  it('drops specks: low confidence and one-character lines', () => {
    const lines = linesFromBlocks(
      blocks([
        { text: 'a real line of text', x: MARGIN, y: 300 },
        { text: 'garbled', x: MARGIN, y: 400, confidence: 12 },
        { text: '~', x: 10, y: 500 },
      ]),
      DPI,
    )

    expect(lines.map((line) => line.text)).toEqual(['a real line of text'])
  })

  it('handles a page with no blocks at all', () => {
    expect(linesFromBlocks(null, DPI)).toEqual([])
  })
})

describe('feeding OCR lines through joinIntoParagraphs', () => {
  const paragraphCount = (page: Block[], dpi = DPI) =>
    joinIntoParagraphs(linesFromBlocks(page, dpi)).length

  it('recovers paragraphs from a squarely photographed page', () => {
    expect(paragraphCount(mlaPage(0))).toBe(2)
  })

  it('tolerates the residual skew left after deskewing', () => {
    // Tesseract's rotateAuto ignores angles under ~0.3 degrees, so this is the
    // worst case it will hand back as "straight".
    expect(paragraphCount(mlaPage(0.2))).toBe(2)
  })

  it('recovers paragraphs from a page that was never straightened', () => {
    // A real phone photo came back with ~2 degrees of margin drift still in it
    // after Tesseract's own deskew -- over a page that is 20 points of sideways
    // travel, twice the indent threshold. Against a fixed margin the bottom of
    // the page reads as one indent after another; layout.ts fits the margin as
    // a sloped line for exactly this reason.
    expect(paragraphCount(mlaPage(2))).toBe(2)
  })

  it('measures the indent from the first real word, not the line box', () => {
    // A pencil tick or shadow edge in the margin gets swept into the line's
    // bounding box. Left in, it moves the line hundreds of pixels left and the
    // first-line indent vanishes.
    const page = mlaPage(0)
    const lines = page[0].paragraphs[0].lines
    const speck = { text: '°', confidence: 4, bbox: { x0: 100, y0: 0, x1: 130, y1: 30 } }

    for (const line of lines) {
      line.words = [speck, ...line.words] as typeof line.words
      line.bbox = { ...line.bbox, x0: speck.bbox.x0 }
    }

    expect(joinIntoParagraphs(linesFromBlocks(page, DPI))).toHaveLength(2)
  })

  it('drops a line that is nothing but specks', () => {
    const lines = linesFromBlocks(
      blocks([
        { text: 'a real line of text', x: MARGIN, y: 300 },
        { text: '| a', x: 40, y: 500, confidence: 20 },
      ]),
      DPI,
    )

    expect(lines.map((line) => line.text)).toEqual(['a real line of text'])
  })

  it('is defeated by leaving the boxes in pixels', () => {
    // Passing dpi = 72 is what "forgot to convert" looks like: layout.ts's
    // 10-point indent threshold gets compared against 300dpi pixels.
    expect(paragraphCount(mlaPage(0), 72)).toBeGreaterThan(2)
  })
})
