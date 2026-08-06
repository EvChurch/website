import { describe, expect, it } from 'vitest'

import { Campuses } from './Campuses'

type FieldRecord = {
  name?: string
  fields?: FieldRecord[]
  validate?: (
    value: unknown,
    options: { siblingData: Record<string, unknown> },
  ) => string | true | Promise<string | true>
}

function field(name: string): FieldRecord {
  const pageContent = (Campuses.fields as FieldRecord[]).find(
    (candidate) => candidate.name === 'pageContent',
  )
  const result = pageContent?.fields?.find((candidate) => candidate.name === name)
  if (!result) throw new Error(`Missing campus page field: ${name}`)
  return result
}

describe('Campuses service calendar validation', () => {
  it('accepts only exact weekday names', async () => {
    const validate = field('serviceDay').validate

    await expect(
      Promise.resolve(validate?.('Sunday', { siblingData: {} })),
    ).resolves.toBe(true)
    await expect(
      Promise.resolve(validate?.('Sundays', { siblingData: {} })),
    ).resolves.toContain('weekday')
  })

  it('prevents an end time at or before the start time', async () => {
    const validate = field('serviceCloses').validate

    await expect(
      Promise.resolve(validate?.('11:30', { siblingData: { serviceOpens: '10:15' } })),
    ).resolves.toBe(true)
    await expect(
      Promise.resolve(validate?.('10:15', { siblingData: { serviceOpens: '10:15' } })),
    ).resolves.toContain('after')
    await expect(
      Promise.resolve(validate?.('09:45', { siblingData: { serviceOpens: '10:15' } })),
    ).resolves.toContain('after')
  })
})
