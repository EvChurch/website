import { describe, expect, it } from 'vitest'

import { parsePassageText, parsePassageVerses } from './passage'

describe('parsePassageVerses', () => {
  it('separates numbers and trims each verse without stripping numbers in its text', () => {
    expect(parsePassageVerses(' [11] First verse with 12 people.\n [12] Second verse. ')).toEqual([
      { number: 11, text: 'First verse with 12 people.' },
      { number: 12, text: 'Second verse.' },
    ])
  })

  it('preserves repeated verse numbers across chapters in order', () => {
    expect(parsePassageVerses('[1] First chapter. [2] More.\n\n[1] Next chapter.')).toEqual([
      { number: 1, text: 'First chapter.' },
      { number: 2, text: 'More.' },
      { number: 1, text: 'Next chapter.' },
    ])
  })

  it('preserves unnumbered content without inventing a verse number', () => {
    expect(parsePassageVerses('A [helpful note]. [10] Verse text.')).toEqual([
      { number: null, text: 'A [helpful note].' },
      { number: 10, text: 'Verse text.' },
    ])
    expect(parsePassageVerses('Unnumbered text.')).toEqual([
      { number: null, text: 'Unnumbered text.' },
    ])
  })

  it('returns no verses for blank content', () => {
    expect(parsePassageVerses(' \n ')).toEqual([])
  })
})

describe('parsePassageText', () => {
  it('extracts numeric verse markers without their brackets', () => {
    expect(parsePassageText('[11] First verse. [12] Second verse.')).toEqual([
      { type: 'verse', number: '11' },
      { type: 'text', value: ' First verse. ' },
      { type: 'verse', number: '12' },
      { type: 'text', value: ' Second verse.' },
    ])
  })

  it('preserves ordinary bracketed text and text without markers', () => {
    expect(parsePassageText('A [helpful note] stays intact.')).toEqual([
      { type: 'text', value: 'A [helpful note] stays intact.' },
    ])
  })
})
