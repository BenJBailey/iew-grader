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
  'say',
  'see',
  'eat',
  'come',
  'make',
  'want',
  'think',
] as const

/** Weak adjectives IEW asks students to replace with a quality adjective. */
export const BANNED_ADJECTIVES = [
  'good',
  'bad',
  'nice',
  'small',
] as const

export type BannedCategory = 'verb' | 'adjective'

/** Lemma -> category, built once for O(1) lookup by the rules. */
export const BANNED_LEMMAS: ReadonlyMap<string, BannedCategory> = new Map([
  ...BANNED_VERBS.map((w) => [w, 'verb'] as const),
  ...BANNED_ADJECTIVES.map((w) => [w, 'adjective'] as const),
])

/**
 * Every banned lemma, in list order. This is the full vocabulary the banned-word
 * rule knows about; a teacher grading one paper can narrow it (see RuleOptions),
 * so treat this as the ceiling rather than the active set.
 */
export const ALL_BANNED_LEMMAS: readonly string[] = [...BANNED_LEMMAS.keys()]
