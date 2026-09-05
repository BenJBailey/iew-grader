/**
 * Page layout heuristics: positioned lines of text -> paragraphs.
 *
 * Two input paths feed this. pdf.js hands back positioned text runs; Tesseract
 * hands back line bounding boxes from an OCR'd page image. Neither format
 * records paragraphs, so structure has to be inferred from coordinates -- and
 * since IEW grades per paragraph, a wrong break would silently corrupt every
 * checklist row. That's why both paths route through an editable review step
 * instead of grading straight away.
 *
 * Coordinates are in **PDF points** (1/72 inch) regardless of source. The OCR
 * path converts its pixel boxes before calling in, so that the one
 * scale-dependent constant here -- the indent threshold -- stays shared and
 * tuned once. See lib/extract/ocrLines.ts.
 *
 * The heuristics below are deliberately simple and easy to correct by hand.
 */

export type Line = { text: string; y: number; x: number }

/** A positioned text run, as much of pdf.js's TextItem as this file needs. */
type PositionedItem = { str: string; transform: number[] }

/** Group positioned runs into visual lines by their y coordinate. */
export function groupIntoLines(items: PositionedItem[]): Line[] {
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
 * into a PDF's coordinates, or out of an OCR'd image.
 *
 * Only one of the two fires on a double-spaced MLA paper: the line pitch is
 * uniform, so paragraphs are marked by the first-line indent alone.
 *
 * Lines must arrive in reading order. y is only ever compared as a magnitude,
 * so it doesn't matter whether it increases up the page (PDF) or down it
 * (image) -- don't "fix" the Math.abs calls below.
 */
export function joinIntoParagraphs(lines: Line[]): string[] {
  if (lines.length === 0) return []

  // Typical line spacing for this page, as a median of observed gaps.
  const gaps = lines
    .slice(1)
    .map((line, i) => Math.abs(lines[i].y - line.y))
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b)
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0

  const margin = fitLeftMargin(lines)

  const paragraphs: string[] = []
  let current = lines[0].text

  for (let i = 1; i < lines.length; i++) {
    const gap = Math.abs(lines[i - 1].y - lines[i].y)
    const isNewBlock = medianGap > 0 && gap > medianGap * 1.5
    const isIndented = lines[i].x > marginAt(margin, lines[i].y) + INDENT_POINTS

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

/**
 * How far past the left margin a line has to start to count as indented, in
 * points. 10pt is about 0.14in -- well under a 0.5in MLA first-line indent, and
 * well over the jitter between two flush-left lines.
 */
const INDENT_POINTS = 10

/**
 * The page's left margin, as a line rather than a number.
 *
 * A margin has to be a trend because on a photographed page it isn't vertical.
 * A page tilted by a degree or two -- or one whose deskew didn't quite land --
 * drags its margin sideways as it goes down, and on a real phone photo of a
 * two-page paper that drift measured ~20 points from the first line to the
 * last. That is twice the indent threshold, so against a fixed margin the
 * bottom half of the page reads as one indent after another and the essay comes
 * back as a list of lines.
 *
 * The slope is a Theil-Sen estimator -- the median of every pairwise slope --
 * because a least-squares fit would be dragged off by the very lines being
 * looked for. It tolerates roughly a quarter of the lines being indents, titles
 * or junk, which is comfortably more than a page of prose has. On a clean PDF
 * every pair is flush, the slope comes out zero, and this reduces to a constant.
 *
 * The intercept is then a low percentile rather than the minimum: one stray
 * mark left of the text would otherwise define the margin and, again, make
 * every line look indented.
 */
type MarginTrend = { intercept: number; slope: number }

const marginAt = (margin: MarginTrend, y: number) => margin.intercept + margin.slope * y

function fitLeftMargin(lines: Line[]): MarginTrend {
  const slope = medianPairwiseSlope(lines)
  const residuals = lines.map((line) => line.x - slope * line.y).sort((a, b) => a - b)

  return { slope, intercept: residuals[Math.floor(residuals.length * 0.25)] }
}

/**
 * Comparing every pair is O(n²), which is nothing for the tens of lines a page
 * holds, but a pathological input shouldn't be able to hang the tab.
 */
const MAX_LINES_TO_FIT = 300

function medianPairwiseSlope(lines: Line[]): number {
  const sample =
    lines.length <= MAX_LINES_TO_FIT
      ? lines
      : lines.filter((_, i) => i % Math.ceil(lines.length / MAX_LINES_TO_FIT) === 0)

  const slopes: number[] = []
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const rise = sample[j].y - sample[i].y
      if (rise !== 0) slopes.push((sample[j].x - sample[i].x) / rise)
    }
  }

  if (slopes.length === 0) return 0
  slopes.sort((a, b) => a - b)
  return slopes[Math.floor(slopes.length / 2)]
}
