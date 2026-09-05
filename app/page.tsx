'use client'

import { useMemo, useState } from 'react'
import { BannedWordToggles } from '@/components/BannedWordToggles'
import { HighlightedText } from '@/components/HighlightedText'
import { InputPanel } from '@/components/InputPanel'
import { Legend } from '@/components/Legend'
import { ParagraphChecklist } from '@/components/ParagraphChecklist'
import { RuleToggles } from '@/components/RuleToggles'
import { ALL_BANNED_LEMMAS } from '@/lib/data/bannedWords'
import { normalizeText, tokenize } from '@/lib/nlp/tokenize'
import { DEFAULT_ENABLED, classifyOpeners, runRules } from '@/lib/rules'
import type { RuleId } from '@/lib/rules/types'
import { renderDocument } from '@/lib/render/highlight'
import { buildReport } from '@/lib/render/report'
import { loadStringSet, saveStringSet } from '@/lib/storage'

const RULES_KEY = 'iew-grader:enabled-rules'
const BANNED_WORDS_KEY = 'iew-grader:enabled-banned-words'

const SAMPLE = [
  'The determined boy who lived beside the mill ran swiftly toward the river. Because he was late, he quickly climbed the very big fence. He stumbled.',
  'Slowly the frightened dog crept toward the silent stranger. It growled like a distant storm while the stranger waited. That stranger, who never moved, watched the frightened dog.',
].join('\n')

/**
 * Restore the saved selections.
 *
 * Safe to read during the initial render even though the page is prerendered at
 * build time: nothing shown before the user clicks "Grade paper" depends on
 * these values, so the prerendered HTML and the first client render agree
 * regardless of what's in storage, and there's no hydration mismatch to work
 * around.
 */
const loadEnabledRules = () => loadStringSet<RuleId>(RULES_KEY, DEFAULT_ENABLED, DEFAULT_ENABLED)

const loadEnabledBannedWords = () =>
  loadStringSet(BANNED_WORDS_KEY, ALL_BANNED_LEMMAS, ALL_BANNED_LEMMAS)

export default function Page() {
  const [text, setText] = useState('')
  const [graded, setGraded] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<Set<RuleId>>(loadEnabledRules)
  const [bannedLemmas, setBannedLemmas] = useState<Set<string>>(loadEnabledBannedWords)

  function toggleRule(id: RuleId) {
    setEnabled((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveStringSet(RULES_KEY, next)
      return next
    })
  }

  function toggleBannedWord(word: string) {
    setBannedLemmas((previous) => {
      const next = new Set(previous)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      saveStringSet(BANNED_WORDS_KEY, next)
      return next
    })
  }

  /** The "all"/"none" shortcut on a group -- 12 checkboxes is tedious by hand. */
  function setBannedGroup(words: readonly string[], on: boolean) {
    setBannedLemmas((previous) => {
      const next = new Set(previous)
      for (const word of words) {
        if (on) next.add(word)
        else next.delete(word)
      }
      saveStringSet(BANNED_WORDS_KEY, next)
      return next
    })
  }

  const analysis = useMemo(() => {
    if (!graded?.trim()) return null

    const normalized = normalizeText(graded)
    const doc = tokenize(normalized)
    const findings = runRules(doc, [...enabled], { bannedLemmas })
    const openers = classifyOpeners(doc)

    return {
      paragraphs: renderDocument(doc, findings, openers),
      report: buildReport(doc, findings, openers),
    }
  }, [graded, enabled, bannedLemmas])

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
          {enabled.has('bannedWord') && (
            <BannedWordToggles
              enabled={bannedLemmas}
              onToggle={toggleBannedWord}
              onSetGroup={setBannedGroup}
            />
          )}
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
