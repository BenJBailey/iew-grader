/**
 * Word lists for classifying IEW sentence openers and www.asia.b clauses.
 */

/**
 * www.asia.b subordinating conjunctions.
 *   W-W-W = when, while, where
 *   A-S-I-A = as, since, if, although
 *   B = because
 * Used both as a dress-up (anywhere in a sentence) and as the #5 clausal opener.
 */
export const WWW_ASIA_B = new Set([
  'when',
  'while',
  'where',
  'as',
  'since',
  'if',
  'although',
  'because',
])

/** Prepositions for the #2 prepositional opener. */
export const PREPOSITIONS = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'at', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between',
  'beyond', 'by', 'down', 'during', 'except', 'for', 'from', 'in', 'inside',
  'into', 'near', 'of', 'off', 'on', 'onto', 'outside', 'over', 'past',
  'through', 'throughout', 'to', 'toward', 'towards', 'under', 'underneath',
  'until', 'up', 'upon', 'with', 'within', 'without',
])

/** Maximum word count for a #6 very short sentence. IEW teaches 2-5 words. */
export const VSS_MAX_WORDS = 5
export const VSS_MIN_WORDS = 2

export const OPENER_LABELS: Record<number, string> = {
  1: '#1 Subject',
  2: '#2 Prepositional',
  3: '#3 -ly Adverb',
  4: '#4 -ing',
  5: '#5 Clausal (www.asia.b)',
  6: '#6 Very Short Sentence',
}
