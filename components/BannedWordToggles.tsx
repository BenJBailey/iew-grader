'use client'

import { ALL_BANNED_LEMMAS, BANNED_ADJECTIVES, BANNED_VERBS } from '@/lib/data/bannedWords'

const GROUPS: Array<{ label: string; words: readonly string[] }> = [
  { label: 'Verbs', words: BANNED_VERBS },
  { label: 'Adjectives', words: BANNED_ADJECTIVES },
]

/**
 * Which banned words count for the paper being graded.
 *
 * The word lists are a ceiling, not a fixed rubric: a teacher grading an early
 * unit may not have taught every replacement yet, and flagging a word the
 * student was never asked to avoid is just noise. Unticking a word here stops it
 * being flagged without touching lib/data/bannedWords.ts. Selections persist in
 * localStorage (see app/page.tsx).
 */
export function BannedWordToggles({
  enabled,
  onToggle,
  onSetGroup,
}: {
  enabled: Set<string>
  onToggle: (word: string) => void
  onSetGroup: (words: readonly string[], on: boolean) => void
}) {
  return (
    <details className="no-print rounded-lg border border-gray-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-700">
        Banned words checked ({enabled.size} of {ALL_BANNED_LEMMAS.length})
      </summary>

      <div className="mt-3 space-y-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {group.label}
              </h3>
              <button
                type="button"
                onClick={() => onSetGroup(group.words, true)}
                className="text-xs text-blue-600 underline underline-offset-2"
              >
                all
              </button>
              <button
                type="button"
                onClick={() => onSetGroup(group.words, false)}
                className="text-xs text-blue-600 underline underline-offset-2"
              >
                none
              </button>
            </div>

            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {group.words.map((word) => (
                <li key={word}>
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={enabled.has(word)}
                      onChange={() => onToggle(word)}
                    />
                    {word}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Matched on the base form, so unticking <em>go</em> also clears{' '}
        <em>went</em> and <em>going</em>.
      </p>
    </details>
  )
}
