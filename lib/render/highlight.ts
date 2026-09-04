import type { TokenizedDoc } from '../nlp/tokenize'
import type { Finding, OpenerType, RuleId, SentenceOpener } from '../rules/types'

/**
 * Turning findings into renderable spans.
 *
 * The hard part is overlap: a who/which clause routinely contains an -ly adverb
 * and a banned word, and emitting one element per finding would produce
 * improperly nested markup. Instead every finding boundary is collected, sorted,
 * and the text is split at each one -- so a segment carries the full SET of rules
 * covering it and the nesting problem disappears.
 *
 *   Quickly, the boy who ran swiftly smiled.
 *   [-ly   ]        [who/which clause      ]
 *   |Quickly|, the boy |who ran |swiftly| smiled.|
 *                       clause   clause+ly
 *
 * Output is a data model, not an HTML string, so React can render it without
 * dangerouslySetInnerHTML -- student text never becomes markup.
 */

export type Segment = {
  text: string
  ruleIds: RuleId[]
}

export type RenderedSentence = {
  index: number
  opener: OpenerType
  segments: Segment[]
  /** Whole-sentence findings, shown as badges instead of underlining every word. */
  badges: Array<{ ruleId: RuleId; label: string }>
}

export type RenderedPart =
  | { kind: 'gap'; text: string }
  | { kind: 'sentence'; sentence: RenderedSentence }

export type RenderedParagraph = {
  index: number
  parts: RenderedPart[]
}

function segmentSentence(
  text: string,
  start: number,
  end: number,
  findings: Finding[],
): Segment[] {
  if (findings.length === 0) return [{ text: text.slice(start, end), ruleIds: [] }]

  // Every boundary that could change which rules apply.
  const boundaries = new Set<number>([start, end])
  for (const finding of findings) {
    if (finding.start > start && finding.start < end) boundaries.add(finding.start)
    if (finding.end > start && finding.end < end) boundaries.add(finding.end)
  }

  const points = [...boundaries].sort((a, b) => a - b)
  const segments: Segment[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    if (to <= from) continue

    const ruleIds = findings
      .filter((f) => f.start <= from && f.end >= to)
      .map((f) => f.ruleId)

    segments.push({ text: text.slice(from, to), ruleIds: [...new Set(ruleIds)] })
  }

  return segments
}

export function renderDocument(
  doc: TokenizedDoc,
  findings: Finding[],
  openers: SentenceOpener[],
): RenderedParagraph[] {
  const openerBySentence = new Map(openers.map((o) => [o.sentence, o]))

  return doc.paragraphs.map((paragraph) => {
    const parts: RenderedPart[] = []
    let cursor = paragraph.start

    for (const sentenceIndex of paragraph.sentences) {
      const sentence = doc.sentences[sentenceIndex]

      // Whitespace between sentences has to be preserved verbatim.
      if (sentence.start > cursor) {
        parts.push({ kind: 'gap', text: doc.text.slice(cursor, sentence.start) })
      }

      const own = findings.filter((f) => f.end > sentence.start && f.start < sentence.end)

      // A finding covering the whole sentence becomes a badge rather than an
      // underline across every word -- that's questions, quotations and triples.
      const badges = own
        .filter((f) => f.start <= sentence.start && f.end >= sentence.end)
        .map((f) => ({ ruleId: f.ruleId, label: f.label }))

      const inline = own
        .filter((f) => !(f.start <= sentence.start && f.end >= sentence.end))
        .map((f) => ({
          ...f,
          start: Math.max(f.start, sentence.start),
          end: Math.min(f.end, sentence.end),
        }))

      parts.push({
        kind: 'sentence',
        sentence: {
          index: sentenceIndex,
          opener: openerBySentence.get(sentenceIndex)?.type ?? 1,
          segments: segmentSentence(doc.text, sentence.start, sentence.end, inline),
          badges,
        },
      })

      cursor = sentence.end
    }

    if (cursor < paragraph.end) {
      parts.push({ kind: 'gap', text: doc.text.slice(cursor, paragraph.end) })
    }

    return { index: paragraph.index, parts }
  })
}

/**
 * Concatenates one paragraph's rendered pieces back into plain text.
 *
 * This guards the whole pipeline: a paragraph's segments must reassemble into
 * exactly its source slice. If a segment is ever dropped, duplicated, or
 * mis-sliced, a highlight has shifted -- so the tests assert this paragraph by
 * paragraph on every fixture. Deliberately scoped to a single paragraph rather
 * than the whole document, because the separator text BETWEEN paragraphs isn't
 * part of the model and joining with an assumed "\n" would be a lossy
 * reconstruction that hides real drift.
 */
export function renderedParagraphText(paragraph: RenderedParagraph): string {
  return paragraph.parts
    .map((part) =>
      part.kind === 'gap' ? part.text : part.sentence.segments.map((s) => s.text).join(''),
    )
    .join('')
}
