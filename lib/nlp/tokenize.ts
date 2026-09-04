import winkNLP, { type Document, type ItsFunction } from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

/**
 * Tokenization and the character-offset model that every rule depends on.
 *
 * The important subtlety: wink-nlp's `its.span` returns TOKEN indexes, not
 * character offsets, so it cannot be used to position highlights. Real character
 * offsets are reconstructed from `its.precedingSpaces` + `its.value`, which
 * together reproduce the source text exactly -- verified for contractions
 * ("didn't" -> "did" + "n't"), smart quotes, em dashes, runs of spaces, and
 * newlines. `assertOffsetsExact` below enforces that invariant at runtime.
 */

const nlp = winkNLP(model)
const its = nlp.its

/**
 * wink-nlp declares `its.lemma` and `its.stem` as (index, rdd, addons) while its
 * own ItsFunction union expects (index, token, cache, addons) -- an upstream
 * typing inconsistency. Both work correctly at runtime, so the cast is confined
 * to this one helper rather than scattered at each call site.
 */
const addonIts = (fn: unknown) => fn as ItsFunction<string>

export type Token = {
  index: number
  value: string
  /** Lowercased, spelling-normalized form. */
  normal: string
  lemma: string
  /** Universal POS tag: NOUN, VERB, AUX, ADJ, ADV, ADP, SCONJ, PRON, PUNCT, SPACE... */
  pos: string
  stem: string
  isStop: boolean
  /** True for real words -- excludes punctuation and newline tokens. */
  isWord: boolean
  start: number
  end: number
  sentence: number
  paragraph: number
}

export type Sentence = {
  index: number
  paragraph: number
  /** Character range, trimmed of leading/trailing whitespace tokens. */
  start: number
  end: number
  /** Token index range, inclusive, as wink reports it. */
  tokenStart: number
  tokenEnd: number
  /** Index of the first real word -- wink includes leading newline tokens in a span. */
  firstWord: number
  /** Number of real words, used for the #6 VSS test. */
  wordCount: number
}

export type Paragraph = {
  index: number
  start: number
  end: number
  sentences: number[]
}

export type TokenizedDoc = {
  text: string
  tokens: Token[]
  sentences: Sentence[]
  paragraphs: Paragraph[]
}

/**
 * Normalize once, at the door. The result is simultaneously what rules index
 * into and what gets displayed -- if those two ever diverge, every highlight
 * lands in the wrong place. So this is deliberately non-lossy: line endings and
 * trailing spaces only, never smart-quote or dash rewriting.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Paragraph ranges. A run of newlines -- with any spaces or tabs mixed in --
 * is a single break, so "one newline starts a new paragraph" holds whether the
 * source used single or double spacing. Extractors and the review textarea are
 * responsible for not hard-wrapping lines mid-paragraph.
 */
function findParagraphs(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  const separator = /(?:[ \t]*\n[ \t]*)+/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = separator.exec(text)) !== null) {
    if (match.index > cursor) ranges.push({ start: cursor, end: match.index })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) ranges.push({ start: cursor, end: text.length })

  return ranges.length > 0 ? ranges : [{ start: 0, end: text.length }]
}

export function tokenize(text: string): TokenizedDoc {
  const doc: Document = nlp.readDoc(text)

  const values = doc.tokens().out(its.value)
  const spaces = doc.tokens().out(its.precedingSpaces)
  const normals = doc.tokens().out(its.normal)
  const lemmas = doc.tokens().out(addonIts(its.lemma))
  const posTags = doc.tokens().out(its.pos)
  const stems = doc.tokens().out(addonIts(its.stem))
  const stops = doc.tokens().out(its.stopWordFlag)
  const types = doc.tokens().out(its.type)

  const paragraphRanges = findParagraphs(text)

  // Walk the token stream accumulating character positions.
  const tokens: Token[] = []
  let cursor = 0
  let paragraph = 0

  for (let i = 0; i < values.length; i++) {
    cursor += spaces[i].length
    const start = cursor
    cursor += values[i].length

    // Advance the paragraph counter once we've moved past the current range.
    while (
      paragraph < paragraphRanges.length - 1 &&
      start >= paragraphRanges[paragraph + 1].start
    ) {
      paragraph++
    }

    tokens.push({
      index: i,
      value: values[i],
      normal: normals[i],
      lemma: lemmas[i],
      pos: posTags[i],
      stem: stems[i],
      isStop: Boolean(stops[i]),
      isWord: types[i] === 'word',
      start,
      end: cursor,
      sentence: -1,
      paragraph,
    })
  }

  // Sentences. wink includes leading newline tokens in a sentence's span, so the
  // first *word* has to be located explicitly -- opener classification reads it.
  const sentences: Sentence[] = []
  const spans = doc.sentences().out(its.span) as unknown as Array<[number, number]>

  spans.forEach(([tokenStart, tokenEnd], index) => {
    let firstWord = tokenStart
    while (firstWord <= tokenEnd && !tokens[firstWord].isWord) firstWord++
    if (firstWord > tokenEnd) firstWord = tokenStart

    let wordCount = 0
    for (let i = tokenStart; i <= tokenEnd; i++) {
      tokens[i].sentence = index
      if (tokens[i].isWord) wordCount++
    }

    sentences.push({
      index,
      paragraph: tokens[firstWord].paragraph,
      start: tokens[firstWord].start,
      end: tokens[tokenEnd].end,
      tokenStart,
      tokenEnd,
      firstWord,
      wordCount,
    })
  })

  const paragraphs: Paragraph[] = paragraphRanges.map((range, index) => ({
    index,
    start: range.start,
    end: range.end,
    sentences: sentences.filter((s) => s.paragraph === index).map((s) => s.index),
  }))

  return { text, tokens, sentences, paragraphs }
}

/**
 * The load-bearing invariant: every token's recorded offsets must slice its own
 * value back out of the source, and the whole stream must reassemble the source
 * byte for byte. Cheap to check and it turns silent highlight drift into a loud
 * failure, so the tests call it on every fixture.
 */
export function assertOffsetsExact(doc: TokenizedDoc): void {
  for (const token of doc.tokens) {
    const sliced = doc.text.slice(token.start, token.end)
    if (sliced !== token.value) {
      throw new Error(
        `Offset drift at token ${token.index}: expected ${JSON.stringify(
          token.value,
        )} but text slice is ${JSON.stringify(sliced)}`,
      )
    }
  }
}
