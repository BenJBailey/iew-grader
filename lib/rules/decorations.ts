import type { TokenizedDoc } from '../nlp/tokenize'
import { WWW_ASIA_B } from '../data/openers'
import type { Finding } from './types'

const QUOTE_CHARS = new Set(['"', '“', '”', "'", '‘', '’'])

/**
 * Where the comparison stops: the next comma or subordinating conjunction,
 * otherwise the end of the sentence. Running a simile all the way to the full
 * stop would swallow whatever clause follows it -- in "growled like a distant
 * storm while the stranger waited", the www.asia.b clause is a separate finding
 * and shouldn't be buried under the simile's underline.
 */
function comparisonEnd(doc: TokenizedDoc, from: number, sentenceEnd: number): number {
  for (let i = from + 1; i <= sentenceEnd; i++) {
    const token = doc.tokens[i]
    const stops = token.value === ',' || (token.isWord && WWW_ASIA_B.has(token.normal))
    if (stops) return doc.tokens[i - 1].end
  }
  return doc.tokens[sentenceEnd].end
}

/** Does a main verb appear between `from` and `index`? */
function hasVerbBefore(doc: TokenizedDoc, index: number, from: number): boolean {
  for (let i = from; i < index; i++) {
    if (doc.tokens[i].pos === 'VERB') return true
  }
  return false
}

function sentenceFinding(
  doc: TokenizedDoc,
  sentenceIndex: number,
  ruleId: Finding['ruleId'],
  label: string,
): Finding {
  const sentence = doc.sentences[sentenceIndex]
  return {
    ruleId,
    channel: 'decoration',
    start: sentence.start,
    end: sentence.end,
    paragraph: sentence.paragraph,
    sentence: sentenceIndex,
    label,
  }
}

/** A sentence ending in a question mark. */
export function questions(doc: TokenizedDoc): Finding[] {
  return doc.sentences
    .filter((s) => doc.tokens[s.tokenEnd].value === '?')
    .map((s) => sentenceFinding(doc, s.index, 'question', 'question'))
}

/**
 * Similes only -- "like" used as a preposition, or the "as ... as" frame.
 * Metaphor is deliberately not attempted: recognizing one requires knowing that
 * a literal reading is false, which no rule can decide. Better to report nothing
 * than to report guesses a teacher would have to double-check anyway.
 */
export function similes(doc: TokenizedDoc): Finding[] {
  const findings: Finding[] = []

  for (const token of doc.tokens) {
    if (!token.isWord) continue
    const sentence = doc.sentences[token.sentence]
    if (!sentence) continue

    /*
     * "like" is a simile marker when the sentence ALREADY has a verb before it.
     *
     * POS alone gets this backwards in both directions: the tagger calls it NOUN
     * in "shimmered like scattered coins" (a real simile) and ADP in "the
     * children like warm bread" (a main verb). The reliable difference is
     * structural -- where "like" is the main verb, it's the only verb in the
     * clause; where it introduces a simile, the real verb came first.
     *
     * Checking merely the preceding word isn't enough either: it's a pronoun in
     * "the trees closed behind him like a heavy door", which is still a simile.
     */
    const isLikePreposition =
      token.normal === 'like' &&
      token.pos !== 'VERB' &&
      token.pos !== 'AUX' &&
      hasVerbBefore(doc, token.index, sentence.tokenStart)

    // "as <adjective> as" -- the second "as" confirms the comparison frame.
    let isAsAs = false
    if (token.normal === 'as') {
      for (let i = token.index + 1; i <= Math.min(token.index + 4, sentence.tokenEnd); i++) {
        if (doc.tokens[i].isWord && doc.tokens[i].normal === 'as') {
          isAsAs = true
          break
        }
      }
    }

    if (!isLikePreposition && !isAsAs) continue

    findings.push({
      ruleId: 'simile',
      channel: 'decoration',
      start: token.start,
      end: comparisonEnd(doc, token.index, sentence.tokenEnd),
      paragraph: token.paragraph,
      sentence: token.sentence,
      label: 'simile',
    })
  }

  return findings
}

/**
 * Alliteration: two or more nearby content words sharing a first letter.
 * Stop words are excluded (wink flags them) so "the tall tree" doesn't score on
 * "the", and the window is deliberately tight -- repeated letters far apart read
 * as coincidence rather than as a deliberate device.
 */
export function alliteration(doc: TokenizedDoc): Finding[] {
  const findings: Finding[] = []
  const content = doc.tokens.filter((t) => t.isWord && !t.isStop && /^[a-z]/i.test(t.value))
  const WINDOW = 3

  let run: typeof content = []
  for (let i = 0; i < content.length; i++) {
    const previous = run[run.length - 1]
    const sameLetter = previous && previous.normal[0] === content[i].normal[0]
    const nearby =
      previous &&
      content[i].sentence === previous.sentence &&
      content[i].index - previous.index <= WINDOW

    if (sameLetter && nearby) {
      run.push(content[i])
      continue
    }

    if (run.length >= 2) {
      findings.push({
        ruleId: 'alliteration',
        channel: 'decoration',
        start: run[0].start,
        end: run[run.length - 1].end,
        paragraph: run[0].paragraph,
        sentence: run[0].sentence,
        label: 'alliteration',
      })
    }
    run = [content[i]]
  }

  if (run.length >= 2) {
    findings.push({
      ruleId: 'alliteration',
      channel: 'decoration',
      start: run[0].start,
      end: run[run.length - 1].end,
      paragraph: run[0].paragraph,
      sentence: run[0].sentence,
      label: 'alliteration',
    })
  }

  return findings
}

/**
 * Triple extension (3sss): a series of three, as in "he ran, jumped, and fell".
 * Detected structurally -- at least two commas with a coordinating conjunction
 * after the last one.
 */
export function triples(doc: TokenizedDoc): Finding[] {
  const findings: Finding[] = []

  for (const sentence of doc.sentences) {
    const commas: number[] = []
    let conjunctionAfterLastComma = false

    for (let i = sentence.tokenStart; i <= sentence.tokenEnd; i++) {
      if (doc.tokens[i].value === ',') {
        commas.push(i)
        conjunctionAfterLastComma = false
      } else if (doc.tokens[i].pos === 'CCONJ' && commas.length >= 2) {
        conjunctionAfterLastComma = true
      }
    }

    if (commas.length >= 2 && conjunctionAfterLastComma) {
      findings.push(sentenceFinding(doc, sentence.index, 'triple', 'triple extension'))
    }
  }

  return findings
}

/** Conversation / quoted speech. */
export function quotations(doc: TokenizedDoc): Finding[] {
  return doc.sentences
    .filter((s) => {
      for (let i = s.tokenStart; i <= s.tokenEnd; i++) {
        if (QUOTE_CHARS.has(doc.tokens[i].value)) return true
      }
      return false
    })
    .map((s) => sentenceFinding(doc, s.index, 'quotation', 'conversation'))
}
