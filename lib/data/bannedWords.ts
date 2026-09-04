/**
 * IEW banned ("forbidden") words.
 *
 * These lists are intentionally plain arrays so a teacher can edit them without
 * touching rule logic. Everything here is matched on the token LEMMA, so listing
 * the base form covers its inflections: `go` catches went/gone/goes/going.
 */

/**
 * Weak verbs IEW asks students to replace with a strong verb.
 *
 * `be` is deliberately absent: is/are/was/were are helping verbs, grammar rather
 * than a weak verb CHOICE, so flagging them asks the student to rewrite something
 * that isn't theirs to fix. Don't add it back.
 */
export const BANNED_VERBS = [
  'go',
  'get',
  'say',
  'see',
  'look',
  'walk',
  'run',
  'eat',
  'put',
  'take',
  'come',
  'make',
  'do',
  'have',
  'give',
  'want',
  'like',
  'think',
  'know',
] as const

/** Weak adjectives IEW asks students to replace with a quality adjective. */
export const BANNED_ADJECTIVES = [
  'good',
  'bad',
  'big',
  'small',
  'little',
  'pretty',
  'ugly',
  'nice',
  'great',
  'happy',
  'sad',
  'mad',
  'fun',
  'funny',
  'cute',
  'cool',
  'awesome',
  'amazing',
  'interesting',
  'neat',
] as const

/** Vague nouns. */
export const BANNED_NOUNS = ['thing', 'stuff', 'guy', 'kid', 'lot'] as const

/** Empty intensifiers and filler adverbs. */
export const BANNED_ADVERBS = ['very', 'really', 'so', 'quite', 'just', 'totally'] as const

/**
 * Multi-word banned phrases, matched case-insensitively on whole words.
 * Handled separately from the lemma lists because they span several tokens.
 */
export const BANNED_PHRASES = ['a lot', 'a lot of', 'kind of', 'sort of'] as const

export type BannedCategory = 'verb' | 'adjective' | 'noun' | 'adverb' | 'phrase'

/** Lemma -> category, built once for O(1) lookup by the rules. */
export const BANNED_LEMMAS: ReadonlyMap<string, BannedCategory> = new Map([
  ...BANNED_VERBS.map((w) => [w, 'verb'] as const),
  ...BANNED_ADJECTIVES.map((w) => [w, 'adjective'] as const),
  ...BANNED_NOUNS.map((w) => [w, 'noun'] as const),
  ...BANNED_ADVERBS.map((w) => [w, 'adverb'] as const),
])
