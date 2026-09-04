'use client'

import { useMemo, useState } from 'react'
import { HighlightedText } from '@/components/HighlightedText'
import { InputPanel } from '@/components/InputPanel'
import { Legend } from '@/components/Legend'
import { ParagraphChecklist } from '@/components/ParagraphChecklist'
import { RuleToggles } from '@/components/RuleToggles'
import { normalizeText, tokenize } from '@/lib/nlp/tokenize'
import { DEFAULT_ENABLED, classifyOpeners, runRules } from '@/lib/rules'
import type { RuleId } from '@/lib/rules/types'
import { renderDocument } from '@/lib/render/highlight'
import { buildReport } from '@/lib/render/report'

const STORAGE_KEY = 'iew-grader:enabled-rules'

const SAMPLE = [
  'The determined boy who lived beside the mill ran swiftly toward the river. Because he was late, he quickly climbed the very big fence. He stumbled.',
  'Slowly the frightened dog crept toward the silent stranger. It growled like a distant storm while the stranger waited. That stranger, who never moved, watched the frightened dog.',
].join('\n')

/**
 * Restore the saved rule selection.
 *
 * Safe to read during the initial render even though the page is prerendered at
 * build time: nothing shown before the user clicks "Grade paper" depends on this
 * value, so the prerendered HTML and the first client render agree regardless of
 * what's in storage, and there's no hydration mismatch to work around.
 */
function loadEnabledRules(): Set<RuleId> {
  if (typeof window === 'undefined') return new Set(DEFAULT_ENABLED)
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? new Set(JSON.parse(saved) as RuleId[]) : new Set(DEFAULT_ENABLED)
  } catch {
    // A blocked or unavailable localStorage just means defaults.
    return new Set(DEFAULT_ENABLED)
  }
}

export default function Page() {
  const [text, setText] = useState('')
  const [graded, setGraded] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<Set<RuleId>>(loadEnabledRules)

  function toggleRule(id: RuleId) {
    setEnabled((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Not persisting is survivable; grading still works.
      }
      return next
    })
  }

  const analysis = useMemo(() => {
    if (!graded?.trim()) return null

    const normalized = normalizeText(graded)
    const doc = tokenize(normalized)
    const findings = runRules(doc, [...enabled])
    const openers = classifyOpeners(doc)

    return {
      paragraphs: renderDocument(doc, findings, openers),
      report: buildReport(doc, findings, openers),
    }
  }, [graded, enabled])

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">IEW Grader</h1>
        <p className="mt-1 text-sm text-gray-600">
          Highlights dress-ups, sentence openers, decorations and banned words. Everything runs
          in your browser — no account, no upload, no internet needed.
        </p>
      </header>

      {!analysis && (
        <div className="space-y-4">
          <InputPanel text={text} onTextChange={setText} onGrade={() => setGraded(text)} />
          <button
            type="button"
            onClick={() => {
              setText(SAMPLE)
              setGraded(SAMPLE)
            }}
            className="no-print text-sm text-blue-600 underline underline-offset-2"
          >
            Try it with a sample paragraph
          </button>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="no-print flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setGraded(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Edit text
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Print / Save as PDF
            </button>
          </div>

          <RuleToggles enabled={enabled} onToggle={toggleRule} />
          <Legend enabled={enabled} />

          <section className="print-block rounded-lg border border-gray-200 p-5">
            <HighlightedText paragraphs={analysis.paragraphs} showOpeners />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Paragraph checklist</h2>
            <ParagraphChecklist report={analysis.report} />
          </section>

          <p className="text-xs text-gray-500">
            {analysis.report.wordCount} words · {analysis.report.sentenceCount} sentences ·{' '}
            {analysis.report.paragraphs.length} paragraphs
          </p>
        </div>
      )}
    </main>
  )
}
