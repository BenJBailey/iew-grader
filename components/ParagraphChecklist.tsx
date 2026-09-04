import type { DocumentReport, ParagraphReport } from '@/lib/render/report'
import type { RuleId } from '@/lib/rules/types'

/** IEW asks for at least one of each dress-up in every paragraph. */
function DressUpCell({ count }: { count: number }) {
  if (count > 0) {
    return (
      <td className="px-3 py-2 text-center">
        <span className="font-semibold text-emerald-700">✓</span>
        {count > 1 && <span className="ml-1 text-xs text-gray-500">×{count}</span>}
      </td>
    )
  }
  return (
    <td className="px-3 py-2 text-center">
      <span className="text-red-600">—</span>
    </td>
  )
}

function OpenerCell({ paragraph }: { paragraph: ParagraphReport }) {
  const used = ([1, 2, 3, 4, 5, 6] as const).filter((type) => paragraph.openers[type] > 0)

  return (
    <td className="px-3 py-2">
      <div className="flex flex-wrap gap-1">
        {used.map((type) => (
          <span
            key={type}
            className="rounded bg-gray-200 px-1.5 text-xs font-semibold text-gray-700"
            title={`${paragraph.openers[type]} sentence(s)`}
          >
            #{type}
            {paragraph.openers[type] > 1 && (
              <span className="font-normal">×{paragraph.openers[type]}</span>
            )}
          </span>
        ))}
      </div>
    </td>
  )
}

const DRESS_UPS: Array<{ id: RuleId; label: string }> = [
  { id: 'lyAdverb', label: '-ly' },
  { id: 'whoWhich', label: 'who/which' },
  { id: 'wwwAsiaB', label: 'www.asia.b' },
]

export function ParagraphChecklist({ report }: { report: DocumentReport }) {
  return (
    <div className="print-block space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">¶</th>
              {DRESS_UPS.map((dressUp) => (
                <th key={dressUp.id} className="px-3 py-2 text-center font-semibold">
                  {dressUp.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-semibold">Openers used</th>
              <th className="px-3 py-2 text-left font-semibold">Banned words</th>
              <th className="px-3 py-2 text-left font-semibold">Clincher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.paragraphs.map((paragraph) => (
              <tr key={paragraph.index} className="align-top">
                <td className="px-3 py-2 font-semibold text-gray-700">{paragraph.index + 1}</td>
                {DRESS_UPS.map((dressUp) => (
                  <DressUpCell key={dressUp.id} count={paragraph.counts[dressUp.id] ?? 0} />
                ))}
                <OpenerCell paragraph={paragraph} />
                <td className="px-3 py-2">
                  {paragraph.bannedWords.length === 0 ? (
                    <span className="text-emerald-700">none</span>
                  ) : (
                    <span className="text-red-700">
                      {paragraph.bannedWords.map((b) => b.word).join(', ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {paragraph.clincher === null ? (
                    <span className="text-gray-400">—</span>
                  ) : paragraph.clincher.ok ? (
                    <span className="text-emerald-700">
                      ✓ {paragraph.clincher.matched.slice(0, 3).join(', ')}
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      {paragraph.clincher.matched.length === 0
                        ? 'no repeated key words'
                        : `only "${paragraph.clincher.matched.join(', ')}"`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RepetitionNotes report={report} />
      <CandidateNote report={report} />
    </div>
  )
}

function RepetitionNotes({ report }: { report: DocumentReport }) {
  const withRepeats = report.paragraphs.filter((p) => p.repeated.length > 0)
  if (withRepeats.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <h3 className="font-semibold text-amber-900">Repeated words</h3>
      <ul className="mt-1 space-y-0.5 text-amber-800">
        {withRepeats.map((paragraph) => (
          <li key={paragraph.index}>
            ¶{paragraph.index + 1}:{' '}
            {paragraph.repeated.map((r) => `${r.word} (${r.count}×)`).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The honest disclaimer. "Strong verb" and "quality adjective" are quality
 * judgments that no rule can make, so the report says what it actually knows --
 * how many verbs and adjectives avoided the banned list -- and leaves the
 * judgment to the teacher rather than dressing a guess up as a finding.
 */
function CandidateNote({ report }: { report: DocumentReport }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
      <h3 className="font-semibold text-gray-900">Strong verbs &amp; quality adjectives</h3>
      <p className="mt-1 text-gray-600">
        These can’t be checked by rule — whether a verb is <em>strong</em> or an adjective has{' '}
        <em>quality</em> is a judgment call. What’s counted below is every verb and adjective
        that isn’t on the banned list, as candidates for you to judge.
      </p>
      <ul className="mt-2 space-y-0.5">
        {report.paragraphs.map((paragraph) => (
          <li key={paragraph.index}>
            ¶{paragraph.index + 1}: {paragraph.candidates.verbs} verb
            {paragraph.candidates.verbs === 1 ? '' : 's'}, {paragraph.candidates.adjectives}{' '}
            adjective{paragraph.candidates.adjectives === 1 ? '' : 's'}
          </li>
        ))}
      </ul>
    </div>
  )
}
