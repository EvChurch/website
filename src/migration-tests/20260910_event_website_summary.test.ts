import { describe, expect, it } from 'vitest'
import { EVENT_WEBSITE_SUMMARY_UP_SQL } from '@/migrations/20260910_070000_event_website_summary'
import { migrations } from '@/migrations'

describe('event website summary migration', () => {
  it('only adds the reusable schema and never targets event content', () => {
    expect(EVENT_WEBSITE_SUMMARY_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS website_summary jsonb')
    expect(EVENT_WEBSITE_SUMMARY_UP_SQL).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i)
    expect(EVENT_WEBSITE_SUMMARY_UP_SQL).not.toContain('Weekend Together')
  })

  it('is registered for deployment', () => {
    expect(migrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '20260910_070000_event_website_summary' }),
    ]))
  })
})
