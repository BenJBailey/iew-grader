import type { Token, TokenizedDoc } from '../nlp/tokenize'
import { BANNED_LEMMAS, type BannedCategory } from '../data/bannedWords'
import { LY_EXCEPTIONS } from '../data/lyExceptions'
import { WWW_ASIA_B } from '../data/openers'
import type { Finding } from './types'

/** Walk forward to the end of a clause: the next comma, or the sentence end. */
function clauseEnd(doc: TokenizedDoc, from: number, sentenceEnd: number): number {
  for (let i = from; i <= sentenceEnd; i++) {
    if (doc.tokens[i].value === ',') return doc.tokens[i - 1]?.end ?? doc.tokens[i].start
  }
  return doc.tokens[sentenceEnd].end
}

/** Nearest real word before `index`, or null. */
function previousWord(doc: TokenizedDoc, index: number): Token | null {
  for (let i = index - 1; i >= 0; i--) {
    if (doc.tokens[i].isWord) return doc.tokens[i]
    if (doc.tokens[i].value === ',') continue // a clause may be set off by a comma
    if (doc.tokens[i].pos === 'PUNCT') return null
  }
  return null
}

/**
 * -ly adverbs. Gated on the POS tag first, then filtered through the exception
 * list -- the tagger handles most non-adverbs ("family", "reply"), and the list
 * covers both its mistakes and adverbs too empty to earn the dress-up ("only").
 */
export function lyAdverbs(doc: TokenizedDoc): Finding[] {
  return doc.tokens
    .filter(
      (t) =>
        t.isWord &&
        t.pos === 'ADV' &&
        t.normal.endsWith('ly') &&
        t.normal.length > 3 &&
        !LY_EXCEPTIONS.has(t.normal),
    )
    .map((t) => ({
      ruleId: 'lyAdverb' as const,
      channel: 'dressup' as const,
      start: t.start,
      end: t.end,
      paragraph: t.paragraph,
      sentence: t.sentence,
      label: '-ly adverb',
    }))
}

/**
 * who/which clauses. Two guards keep interrogatives out: the pronoun can't open
 * the sentence ("Which one?"), and it must follow a noun, since an IEW who/which
 * clause modifies one. That second guard is what rejects "I wonder which one" --
 * "wonder" is a verb, not the noun a relative clause would attach to.
 */
export function whoWhichClauses(doc: TokenizedDoc): Finding[] {
  const findings: Finding[] = []
  const relatives = new Set(['who', 'whom', 'whose', 'which'])

  for (const token of doc.tokens) {
    if (!token.isWord || !relatives.has(token.normal)) continue

    const sentence = doc.sentences[token.sentence]
    if (!sentence || token.index === sentence.firstWord) continue

    const antecedent = previousWord(doc, token.index)
    if (!antecedent || !['NOUN', 'PROPN', 'PRON'].includes(antecedent.pos)) continue

    findings.push({
      ruleId: 'whoWhich',
      channel: 'dressup',
      start: token.start,
      end: clauseEnd(doc, token.index + 1, sentence.tokenEnd),
      paragraph: token.paragraph,
      sentence: token.sentence,
      label: 'who/which clause',
    })
  }

  return findings
}

/**
 * Is the www.asia.b word at `index` actually introducing a CLAUSE?
 *
 * POS alone can't answer this. The tagger is inconsistent across these eight
 * words -- "when"/"where" come back ADV, "although" comes back ADP, the rest
 * SCONJ -- so gating on SCONJ would silently drop three of them.
 *
 * The reliable test is structural instead: a clause has a subject and a verb, so
 * require a VERB or AUX between the conjunction and the end of the clause. That
 * admits "since he ran" while rejecting the prepositional "since noon" and
 * "as a gift", which POS tagging alone gets wrong.
 */
export function isClausalUse(doc: TokenizedDoc, index: number): boolean {
  const token = doc.tokens[index]
  const sentence = doc.sentences[token.sentence]
  if (!sentence) return false

  // "When did he go?" is a question, not a www.asia.b clause.
  if (doc.tokens[sentence.tokenEnd].value === '?') return false

  for (let i = index + 1; i <= sentence.tokenEnd; i++) {
    if (doc.tokens[i].value === ',') break
    if (doc.tokens[i].pos === 'VERB' || doc.tokens[i].pos === 'AUX') return true
  }
  return false
}

/** Tags the tagger actually produces for www.asia.b words, in any position. */
const CLAUSAL_POS = ['SCONJ', 'ADV', 'ADP']

export function wwwAsiaBClauses(doc: TokenizedDoc): Finding[] {
  const findings: Finding[] = []

  for (const token of doc.tokens) {
    if (!token.isWord || !WWW_ASIA_B.has(token.normal)) continue
    if (!CLAUSAL_POS.includes(token.pos)) continue
    if (!isClausalUse(doc, token.index)) continue

    const sentence = doc.sentences[token.sentence]
    if (!sentence) continue

    findings.push({
      ruleId: 'wwwAsiaB',
      channel: 'dressup',
      start: token.start,
      end: clauseEnd(doc, token.index + 1, sentence.tokenEnd),
      paragraph: token.paragraph,
      sentence: token.sentence,
      label: 'www.asia.b clause',
    })
  }

  return findings
}

/**
 * Which POS tags a banned lemma is allowed to match. This is what keeps "like"
 * banned as a verb ("I like dogs") but permitted as the preposition in a simile
 * ("ran like the wind"). Note AUX alongside VERB -- wink tags "have" and "do" as
 * AUX, so omitting it would let "They have a spotted dog" through.
 */
const POS_FOR_CATEGORY: Record<BannedCategory, string[]> = {
  verb: ['VERB', 'AUX'],
  adjective: ['ADJ'],
  noun: ['NOUN'],
  adverb: ['ADV'],
  phrase: [],
}

/**
 * "have" and "do" are banned as main verbs ("I have a dog") but are pure grammar
 * as auxiliaries ("who HAD faced worse things", "did he go"). Flagging those
 * would be a false positive -- the real verb in "had faced" is "faced", which is
 * a perfectly strong one -- so the auxiliary reading is skipped.
 *
 * Be-verbs never reach this function: they are off the banned list entirely, so
 * they fail the lemma lookup in bannedWords() first.
 */
function isGrammaticalAuxiliary(doc: TokenizedDoc, token: Token): boolean {
  if (token.pos !== 'AUX') return false
  if (token.lemma !== 'have' && token.lemma !== 'do') return false

  const sentence = doc.sentences[token.sentence]
  if (!sentence) return false

  const following: Token[] = []
  for (let i = token.index + 1; i <= sentence.tokenEnd && following.length < 3; i++) {
    if (doc.tokens[i].isWord) following.push(doc.tokens[i])
  }
  if (following.length === 0) return false

  // Statement: the participle follows directly ("had faced").
  if (following[0].pos === 'VERB') return true

  // Question: the subject sits between them ("DID he leave?"), so look a little
  // further -- but only in a question, so "They have a spotted dog" still counts
  // as the banned main verb.
  const isQuestion = doc.tokens[sentence.tokenEnd].value === '?'
  return isQuestion && following.some((t) => t.pos === 'VERB')
}

export function bannedWords(doc: TokenizedDoc): Finding[] {
  const findings: Finding[] = []

  for (const token of doc.tokens) {
    if (!token.isWord) continue

    const category = BANNED_LEMMAS.get(token.lemma) ?? BANNED_LEMMAS.get(token.normal)
    if (!category) continue
    if (!POS_FOR_CATEGORY[category].includes(token.pos)) continue
    if (isGrammaticalAuxiliary(doc, token)) continue

    findings.push({
      ruleId: 'bannedWord',
      channel: 'banned',
      start: token.start,
      end: token.end,
      paragraph: token.paragraph,
      sentence: token.sentence,
      label: 'banned word',
      detail: `banned ${category}`,
    })
  }

  return findings
}
