/**
 * Words ending in "-ly" that must NOT count as an IEW -ly adverb dress-up.
 *
 * Two separate reasons, kept as two lists because they fail differently:
 *
 *  1. NOT_ADVERBS  - the word simply isn't an adverb (family, ugly, reply).
 *     The POS tagger catches most of these on its own; this list is the safety
 *     net for when it mis-tags, which it does on unusual words and proper nouns.
 *
 *  2. WEAK_ADVERBS - genuinely adverbs, but empty ones. IEW wants a *descriptive*
 *     -ly adverb; "only" and "really" add nothing and earn no credit.
 */

/** -ly words that are nouns or adjectives, never adverbs. */
export const LY_NOT_ADVERBS = new Set([
  // nouns
  'family', 'ally', 'bully', 'belly', 'jelly', 'folly', 'holly', 'rally', 'tally',
  'valley', 'gully', 'lily', 'fly', 'ply', 'supply', 'reply', 'apply', 'butterfly',
  'dragonfly', 'assembly', 'monopoly', 'anomaly', 'melancholy', 'italy', 'july',
  // adjectives
  'ugly', 'holy', 'silly', 'lonely', 'lovely', 'friendly', 'likely', 'lively',
  'deadly', 'curly', 'hilly', 'jolly', 'oily', 'surly', 'manly', 'womanly',
  'homely', 'costly', 'elderly', 'orderly', 'ghastly', 'ghostly', 'gnarly',
  'burly', 'chilly', 'prickly', 'wobbly', 'crumbly', 'bubbly', 'cuddly',
  'wrinkly', 'sparkly', 'giggly', 'grisly', 'leisurely', 'lowly', 'miserly',
  'motherly', 'fatherly', 'brotherly', 'sisterly', 'neighborly', 'princely',
  'saintly', 'scholarly', 'sickly', 'smelly', 'stately', 'ungainly', 'unruly',
  'unsightly', 'worldly', 'portly', 'courtly', 'comely', 'seemly', 'unseemly',
  'shapely', 'steely', 'wily', 'burly',
])

/**
 * Real adverbs that don't earn the dress-up: filler and frequency words.
 * "early", "daily", "weekly" etc. are time words, not descriptive manner adverbs.
 */
export const LY_WEAK_ADVERBS = new Set([
  'only', 'really', 'actually', 'basically', 'literally', 'simply', 'usually',
  'probably', 'generally', 'especially', 'finally', 'totally', 'merely',
  'hardly', 'barely', 'nearly', 'mostly', 'partly', 'lately', 'early',
  'surely', 'truly', 'certainly', 'definitely', 'possibly', 'apparently',
  'daily', 'weekly', 'monthly', 'yearly', 'hourly', 'nightly',
])

/** Convenience union used by the -ly rule. */
export const LY_EXCEPTIONS = new Set([...LY_NOT_ADVERBS, ...LY_WEAK_ADVERBS])
