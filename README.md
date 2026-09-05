# IEW Grader

Highlights Institute for Excellence in Writing (IEW) dress-ups, sentence openers, decorations
and banned words in a student paper, and prints a color-coded report with a per-paragraph
checklist.

Paste the text, or drop in a `.docx`, `.pdf`, `.txt` — or a photo of the page.

## Everything runs in the browser

There is no server, no account, no API key and no network call. The rule engine is
deterministic — a part-of-speech tagger plus word lists — so:

- **Student work never leaves the machine.** Files are read locally; nothing is uploaded.
- **It works with no internet at all**, which is the normal case for a LAN-only Raspberry Pi.
- **The Pi does no work.** It serves static files; grading happens in the reader's browser,
  so paper length costs the Pi nothing.
- **Reading a photo runs here too.** Tesseract and its English model are served from this
  same folder — about 16 MB of static files, of which a browser downloads 6.6 MB the first
  time it reads a scan. Tesseract.js would fetch those from a CDN by default; every path is
  pinned to a local file instead (`lib/extract/ocr.ts`, `scripts/copy-static-assets.mjs`).
  The Pi still only serves files.

The one honest test of that last point is DevTools' offline mode. Grepping the build for CDN
hostnames finds the unused defaults baked into Tesseract's own worker and proves nothing.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # rule and offset tests
```

## Deploying to a Raspberry Pi

Build on your own machine — the Pi never needs Node.

```bash
npm run build                          # writes ./out
rsync -av out/ pi@raspberrypi.local:/var/www/iew-grader/
```

`out/` is about 25 MB, most of it the OCR engine and English model. `prebuild` regenerates
those from `node_modules` via `scripts/copy-static-assets.mjs`, so they are not in git.

Then serve that folder with anything. With Caddy:

```
iew.local {
    root * /var/www/iew-grader
    file_server
}
```

Or nginx: point `root` at the folder and add `try_files $uri $uri/ /index.html;`.

To confirm the offline guarantee on the Pi, open the page, then turn off the network in
devtools and grade a paper. It should still work — including reading a scan, which is the
part with the most to prove.

## What it checks

**Dress-ups** — `-ly` adverbs, who/which clauses, www.asia.b clauses
**Sentence openers** — all six, classified per sentence, with the variety used per paragraph
**Decorations** — similes, alliteration, questions, triple extensions, conversation
**Banned words** — weak verbs and weak adjectives, each one individually checkable per paper
**Paragraph structure** — topic-sentence/clincher key-word repetition, over-repeated words

### What it deliberately does not check

Two items on the IEW checklist are quality judgments that no rule can make: whether a verb is
**strong** and whether an adjective has **quality**. Nothing deterministic separates *enormous*
from *big*.

Rather than guess, the app inverts the rule the way IEW teaches it — *replace the weak one* —
and flags the **banned** verbs and adjectives, which are a closed list and therefore exact.
Every other verb and adjective is reported as a **candidate count** for the teacher to judge,
never highlighted as if confirmed.

Metaphor (beyond simile) and dramatic open-close are not attempted for the same reason.

## Editing the word lists

The lists are plain arrays, kept apart from the rule logic:

| File | Contents |
| --- | --- |
| `lib/data/bannedWords.ts` | Banned verbs and adjectives |
| `lib/data/lyExceptions.ts` | `-ly` words that aren't adverbs, plus adverbs too empty to count |
| `lib/data/openers.ts` | www.asia.b words, prepositions, the VSS word limit |

Banned words are matched on the **lemma**, so listing `go` also catches *went*, *gone* and
*going*.

Be-verbs (*is, am, are, was, were*) are **not** on the banned verb list. They are helping verbs —
grammar rather than a weak verb choice — so the grader leaves them alone, and they are not counted
as strong-verb candidates either.

Rules can also be switched off in the UI, since IEW introduces dress-ups progressively by unit.
The same goes for banned words one at a time: **Banned words checked** lists every verb and
adjective with a checkbox, so a word the student was never asked to avoid can be left unflagged
without editing the file. Both selections are remembered in the browser.

Unchecking a word only stops it being *flagged*. It still doesn't count toward the strong-verb or
quality-adjective candidate totals — that would be claiming *good* is a quality adjective, which
is a different statement from "don't mark it on this paper".

## Notes on accuracy

Paragraphs are split on **line breaks** — one paragraph per line. This matters because the
checklist is scored per paragraph.

PDFs store positioned text runs rather than paragraphs, so breaks are inferred from coordinates
and are a best guess. Extracted text always lands in an editable box first so you can correct it
before grading.

Scans and photos hold a picture of the words rather than the words, so they take a slower path:
the page is rendered, read with OCR in your browser, and paragraph breaks are recovered from
where each line starts. It's offered as a button rather than run automatically, since it
downloads a few megabytes the first time and takes a few seconds a page.

**This is the weakest input, and it is worth knowing how it fails.** On a phone photo of a
typed paper the first page came back essentially perfect. The second — tilted, with a shadow
across it — kept its paragraph structure but misread a word here and there (*returned* as
*retumed*, *captured* as *captyreg*). Nothing warns you which words those are, so proofread
the box. A straight, evenly lit photo with the page filling the frame is worth the retake.

Two things it cannot do: a paragraph continuing across a page break becomes two paragraphs,
and handwriting is not attempted at all.
