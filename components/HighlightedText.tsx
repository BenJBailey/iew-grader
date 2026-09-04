import type { RenderedParagraph } from '@/lib/render/highlight'
import { OPENER_LABELS } from '@/lib/data/openers'

/**
 * Renders the segmented model as elements. Student text is passed as React
 * children, never as HTML, so nothing in a submitted paper can inject markup.
 */
export function HighlightedText({
  paragraphs,
  showOpeners,
}: {
  paragraphs: RenderedParagraph[]
  showOpeners: boolean
}) {
  return (
    <div className="space-y-4 text-[15px] leading-[2.1] text-gray-900">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.index} className="print-block">
          {paragraph.parts.map((part, partIndex) => {
            if (part.kind === 'gap') return <span key={partIndex}>{part.text}</span>

            const { sentence } = part
            return (
              <span key={partIndex}>
                {showOpeners && (
                  <span
                    className="opener-badge no-print-hide"
                    title={OPENER_LABELS[sentence.opener]}
                  >
                    {sentence.opener}
                  </span>
                )}
                {sentence.segments.map((segment, i) => (
                  <span
                    key={i}
                    className={
                      segment.ruleIds.length
                        ? `seg ${segment.ruleIds.map((id) => `r-${id}`).join(' ')}`
                        : undefined
                    }
                  >
                    {segment.text}
                  </span>
                ))}
                {sentence.badges.map((badge) => (
                  <span
                    key={badge.ruleId}
                    className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-purple-800"
                  >
                    {badge.label}
                  </span>
                ))}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}
