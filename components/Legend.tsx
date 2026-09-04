import { RULES } from '@/lib/rules'
import type { RuleId } from '@/lib/rules/types'

/**
 * Rules that mark a whole sentence show up in the report as a badge rather than
 * an inline style, so the legend has to draw them the same way -- rendering them
 * as plain text made three entries look identical and blank.
 */
const BADGE_RULES = new Set<RuleId>(['question', 'triple', 'quotation'])

function Swatch({ ruleId, label }: { ruleId: RuleId; label: string }) {
  if (BADGE_RULES.has(ruleId)) {
    return (
      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-purple-800">
        {label.toLowerCase()}
      </span>
    )
  }

  return (
    <span className={`seg r-${ruleId} px-2 py-0.5 text-sm`}>
      {ruleId === 'bannedWord' ? 'big' : 'sample'}
    </span>
  )
}

export function Legend({ enabled }: { enabled: Set<RuleId> }) {
  const shown = RULES.filter((rule) => enabled.has(rule.id))

  return (
    <div className="print-block rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Legend</h2>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((rule) => (
          <li key={rule.id} className="flex items-baseline gap-2 text-sm">
            <Swatch ruleId={rule.id} label={rule.label} />
            <span className="text-gray-700">{rule.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        Sentence openers appear as a numbered badge at the start of each sentence.
      </p>
    </div>
  )
}
