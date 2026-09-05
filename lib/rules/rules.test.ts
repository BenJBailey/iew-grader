import { describe, expect, it } from 'vitest'
import { normalizeText, tokenize } from '../nlp/tokenize'
import { bannedWords, lyAdverbs, whoWhichClauses, wwwAsiaBClauses } from './dressUps'
import { alliteration, questions, similes, triples } from './decorations'
import { classifyOpeners } from './openers'
import type { Finding } from './types'

const doc = (text: string) => tokenize(normalizeText(text))

/** The words a finding actually covers -- proves offsets, not just counts. */
const covered = (text: string, findings: Finding[]) =>
  findings.map((f) => normalizeText(text).slice(f.start, f.end))

describe('-ly adverbs', () => {
  it('finds descriptive -ly adverbs', () => {
    const text = 'He quickly ran and silently waited.'
    expect(covered(text, lyAdverbs(doc(text)))).toEqual(['quickly', 'silently'])
  })

  it.each(['The family ate.', 'He sent a reply.', 'An ugly duckling swam.', 'She left early.'])(
    'rejects the -ly trap word in: %s',
    (text) => {
      expect(lyAdverbs(doc(text))).toHaveLength(0)
    },
  )

  it('rejects empty adverbs that earn no credit', () => {
    expect(lyAdverbs(doc('He only really wanted it.'))).toHaveLength(0)
  })
})

describe('who/which clauses', () => {
  it('finds a relative clause and spans it to the clause end', () => {
    const text = 'The boy who ran fast fell down.'
    expect(covered(text, whoWhichClauses(doc(text)))).toEqual(['who ran fast fell down.'])
  })

  it('stops the clause at a comma', () => {
    const text = 'The dog, which barked loudly, ran away.'
    expect(covered(text, whoWhichClauses(doc(text)))).toEqual(['which barked loudly'])
  })

  it('rejects a sentence-initial interrogative', () => {
    expect(whoWhichClauses(doc('Which one do you want?'))).toHaveLength(0)
  })

  it('rejects an interrogative that does not follow a noun', () => {
    expect(whoWhichClauses(doc('I wonder which one is best.'))).toHaveLength(0)
  })
})

describe('www.asia.b clauses', () => {
  // Every one of the eight words, since the POS tagger labels them
  // inconsistently (when/where -> ADV, although -> ADP, the rest -> SCONJ).
  it.each([
    ['when', 'He smiled when he saw the dog.'],
    ['while', 'He waited while she cooked dinner.'],
    ['where', 'He stopped where the road ended.'],
    ['as', 'He sang as he walked home.'],
    ['since', 'He rested since he felt tired.'],
    ['if', 'He will run if she calls him.'],
    ['although', 'He smiled although he felt tired.'],
    ['because', 'He cried because he lost it.'],
  ])('detects the clausal use of "%s"', (word, text) => {
    const findings = wwwAsiaBClauses(doc(text))
    expect(findings).toHaveLength(1)
    expect(covered(text, findings)[0].toLowerCase().startsWith(word)).toBe(true)
  })

  it.each([
    'He worked as a gift.',
    'He has been here since noon.',
  ])('rejects the prepositional use in: %s', (text) => {
    expect(wwwAsiaBClauses(doc(text))).toHaveLength(0)
  })

  it('rejects an interrogative', () => {
    expect(wwwAsiaBClauses(doc('When did he go home?'))).toHaveLength(0)
  })
})

describe('banned words', () => {
  it('catches a banned adjective and leaves the be-verb alone', () => {
    const text = 'The dog was good.'
    expect(covered(text, bannedWords(doc(text)))).toEqual(['good'])
  })

  it('matches inflections through the lemma', () => {
    const text = 'He went home and ate dinner.'
    expect(covered(text, bannedWords(doc(text)))).toEqual(['went', 'ate'])
  })

  it('bans "make" as a verb but not as the noun spelled the same way', () => {
    expect(covered('They make bread.', bannedWords(doc('They make bread.')))).toContain('make')

    const noun = 'He knew the make of the car.'
    expect(covered(noun, bannedWords(doc(noun)))).not.toContain('make')
  })

  it('does not ban be-verbs, which are helping verbs rather than weak ones', () => {
    const text = 'The dragon was sleeping soundly.'
    expect(covered(text, bannedWords(doc(text)))).not.toContain('was')
    expect(covered('There is a problem.', bannedWords(doc('There is a problem.')))).not.toContain(
      'is',
    )
  })

  it('flags only the words the teacher left checked', () => {
    const text = 'The good dog went home.'
    expect(covered(text, bannedWords(doc(text)))).toEqual(['good', 'went'])

    // Unticking is by lemma, so dropping "go" also drops the inflection "went".
    const onlyAdjectives = bannedWords(doc(text), { bannedLemmas: new Set(['good']) })
    expect(covered(text, onlyAdjectives)).toEqual(['good'])

    expect(bannedWords(doc(text), { bannedLemmas: new Set() })).toHaveLength(0)
  })
})

describe('sentence openers', () => {
  it.each([
    ['#1 subject', 'The determined boy climbed over the tall fence.', 1],
    ['#2 prepositional', 'Into the deep woods the frightened boy ran quickly.', 2],
    ['#3 -ly adverb', 'Quickly the frightened boy ran into the deep woods.', 3],
    ['#4 -ing', 'Running quickly, the frightened boy escaped the angry dog.', 4],
    ['#5 clausal', 'Because he was afraid, the boy ran into the woods.', 5],
    ['#6 very short', 'He ran fast.', 6],
  ])('classifies %s', (_label, text, expected) => {
    expect(classifyOpeners(doc(text))[0].type).toBe(expected)
  })

  it('sees a prepositional opener behind a leading modifier', () => {
    // The tagger labels "Deep" as PROPN, so the second word has to be checked.
    expect(classifyOpeners(doc('Deep inside the woods a hungry dragon slept.'))[0].type).toBe(2)
  })

  it.each([
    ['determiner subject', 'The frightened boy in the park ran away quickly.'],
    ['noun subject', 'Morning in the woods arrived cold and grey.'],
  ])('treats a noun phrase followed by a preposition as #1, not #2: %s', (_label, text) => {
    expect(classifyOpeners(doc(text))[0].type).toBe(1)
  })

  it('does not mistake a noun ending in -ing for an -ing opener', () => {
    // "Morning" is a NOUN; only a VERB makes a participial opener.
    expect(classifyOpeners(doc('Morning came early for the tired boy.'))[0].type).toBe(1)
  })

  it('checks length before the first word, so a short sentence is #6', () => {
    expect(classifyOpeners(doc('Quickly he ran.'))[0].type).toBe(6)
  })

  it('classifies each sentence independently', () => {
    const types = classifyOpeners(
      doc('Quickly the boy ran home again. Into the woods he wandered slowly.'),
    ).map((o) => o.type)
    expect(types).toEqual([3, 2])
  })
})

describe('decorations', () => {
  it('finds questions', () => {
    expect(questions(doc('Where did he go? He ran.'))).toHaveLength(1)
  })

  it('finds both simile forms', () => {
    expect(similes(doc('He ran like the wind.'))).toHaveLength(1)
    expect(similes(doc('She was as tall as a tree.'))).toHaveLength(1)
  })

  it('finds a simile even where the tagger mislabels "like"', () => {
    // Tagged NOUN here rather than ADP; requiring ADP would lose the simile.
    expect(similes(doc('Its scales shimmered like scattered coins.'))).toHaveLength(1)
  })

  it('does not treat the verb "like" as a simile', () => {
    expect(similes(doc('The children like warm bread.'))).toHaveLength(0)
  })

  it('finds a simile when an object separates it from the verb', () => {
    expect(similes(doc('The trees closed behind him like a heavy door.'))).toHaveLength(1)
  })

  it('stops the simile before a following clause', () => {
    // Must not swallow the www.asia.b clause, which is its own finding.
    const text = 'It growled like a distant storm while the stranger waited.'
    expect(covered(text, similes(doc(text)))).toEqual(['like a distant storm'])
  })

  it('finds alliteration among content words', () => {
    const text = 'The slippery snake slithered away.'
    expect(covered(text, alliteration(doc(text)))).toEqual(['slippery snake slithered'])
  })

  it('finds a series of three', () => {
    expect(triples(doc('He ran, jumped, and fell.'))).toHaveLength(1)
    expect(triples(doc('He ran and fell.'))).toHaveLength(0)
  })
})
