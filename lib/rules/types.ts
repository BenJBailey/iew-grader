import type { TokenizedDoc } from '../nlp/tokenize'
import { ALL_BANNED_LEMMAS } from '../data/bannedWords'

export type RuleId =
  | 'lyAdverb'
  | 'whoWhich'
  | 'wwwAsiaB'
  | 'bannedWord'
  | 'question'
  | 'simile'
  | 'alliteration'
  | 'triple'
  | 'quotation'

/**
 * The visual axis a finding is drawn on. Backgrounds can't stack, so each
 * channel gets its own CSS property -- that's what lets a single word show a
 * dress-up background AND a banned-word underline at the same time.
 */
export type Channel = 'dressup' | 'banned' | 'decoration'

export type Finding = {
  ruleId: RuleId
  channel: Channel
  /** Character offsets into TokenizedDoc.text. */
  start: number
  end: number
  paragraph: number
  sentence: number
  label: string
  /** Optional extra shown on hover, e.g. which banned word category. */
  detail?: string
}

/**
 * Per-grading settings a rule may consult, threaded through runRules so nothing
 * has to mutate module state. Only bannedWords reads this today; rules that
 * ignore it keep their one-parameter signature, which still satisfies Rule.run.
 */
export type RuleOptions = {
  /**
   * Which banned lemmas count for the paper being graded. IEW introduces
   * material by unit, so a teacher can narrow the list without editing source.
   */
  bannedLemmas: ReadonlySet<string>
}

/**
 * Every banned word active -- what grading does unless the teacher narrows it.
 * Lives here rather than in the rule registry so dressUps.ts can default to it
 * without importing index.ts, which imports dressUps.ts back.
 */
export const DEFAULT_RULE_OPTIONS: RuleOptions = {
  bannedLemmas: new Set(ALL_BANNED_LEMMAS),
}

export type Rule = {
  id: RuleId
  label: string
  channel: Channel
  /** Shown in the legend so a teacher knows what the color means. */
  description: string
  run: (doc: TokenizedDoc, options: RuleOptions) => Finding[]
}

/** IEW's six sentence openers. */
export type OpenerType = 1 | 2 | 3 | 4 | 5 | 6

export type SentenceOpener = {
  sentence: number
  paragraph: number
  type: OpenerType
  /** Offsets of the opening word, for the badge. */
  start: number
  end: number
}
