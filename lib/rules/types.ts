import type { TokenizedDoc } from '../nlp/tokenize'

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

export type Rule = {
  id: RuleId
  label: string
  channel: Channel
  /** Shown in the legend so a teacher knows what the color means. */
  description: string
  run: (doc: TokenizedDoc) => Finding[]
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
