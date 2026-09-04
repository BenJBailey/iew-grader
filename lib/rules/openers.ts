import type { TokenizedDoc } from '../nlp/tokenize'
import { LY_EXCEPTIONS } from '../data/lyExceptions'
import { PREPOSITIONS, VSS_MAX_WORDS, VSS_MIN_WORDS, WWW_ASIA_B } from '../data/openers'
import { isClausalUse } from './dressUps'
import type { OpenerType, SentenceOpener } from './types'

/**
 * A #2 opener is a sentence that starts with a prepositional phrase.
 *
 * Checking only the first word misses the common "Deep inside the woods..."
 * shape, where a modifier precedes the preposition -- and the tagger is no help
 * there, labelling "Deep" as PROPN. So the second word is checked too, guarded
 * by the first word's tag: if the sentence opens with a determiner, noun or
 * pronoun then that noun phrase is the subject and any following preposition is
 * just modifying it ("The boy in the park ran", "Morning in the woods was cold"),
 * which is a #1, not a #2.
 */
function isPrepositionalOpener(doc: TokenizedDoc, firstWordIndex: number): boolean {
  const first = doc.tokens[firstWordIndex]
  if (first.pos === 'ADP' || PREPOSITIONS.has(first.normal)) return true

  if (['DET', 'NOUN', 'PRON'].includes(first.pos)) return false

  for (let i = firstWordIndex + 1; i < doc.tokens.length; i++) {
    const token = doc.tokens[i]
    if (!token.isWord) continue
    return token.pos === 'ADP' || PREPOSITIONS.has(token.normal)
  }
  return false
}

/**
 * Classify every sentence into exactly one of IEW's six openers.
 *
 * Order matters and is not arbitrary: #6 is a property of the whole sentence
 * (its length) while #2-#5 are properties of the first word, so the length test
 * has to run first or a short sentence like "Quickly he ran." would be filed
 * under #3 and never counted as a very short sentence.
 *
 * Everything that matches nothing falls through to #1, which is correct -- #1 is
 * defined as "starts with the subject", i.e. the absence of the other five.
 */
export function classifyOpeners(doc: TokenizedDoc): SentenceOpener[] {
  return doc.sentences.map((sentence) => {
    const first = doc.tokens[sentence.firstWord]
    let type: OpenerType = 1

    if (sentence.wordCount >= VSS_MIN_WORDS && sentence.wordCount <= VSS_MAX_WORDS) {
      type = 6
    } else if (
      first.pos === 'ADV' &&
      first.normal.endsWith('ly') &&
      !LY_EXCEPTIONS.has(first.normal)
    ) {
      type = 3
    } else if (WWW_ASIA_B.has(first.normal) && isClausalUse(doc, first.index)) {
      type = 5
    } else if (first.normal.endsWith('ing') && first.pos === 'VERB') {
      // The VERB tag is what separates the participial "Running quickly, he fell"
      // from the plain noun subject in "Morning came early."
      type = 4
    } else if (isPrepositionalOpener(doc, sentence.firstWord)) {
      type = 2
    }

    return {
      sentence: sentence.index,
      paragraph: sentence.paragraph,
      type,
      start: first.start,
      end: first.end,
    }
  })
}
