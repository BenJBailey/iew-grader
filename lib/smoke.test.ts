import { describe, expect, it } from 'vitest'
import { normalizeText, tokenize } from './nlp/tokenize'
import { classifyOpeners, runRules } from './rules'
import { renderDocument, renderedParagraphText } from './render/highlight'
import { buildReport } from './render/report'

/**
 * A realistic two-paragraph paper run through the whole pipeline. This is the
 * regression guard for the rules working *together* -- several findings here
 * were false positives or misses caught only by grading real prose rather than
 * one-sentence fixtures.
 */
const PAPER = [
  'The courageous knight who guarded the castle rode swiftly toward the darkened forest. ' +
    'Because the villagers were afraid, they wanted him to return before nightfall. He refused. ' +
    'Silently he urged his horse onward, and the trees closed behind him like a heavy door. ' +
    'That courageous knight never feared the forest.',
  'Deep inside the woods a small dragon was sleeping. ' +
    'Its scales shimmered like scattered coins while smoke curled slowly from its nostrils. ' +
    'The knight, who had faced worse danger, drew his sword calmly.',
].join('\n')

const text = normalizeText(PAPER)
const doc = tokenize(text)
const findings = runRules(doc)
const openers = classifyOpeners(doc)
const report = buildReport(doc, findings, openers)

const found = (ruleId: string) =>
  findings.filter((f) => f.ruleId === ruleId).map((f) => text.slice(f.start, f.end))

describe('end-to-end on a realistic paper', () => {
  it('renders every paragraph losslessly', () => {
    for (const paragraph of renderDocument(doc, findings, openers)) {
      const source = doc.paragraphs[paragraph.index]
      expect(renderedParagraphText(paragraph)).toBe(text.slice(source.start, source.end))
    }
  })

  it('finds each dress-up in both paragraphs', () => {
    for (const paragraph of report.paragraphs) {
      expect(paragraph.counts.lyAdverb).toBeGreaterThan(0)
      expect(paragraph.counts.whoWhich).toBe(1)
      expect(paragraph.counts.wwwAsiaB).toBe(1)
    }
  })

  it('spans clauses to their real boundaries', () => {
    expect(found('whoWhich')).toContain('who had faced worse danger')
    expect(found('wwwAsiaB')).toContain('Because the villagers were afraid')
  })

  it('finds both similes, including the one after a pronoun object', () => {
    expect(found('simile')).toHaveLength(2)
  })

  it('flags the weak verb and adjective but leaves the be-verbs alone', () => {
    const banned = found('bannedWord')
    expect(banned).toEqual(expect.arrayContaining(['wanted', 'small']))
    expect(banned).not.toContain('was') // be-verbs are helping verbs, not weak ones
    expect(banned).not.toContain('were')
  })

  it('drops a finding when the teacher unchecks that word', () => {
    const narrowed = runRules(doc, undefined, { bannedLemmas: new Set(['small']) })
    const banned = narrowed
      .filter((f) => f.ruleId === 'bannedWord')
      .map((f) => text.slice(f.start, f.end))

    expect(banned).toEqual(['small'])
  })

  it('recognizes a prepositional opener behind a leading modifier', () => {
    const types = openers.map((o) => o.type)
    expect(types).toContain(2) // "Deep inside the woods..."
    expect(types).toContain(5) // "Because the villagers were afraid..."
    expect(types).toContain(6) // "He refused."
    expect(types).toContain(3) // "Silently he urged..."
  })

  it('matches the clincher key words in the first paragraph', () => {
    expect(report.paragraphs[0].clincher?.matched).toEqual(
      expect.arrayContaining(['courageous', 'knight', 'forest']),
    )
    expect(report.paragraphs[0].clincher?.ok).toBe(true)
  })
})
