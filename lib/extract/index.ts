import { normalizeText } from '../nlp/tokenize'
import { extractPdf } from './pdf'

export type ExtractResult = {
  text: string
  /** Shown in the review step so the teacher knows how much to trust the breaks. */
  warning?: string
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  // mammoth's package `browser` field swaps in browser-safe unzip internals, so
  // the default entry point works client-side under a bundler.
  const mammoth = (await import('mammoth')).default
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return normalizeText(result.value)
}

export async function extractFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (name.endsWith('.docx')) {
    return { text: await extractDocx(buffer) }
  }

  if (name.endsWith('.pdf')) {
    const text = await extractPdf(buffer)
    return {
      text,
      warning:
        'PDFs store positioned text, not paragraphs, so the breaks below are a best guess. ' +
        'Check them before grading — paragraph breaks drive the per-paragraph checklist.',
    }
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return { text: normalizeText(await file.text()) }
  }

  if (name.endsWith('.doc')) {
    throw new Error(
      'Legacy .doc files aren’t supported. Open it in Word and save as .docx, or paste the text.',
    )
  }

  throw new Error(`Unsupported file type: ${file.name}. Use .docx, .pdf, or .txt.`)
}
