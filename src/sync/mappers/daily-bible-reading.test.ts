import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { RockCommunication } from '@/lib/rock-api'

import {
  classifyDailyBibleReadingCommunication,
  mapRockDailyBibleReading,
} from './daily-bible-reading'

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/dbr-2026-08-10.html', import.meta.url)),
  'utf8',
)

describe('classifyDailyBibleReadingCommunication', () => {
  it('accepts only a sent communication for the durable list and exact normalized subject', () => {
    expect(classifyDailyBibleReadingCommunication(communication())).toEqual({ eligible: true })
    expect(classifyDailyBibleReadingCommunication(communication({ ListGroupId: 1 }))).toEqual({
      eligible: false,
      reason: 'wrong-list',
    })
    expect(classifyDailyBibleReadingCommunication(communication({ Status: 1 }))).toEqual({
      eligible: false,
      reason: 'not-sent',
    })
    expect(classifyDailyBibleReadingCommunication(communication({ SendDateTime: null }))).toEqual({
      eligible: false,
      reason: 'missing-sent-at',
    })
    expect(classifyDailyBibleReadingCommunication(communication({ Subject: 'Another subject' }))).toEqual({
      eligible: false,
      reason: 'wrong-subject',
    })
    expect(classifyDailyBibleReadingCommunication(communication({
      Subject: '  A Word from God   for you today  ',
    }))).toEqual({ eligible: true })
  })
})

describe('mapRockDailyBibleReading', () => {
  it('maps the real sanitized DBR fixture deterministically to plain text', () => {
    const result = mapRockDailyBibleReading(communication())

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        rockId: 16159,
        rockGuid: '8bfe99e0-ab67-45d7-bf6d-e1dcfe3bf66b',
        sourceName: 'DBR 2026/08/10',
        rockSentAt: '2026-08-09T17:00:54.003Z',
        sourceDate: '2026-08-10',
        openingScripture:
          '"Your word is a lamp to my feet and a light to my path." - Psalm 119:105',
        passageReference: 'Hebrews 5:11-6:20',
        questions: [
          'How would you summarise the warning of this passage?',
          'Why is the author “confident of better things” (6:9) regarding these people?',
          'How do you tend to respond to warnings like this?',
        ],
        prayerPrompts: [
          'Ask God to help you heed the warnings He has given us',
          'Ask God to preserve your faith in Jesus',
          'Praise God that we have a saviour who we can really trust',
        ],
      }),
    })
    if (result.ok) {
      expect(result.value.passageText).toContain('11 We have a great deal to say')
      expect(result.value.passageText).toContain('20 Jesus has entered there on our behalf')
      expect(result.value.passageText).not.toContain('<')
    }
  })

  it('accepts reordered harmless wrappers and absent optional sections', () => {
    const result = mapRockDailyBibleReading(communication({
      Message: `
        <main><h3> Opening line </h3></main>
        <section><h1>Passage</h1><div><p>John 1:1</p><p>In the beginning was the Word.</p></div></section>
      `,
    }))

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        openingScripture: 'Opening line',
        passageReference: 'John 1:1',
        passageText: 'In the beginning was the Word.',
        questions: [],
        prayerPrompts: [],
      }),
    })
  })

  it('combines every reference from a plural Passages section', () => {
    const result = mapRockDailyBibleReading(communication({
      Message: `
        <h3>Opening line</h3>
        <h1>Passages</h1>
        <p>Genesis 14:17-24</p>
        <p>First passage text.</p>
        <p>Hebrews 7:1-10</p>
        <p>Second passage text.</p>
        <h1>Questions</h1>
        <p>What do you notice?</p>
      `,
    }))

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        passageReference: 'Genesis 14:17-24; Hebrews 7:1-10',
        passageText: 'First passage text.\n\nSecond passage text.',
        questions: ['What do you notice?'],
      }),
    })
  })

  it.each([
    ['missing passage identity', '<h3>Opening</h3><h1>Passage</h1><p>Only one paragraph</p>', 'missing-passage'],
    [
      'ambiguous sections',
      '<h3>Opening</h3><h1>Passage</h1><p>John 1:1</p><p>Text</p><h1>Passage</h1><p>John 1:2</p><p>Text</p>',
      'ambiguous-section',
    ],
    ['missing anchor', '<h1>Passage</h1><p>John 1:1</p><p>Text</p>', 'missing-opening-scripture'],
  ])('fails closed for %s', (_label, Message, code) => {
    expect(mapRockDailyBibleReading(communication({ Message }))).toEqual({
      ok: false,
      diagnostic: { rockId: 16159, code },
    })
  })
})

function communication(overrides: Partial<RockCommunication> = {}): RockCommunication {
  return {
    Id: 16159,
    Guid: '8bfe99e0-ab67-45d7-bf6d-e1dcfe3bf66b',
    Name: 'DBR 2026/08/10',
    ListGroupId: 28916,
    Subject: 'A Word from God for you today',
    Status: 3,
    SendDateTime: '2026-08-10T05:00:54.003',
    FutureSendDateTime: '2026-08-10T05:00:00',
    Message: fixture,
    ...overrides,
  }
}
