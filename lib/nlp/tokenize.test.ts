import { describe, expect, it } from 'vitest'
import { assertOffsetsExact, normalizeText, tokenize } from './tokenize'

/** Deliberately nasty: contractions, smart quotes, em dash, double spaces, unicode. */
const GNARLY = [
  'He didn’t go quickly.  She said “hello—friend” twice.',
  '',
  'Because the dog barked, the boy who lived nearby ran off.',
].join('\n')

describe('offset model', () => {
  it('slices every token back out of the source text', () => {
    expect(() => assertOffsetsExact(tokenize(GNARLY))).not.toThrow()
  })

  it('reassembles the source text byte for byte', () => {
    const doc = tokenize(GNARLY)
    // Gaps between tokens are whitespace only; rebuilding via offsets must be lossless.
    let rebuilt = ''
    let cursor = 0
    for (const token of doc.tokens) {
      rebuilt += doc.text.slice(cursor, token.start) + token.value
      cursor = token.end
    }
    rebuilt += doc.text.slice(cursor)
    expect(rebuilt).toBe(doc.text)
  })

  it.each([
    ['contraction', "He didn't go."],
    ['smart quotes', '“Stop!” she yelled.'],
    ['em dash', 'The dog—a big one—barked.'],
    ['double spaces', 'One.  Two.  Three.'],
    ['trailing newline', 'A sentence.\n'],
    ['single word', 'Run.'],
  ])('keeps offsets exact: %s', (_label, text) => {
    expect(() => assertOffsetsExact(tokenize(normalizeText(text)))).not.toThrow()
  })
})

describe('paragraphs', () => {
  it('treats a single newline as a paragraph break', () => {
    const doc = tokenize(normalizeText('First para.\nSecond para.'))
    expect(doc.paragraphs).toHaveLength(2)
  })

  it('treats a run of blank lines as one break, not several', () => {
    const doc = tokenize(normalizeText('First para.\n   \n\nSecond para.'))
    expect(doc.paragraphs).toHaveLength(2)
  })

  it('assigns each sentence to the right paragraph', () => {
    const doc = tokenize(normalizeText('One. Two.\nThree.'))
    expect(doc.paragraphs[0].sentences).toHaveLength(2)
    expect(doc.paragraphs[1].sentences).toHaveLength(1)
  })

  it('slices paragraph text cleanly at its own offsets', () => {
    const doc = tokenize(normalizeText('First para.\n\nSecond para.'))
    expect(doc.text.slice(doc.paragraphs[1].start, doc.paragraphs[1].end)).toBe('Second para.')
  })
})

describe('sentences', () => {
  it('skips leading newline tokens when locating the first word', () => {
    const doc = tokenize(normalizeText('One.\nQuickly he ran.'))
    const second = doc.sentences[1]
    expect(doc.tokens[second.firstWord].value).toBe('Quickly')
    expect(doc.text.slice(second.start, second.end)).toBe('Quickly he ran.')
  })

  it('counts only real words, not punctuation or newlines', () => {
    const doc = tokenize(normalizeText('The dog barked, loudly!'))
    expect(doc.sentences[0].wordCount).toBe(4)
  })
})

describe('normalizeText', () => {
  it('normalizes CRLF and strips trailing spaces', () => {
    expect(normalizeText('a.  \r\nb.')).toBe('a.\nb.')
  })

  it('preserves smart quotes and dashes rather than rewriting them', () => {
    const text = '“Hi—there”'
    expect(normalizeText(text)).toBe(text)
  })
})
