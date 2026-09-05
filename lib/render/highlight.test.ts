import { describe, expect, it } from 'vitest'
import { normalizeText, tokenize } from '../nlp/tokenize'
import { classifyOpeners, runRules } from '../rules'
import { renderDocument, renderedParagraphText } from './highlight'
import { buildReport } from './report'

function pipeline(raw: string) {
  const text = normalizeText(raw)
  const doc = tokenize(text)
  const findings = runRules(doc)
  const openers = classifyOpeners(doc)
  return {
    doc,
    findings,
    openers,
    rendered: renderDocument(doc, findings, openers),
    report: buildReport(doc, findings, openers),
  }
}

/**
 * Two paragraphs. Each is a single line, because the app's rule is that any
 * newline starts a new paragraph -- sentences of one paragraph are never split
 * across lines.
 */
const SAMPLE = [
  'The determined boy who lived nearby ran swiftly through the woods. ' +
    'Because he was afraid, he quickly climbed a small tree.',
  'Slowly the frightened dog crept toward the silent stranger. He waited.',
].join('\n\n')

/** Every paragraph's segments must reassemble into its exact source slice. */
const expectLossless = (raw: string) => {
  const { rendered, doc } = pipeline(raw)
  for (const paragraph of rendered) {
    const source = doc.paragraphs[paragraph.index]
    expect(renderedParagraphText(paragraph)).toBe(doc.text.slice(source.start, source.end))
  }
}

describe('segment rendering', () => {
  it('reproduces the source text exactly', () => {
    expectLossless(SAMPLE)
  })

  it.each([
    'Quickly, the boy who ran swiftly smiled.',
    'The dog, which barked loudly, was big.',
    'He ran like the wind because he was late.',
    'One. Two three four. Five six seven eight nine.',
  ])('never loses or duplicates text: %s', expectLossless)

  it('puts both rules on the overlapping segment', () => {
    // "swiftly" sits inside the who/which clause AND is an -ly adverb.
    const { rendered } = pipeline('The boy who ran swiftly smiled at everyone.')
    const segments = rendered[0].parts.flatMap((p) =>
      p.kind === 'sentence' ? p.sentence.segments : [],
    )

    const swiftly = segments.find((s) => s.text.includes('swiftly'))
    expect(swiftly?.ruleIds).toEqual(expect.arrayContaining(['lyAdverb', 'whoWhich']))
  })

  it('leaves unmarked text with no rules attached', () => {
    const { rendered } = pipeline('The boy who ran swiftly smiled at everyone.')
    const segments = rendered[0].parts.flatMap((p) =>
      p.kind === 'sentence' ? p.sentence.segments : [],
    )
    expect(segments.some((s) => s.ruleIds.length === 0)).toBe(true)
  })

  it('turns whole-sentence findings into badges instead of spans', () => {
    const { rendered } = pipeline('Where did the frightened boy finally go?')
    const sentence = rendered[0].parts.find((p) => p.kind === 'sentence')
    expect(sentence?.kind === 'sentence' && sentence.sentence.badges.map((b) => b.ruleId)).toContain(
      'question',
    )
  })

  it('keeps paragraphs separate', () => {
    const { rendered } = pipeline(SAMPLE)
    expect(rendered).toHaveLength(2)
  })
})

describe('report', () => {
  it('counts findings per paragraph', () => {
    const { report } = pipeline(SAMPLE)
    expect(report.paragraphs).toHaveLength(2)
    expect(report.paragraphs[0].counts.whoWhich).toBe(1)
    expect(report.paragraphs[0].counts.wwwAsiaB).toBe(1)
  })

  it('flags banned words with their category', () => {
    const { report } = pipeline('The good dog was small.')
    const banned = report.paragraphs[0].bannedWords
    expect(banned.map((b) => b.word)).toEqual(['good', 'small'])
    expect(banned.every((b) => b.detail === 'banned adjective')).toBe(true)
    expect(banned.map((b) => b.word)).not.toContain('was')
  })

  it('reports opener variety across a paragraph', () => {
    const { report } = pipeline(SAMPLE)
    expect(report.paragraphs[0].openerVariety).toBeGreaterThan(1)
  })

  it('matches clincher key words through stemming', () => {
    const { report } = pipeline(
      'Adventure shaped the young explorer. He sailed for many years. ' +
        'That adventure changed the explorer forever.',
    )
    expect(report.paragraphs[0].clincher?.matched).toEqual(
      expect.arrayContaining(['adventure', 'explorer']),
    )
    expect(report.paragraphs[0].clincher?.ok).toBe(true)
  })

  it('returns no clincher for a single-sentence paragraph', () => {
    const { report } = pipeline('One lonely sentence stands here.')
    expect(report.paragraphs[0].clincher).toBeNull()
  })

  it('counts non-banned verbs and adjectives as candidates only', () => {
    const { report } = pipeline('The courageous explorer discovered a hidden waterfall.')
    expect(report.paragraphs[0].candidates.adjectives).toBeGreaterThan(0)
  })
})
