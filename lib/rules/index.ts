import type { TokenizedDoc } from '../nlp/tokenize'
import { bannedWords, lyAdverbs, whoWhichClauses, wwwAsiaBClauses } from './dressUps'
import { alliteration, questions, quotations, similes, triples } from './decorations'
import type { Finding, Rule, RuleId } from './types'

/**
 * The rule registry. Each rule is a pure function of the tokenized document, so
 * they're independently testable and the UI can toggle any subset -- IEW adds
 * dress-ups progressively by unit, so a teacher grading Unit 4 wants a different
 * checklist than one grading Unit 8.
 */
export const RULES: Rule[] = [
  {
    id: 'lyAdverb',
    label: '-ly Adverb',
    channel: 'dressup',
    description: 'A descriptive adverb ending in -ly.',
    run: lyAdverbs,
  },
  {
    id: 'whoWhich',
    label: 'who/which Clause',
    channel: 'dressup',
    description: 'A relative clause modifying a noun.',
    run: whoWhichClauses,
  },
  {
    id: 'wwwAsiaB',
    label: 'www.asia.b Clause',
    channel: 'dressup',
    description: 'when, while, where, as, since, if, although, because.',
    run: wwwAsiaBClauses,
  },
  {
    id: 'bannedWord',
    label: 'Banned Word',
    channel: 'banned',
    description: 'A weak verb, adjective, noun or intensifier to replace.',
    run: bannedWords,
  },
  {
    id: 'question',
    label: 'Question',
    channel: 'decoration',
    description: 'A sentence ending in a question mark.',
    run: questions,
  },
  {
    id: 'simile',
    label: 'Simile',
    channel: 'decoration',
    description: 'A comparison using "like" or "as ... as".',
    run: similes,
  },
  {
    id: 'alliteration',
    label: 'Alliteration',
    channel: 'decoration',
    description: 'Nearby content words sharing a first letter.',
    run: alliteration,
  },
  {
    id: 'triple',
    label: 'Triple Extension',
    channel: 'decoration',
    description: 'A series of three (3sss).',
    run: triples,
  },
  {
    id: 'quotation',
    label: 'Conversation',
    channel: 'decoration',
    description: 'Quoted speech.',
    run: quotations,
  },
]

export const DEFAULT_ENABLED: RuleId[] = RULES.map((r) => r.id)

export function runRules(doc: TokenizedDoc, enabled: RuleId[] = DEFAULT_ENABLED): Finding[] {
  const active = new Set(enabled)
  return RULES.filter((rule) => active.has(rule.id))
    .flatMap((rule) => rule.run(doc))
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

export * from './types'
export { classifyOpeners } from './openers'
