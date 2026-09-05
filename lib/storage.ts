/**
 * localStorage helpers for the grader's saved selections.
 *
 * Both selections the app persists -- which rules are checked, which banned
 * words count -- are string sets, so they share one pair of functions. Every
 * access is guarded: storage can be absent (this module is imported by a page
 * prerendered at build time), disabled, or full, and none of that should stop a
 * teacher from grading a paper.
 */

/**
 * Read a saved set, falling back to `fallback` when there's nothing usable.
 *
 * `allowed`, when given, intersects the saved value with the options that still
 * exist -- a word dropped from lib/data/bannedWords.ts shouldn't linger in a
 * returning user's set and quietly count toward the "n of m" total.
 */
export function loadStringSet<T extends string>(
  key: string,
  fallback: readonly T[],
  allowed?: readonly T[],
): Set<T> {
  if (typeof window === 'undefined') return new Set(fallback)

  try {
    const saved = window.localStorage.getItem(key)
    if (!saved) return new Set(fallback)

    const parsed = JSON.parse(saved) as T[]
    if (!Array.isArray(parsed)) return new Set(fallback)
    if (!allowed) return new Set(parsed)

    const valid = new Set<string>(allowed)
    return new Set(parsed.filter((item) => valid.has(item)))
  } catch {
    // Blocked, unavailable or corrupt storage just means defaults.
    return new Set(fallback)
  }
}

export function saveStringSet(key: string, value: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...value]))
  } catch {
    // Not persisting is survivable; grading still works.
  }
}
