import { describe, expect, it } from 'vitest'

import { parsePassageText } from './passage'

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
