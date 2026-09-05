import { describe, expect, it } from 'vitest'
import { type Line, groupIntoLines, joinIntoParagraphs } from './layout'

/** A pdf.js-shaped text run at (x, y). */
const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] })

/**
 * A page of double-spaced 12pt text with a 1in left margin, laid out the way an
 * MLA paper actually is: uniform line pitch, paragraphs marked by a 0.5in
 * first-line indent and nothing else.
 *
 * `lines` is a list of [text, indented] pairs, top of page first. `direction`
 * flips y so the same page can be fed in PDF coordinates (y up) or image
 * coordinates (y down).
 */
const MARGIN = 72
const INDENT = 36 // 0.5in
const PITCH = 24 // double-spaced 12pt

function mlaPage(
  lines: Array<[text: string, indented: boolean]>,
  direction: 'up' | 'down' = 'up',
): Line[] {
  return lines.map(([text, indented], i) => ({
    text,
    x: MARGIN + (indented ? INDENT : 0),
    y: direction === 'up' ? 700 - i * PITCH : 100 + i * PITCH,
  }))
}

const TWO_PARAGRAPHS: Array<[string, boolean]> = [
  ['For hundreds of years, pirates ruled the sea.', true],
  ['The pirates would ruthlessly raid ships and', false],
  ['kidnap the sailors.', false],
  ['During his travels, Caesar ran into pirates,', true],
  ['who kidnapped him and took him prisoner.', false],
]

describe('groupIntoLines', () => {
  it('merges runs that share a y coordinate', () => {
    const lines = groupIntoLines([item('Julius', 72, 700), item('Caesar', 110, 700)])
    expect(lines).toEqual([{ text: 'Julius Caesar', x: 72, y: 700 }])
  })

  it('tolerates sub-pixel y drift within a line', () => {
    const lines = groupIntoLines([item('Julius', 72, 700), item('Caesar', 110, 698.5)])
    expect(lines).toHaveLength(1)
  })

  it('starts a new line once y moves beyond the tolerance', () => {
    const lines = groupIntoLines([item('Julius', 72, 700), item('Caesar', 72, 676)])
    expect(lines.map((line) => line.text)).toEqual(['Julius', 'Caesar'])
  })

  it('does not double up spaces where runs already touch', () => {
    const lines = groupIntoLines([item('Julius ', 72, 700), item('Caesar', 110, 700)])
    expect(lines[0].text).toBe('Julius Caesar')
  })

  it('drops empty and whitespace-only runs', () => {
    const lines = groupIntoLines([item('', 72, 700), item('   ', 72, 676), item('Caesar', 72, 652)])
    expect(lines.map((line) => line.text)).toEqual(['Caesar'])
  })
})

describe('joinIntoParagraphs', () => {
  it('returns nothing for no lines', () => {
    expect(joinIntoParagraphs([])).toEqual([])
  })

  it('splits a double-spaced page on the first-line indent alone', () => {
    // The cue that matters most for real papers: line pitch is uniform, so the
    // vertical-gap cue never fires and the indent is carrying the whole load.
    const paragraphs = joinIntoParagraphs(mlaPage(TWO_PARAGRAPHS))

    expect(paragraphs).toEqual([
      'For hundreds of years, pirates ruled the sea. The pirates would ruthlessly raid ships and kidnap the sailors.',
      'During his travels, Caesar ran into pirates, who kidnapped him and took him prisoner.',
    ])
  })

  it('reads image coordinates (y down) the same as PDF coordinates (y up)', () => {
    // joinIntoParagraphs only ever compares y as a magnitude, which is what lets
    // the OCR path feed it top-down bounding boxes unchanged.
    expect(joinIntoParagraphs(mlaPage(TWO_PARAGRAPHS, 'down'))).toEqual(
      joinIntoParagraphs(mlaPage(TWO_PARAGRAPHS, 'up')),
    )
  })

  it('does not break on the uniform gaps of double spacing', () => {
    const flush = TWO_PARAGRAPHS.map(([text]) => [text, false] as [string, boolean])
    expect(joinIntoParagraphs(mlaPage(flush))).toHaveLength(1)
  })

  it('splits on an unusually large vertical gap', () => {
    const lines: Line[] = [
      { text: 'Topic sentence.', x: MARGIN, y: 700 },
      { text: 'Body of the paragraph.', x: MARGIN, y: 686 },
      { text: 'More of the same paragraph.', x: MARGIN, y: 672 },
      { text: 'A clearly separate block.', x: MARGIN, y: 600 },
    ]
    expect(joinIntoParagraphs(lines)).toHaveLength(2)
  })

  it('survives a stray line to the left of the margin', () => {
    // A page number, a pencil mark or background bleed at the edge of a photo.
    // Taken as *the* left margin it would make every body line look indented.
    const page = mlaPage(TWO_PARAGRAPHS)
    const withPageNumber: Line[] = [{ text: '2', x: MARGIN - 30, y: 724 }, ...page]

    const paragraphs = joinIntoParagraphs(withPageNumber)

    expect(paragraphs).toHaveLength(3)
    expect(paragraphs.slice(1)).toEqual(joinIntoParagraphs(page))
  })

  it('repairs a word split by an end-of-line hyphen', () => {
    const lines: Line[] = [
      { text: 'The pirates held him for ran-', x: MARGIN, y: 700 },
      { text: 'som, which they set at twenty talents.', x: MARGIN, y: 676 },
    ]
    expect(joinIntoParagraphs(lines)).toEqual([
      'The pirates held him for ransom, which they set at twenty talents.',
    ])
  })
})
