'use client'

import { useRef, useState } from 'react'
import { extractFile } from '@/lib/extract'

export function InputPanel({
  text,
  onTextChange,
  onGrade,
}: {
  text: string
  onTextChange: (text: string) => void
  onGrade: () => void
}) {
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function loadFile(file: File) {
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const result = await extractFile(file)
      onTextChange(result.text)
      setWarning(result.warning ?? null)
      if (!result.text.trim()) {
        setError(
          'No text found. If this is a scan or photo, the page holds images rather than text — type or paste the paper instead.',
        )
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const paragraphCount = text.trim() ? text.trim().split(/\n+/).length : 0

  return (
    <section className="no-print space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void loadFile(file)
        }}
        className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <p className="text-gray-600">
          Drop a <strong>.docx</strong>, <strong>.pdf</strong> or <strong>.txt</strong> here, or{' '}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="font-medium text-blue-600 underline underline-offset-2"
          >
            choose a file
          </button>
          . Paste below to grade typed text.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".docx,.pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void loadFile(file)
            e.target.value = ''
          }}
        />
        <p className="mt-1 text-xs text-gray-500">
          Files are read in your browser and never uploaded.
        </p>
      </div>

      {busy && <p className="text-sm text-gray-600">Reading file…</p>}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {warning && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {warning}
        </p>
      )}

      <div>
        <label htmlFor="paper" className="mb-1 block text-sm font-medium text-gray-700">
          Paper text
        </label>
        <textarea
          id="paper"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder="Paste the student's paper here, one paragraph per line…"
          className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Each new line starts a new paragraph. Currently {paragraphCount} paragraph
          {paragraphCount === 1 ? '' : 's'} — fix any wrong breaks before grading, since the
          checklist is scored per paragraph.
        </p>
      </div>

      <button
        type="button"
        onClick={onGrade}
        disabled={!text.trim()}
        className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Grade paper
      </button>
    </section>
  )
}
