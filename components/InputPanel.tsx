'use client'

import { useRef, useState } from 'react'
import { type ExtractProgress, extractFile } from '@/lib/extract'

/**
 * Progress copy. OCR takes tens of seconds, so "please wait" isn't enough --
 * the reader needs to see which page it's on and that it is still moving.
 */
function describeProgress({ phase, page, pageCount, progress }: ExtractProgress): string {
  const where = pageCount > 1 ? `page ${page} of ${pageCount}` : 'the page'

  switch (phase) {
    case 'starting':
      return 'Starting the text reader…'
    case 'model':
      return 'Loading the English model (one time, about 3 MB)…'
    case 'rendering':
      return `Rendering ${where}…`
    case 'reading':
      return progress === undefined
        ? `Reading ${where}…`
        : `Reading ${where} — ${Math.round(progress * 100)}%`
  }
}

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
  /** The file is kept so "read the image" can re-run without re-picking it. */
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<ExtractProgress | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cancellation = useRef<AbortController | null>(null)

  async function loadFile(file: File, ocr = false) {
    cancellation.current?.abort()
    const controller = new AbortController()
    cancellation.current = controller

    setBusy(true)
    setError(null)
    setWarning(null)
    setProgress(null)
    setScannedFile(null)

    try {
      const result = await extractFile(file, {
        ocr,
        signal: controller.signal,
        onProgress: setProgress,
      })

      onTextChange(result.text)
      setWarning(result.warning ?? null)

      if (result.ocrAvailable) {
        setScannedFile(file)
      } else if (!result.text.trim()) {
        setError(
          'Nothing readable in that file. If it is a photo, a straighter and brighter one with ' +
            'the page filling the frame usually does it — or type the paper in below.',
        )
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') setScannedFile(file)
      else setError(cause instanceof Error ? cause.message : 'Could not read that file.')
    } finally {
      setBusy(false)
      setProgress(null)
      if (cancellation.current === controller) cancellation.current = null
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
          Drop a <strong>.docx</strong>, <strong>.pdf</strong>, <strong>.txt</strong> — or a{' '}
          <strong>photo</strong> of the page — here, or{' '}
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
          accept=".docx,.pdf,.txt,.md,.jpg,.jpeg,.png,.bmp,.webp"
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

      {busy && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <div className="flex items-center justify-between gap-3">
            <span>{progress ? describeProgress(progress) : 'Reading file…'}</span>
            {progress && (
              <button
                type="button"
                onClick={() => cancellation.current?.abort()}
                className="shrink-0 text-blue-600 underline underline-offset-2"
              >
                Cancel
              </button>
            )}
          </div>
          {progress?.phase === 'reading' && progress.progress !== undefined && (
            <progress value={progress.progress} max={1} className="mt-2 w-full" />
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/*
       * The dead end this replaces used to say "type or paste the paper
       * instead". OCR is opt-in rather than automatic because it downloads
       * several megabytes and runs for tens of seconds -- not something to
       * start because someone dropped the wrong file.
       */}
      {scannedFile && !busy && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">No text in that file — it looks like a scan or photo.</p>
          <p className="mt-1">
            The page holds a picture of the words rather than the words themselves. This browser
            can read them: about a minute for a two-page paper, and it downloads a
            text-recognition model from this site the first time. Like everything else here, the
            paper is never sent anywhere.
          </p>
          <button
            type="button"
            onClick={() => void loadFile(scannedFile, true)}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Read the text from the image
          </button>
        </div>
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
