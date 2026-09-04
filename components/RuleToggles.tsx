'use client'

import { RULES } from '@/lib/rules'
import type { RuleId } from '@/lib/rules/types'

/**
 * IEW introduces dress-ups and decorations progressively by unit, so a teacher
 * grading Unit 4 needs a shorter checklist than one grading Unit 8. Selections
 * persist in localStorage (see app/page.tsx).
 */
export function RuleToggles({
  enabled,
  onToggle,
}: {
  enabled: Set<RuleId>
  onToggle: (id: RuleId) => void
}) {
  return (
    <details className="no-print rounded-lg border border-gray-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-700">
        Rules checked ({enabled.size} of {RULES.length})
      </summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {RULES.map((rule) => (
          <li key={rule.id}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled.has(rule.id)}
                onChange={() => onToggle(rule.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-gray-800">{rule.label}</span>
                <span className="block text-xs text-gray-500">{rule.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  )
}
