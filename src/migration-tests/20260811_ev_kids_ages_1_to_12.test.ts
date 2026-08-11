import { describe, expect, it } from 'vitest'

import {
  EV_KIDS_AGES_1_TO_12_DOWN_SQL,
  EV_KIDS_AGES_1_TO_12_UP_SQL,
} from '@/migrations/20260811_143500_ev_kids_ages_1_to_12'

describe('Ev Kids ages migration', () => {
  it('updates every managed age format from 0 to 1', () => {
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain("'0 to 12', '1 to 12'")
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain("'0-12', '1-12'")
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain("'0 to 2', '1 to 2'")
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain("'0-2', '1-2'")
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain('"version_seo_meta_title"')
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain('"_pages_v_blocks_accordion_items"')
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain(
      `block."eyebrow" LIKE '%' || '0 to 12' || '%'`,
    )
    expect(EV_KIDS_AGES_1_TO_12_UP_SQL).toContain(
      `item."answer" LIKE '%' || '0-2' || '%'`,
    )
  })

  it('does not overwrite newer editor-authored copy on rollback', () => {
    expect(EV_KIDS_AGES_1_TO_12_DOWN_SQL).toBe('SELECT 1;')
  })
})
