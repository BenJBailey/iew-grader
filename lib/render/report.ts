import type { TokenizedDoc } from '../nlp/tokenize'
import { BANNED_LEMMAS } from '../data/bannedWords'
import type { Finding, OpenerType, RuleId, SentenceOpener } from '../rules/types'

export type ClincherReport = {
  /** Key words the closing sentence repeats from the opening sentence. */
  matched: string[]
  /** IEW asks for 2-3 repeated key words. */
  ok: boolean
}

export type ParagraphReport = {
  index: number
  sentenceCount: number
  /** Findings per rule, for the checklist columns. */
  counts: Record<RuleId, number>
  /** How many sentences used each opener type. */
  openers: Record<OpenerType, number>
  /** Distinct opener types used -- IEW grades variety, not any single opener. */
  openerVariety: number
  bannedWords: Array<{ word: string; detail: string }>
  clincher: ClincherReport | null
  repeated: Array<{ word: string; count: number }>
  /**
   * Verbs and adjectives that are NOT on the banned list. These are candidates
   * only: no rule can tell a "strong verb" from an ordinary one, so these are
   * reported as counts and never highlighted as if confirmed.
   */
  candidates: { verbs: number; adjectives: number }
}

export type DocumentReport = {
  paragraphs: ParagraphReport[]
  totals: Record<RuleId, number>
  openerTotals: Record<OpenerType, number>
  wordCount: number
  sentenceCount: number
}

const EMPTY_OPENERS = (): Record<OpenerType, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })

/**
 * Key-word overlap between a paragraph's first and last sentence -- IEW's
 * topic-sentence/clincher rule. Comparing Porter stems rather than raw words is
 * what lets "adventure" in the topic sentence match "adventures" in the
 * clincher, which is exactly the repetition the rule is asking students for.
 */
function analyzeClincher(doc: TokenizedDoc, sentenceIndexes: number[]): ClincherReport | null {
  if (sentenceIndexes.length < 2) return null

  const contentStems = (sentenceIndex: number) => {
    const sentence = doc.sentences[sentenceIndex]
    const stems = new Map<string, string>()
    for (let i = sentence.tokenStart; i <= sentence.tokenEnd; i++) {
      const token = doc.tokens[i]
      if (token.isWord && !token.isStop && token.normal.length > 2) {
        stems.set(token.stem, token.normal)
      }
    }
    return stems
  }

  const topic = contentStems(sentenceIndexes[0])
  const clincher = contentStems(sentenceIndexes[sentenceIndexes.length - 1])

  const matched: string[] = []
  for (const [stem, word] of clincher) {
    if (topic.has(stem)) matched.push(word)
  }

  return { matched, ok: matched.length >= 2 }
}

/** Content words used often enough in one paragraph to read as repetitive. */
function findRepeated(doc: TokenizedDoc, paragraphIndex: number) {
  const counts = new Map<string, { word: string; count: number }>()

  for (const token of doc.tokens) {
    if (token.paragraph !== paragraphIndex) continue
    if (!token.isWord || token.isStop || token.normal.length <= 3) continue

    const entry = counts.get(token.stem)
    if (entry) entry.count++
    else counts.set(token.stem, { word: token.normal, count: 1 })
  }

  return [...counts.values()].filter((e) => e.count > 3).sort((a, b) => b.count - a.count)
}

export function buildReport(
  doc: TokenizedDoc,
  findings: Finding[],
  openers: SentenceOpener[],
): DocumentReport {
  const emptyCounts = () => ({}) as Record<RuleId, number>

  const paragraphs: ParagraphReport[] = doc.paragraphs.map((paragraph) => {
    const own = findings.filter((f) => f.paragraph === paragraph.index)
    const counts = emptyCounts()
    for (const finding of own) counts[finding.ruleId] = (counts[finding.ruleId] ?? 0) + 1

    const openerCounts = EMPTY_OPENERS()
    for (const opener of openers) {
      if (opener.paragraph === paragraph.index) openerCounts[opener.type]++
    }

    let verbs = 0
    let adjectives = 0
    for (const token of doc.tokens) {
      if (token.paragraph !== paragraph.index || !token.isWord) continue
      // Deliberately the FULL banned list, not the subset the teacher ticked for
      // this paper. Unticking a word means "don't flag it here", not "it's a
      // strong verb now", so it still shouldn't be offered up as a candidate.
      const banned = BANNED_LEMMAS.has(token.lemma) || BANNED_LEMMAS.has(token.normal)
      if (banned) continue
      // Be-verbs are off the banned list, but they aren't strong-verb candidates
      // either -- "was" is grammar, not a verb choice a teacher would grade.
      if (token.lemma === 'be') continue
      if (token.pos === 'VERB' || token.pos === 'AUX') verbs++
      if (token.pos === 'ADJ') adjectives++
    }

    return {
      index: paragraph.index,
      sentenceCount: paragraph.sentences.length,
      counts,
      openers: openerCounts,
      openerVariety: Object.values(openerCounts).filter((n) => n > 0).length,
      bannedWords: own
        .filter((f) => f.ruleId === 'bannedWord')
        .map((f) => ({ word: doc.text.slice(f.start, f.end), detail: f.detail ?? 'banned' })),
      clincher: analyzeClincher(doc, paragraph.sentences),
      repeated: findRepeated(doc, paragraph.index),
      candidates: { verbs, adjectives },
    }
  })

  const totals = emptyCounts()
  for (const finding of findings) totals[finding.ruleId] = (totals[finding.ruleId] ?? 0) + 1

  const openerTotals = EMPTY_OPENERS()
  for (const opener of openers) openerTotals[opener.type]++

  return {
    paragraphs,
    totals,
    openerTotals,
    wordCount: doc.tokens.filter((t) => t.isWord).length,
    sentenceCount: doc.sentences.length,
  }
}
