import { describe, expect, it } from 'vitest'

import { extractRockImageGuid } from './rock-media'

describe('extractRockImageGuid', () => {
  it('reads Rock image GUIDs from relative and absolute photo URLs', () => {
    const guid = '9f6c8f0b-7df1-4ad5-9f82-a42be97188a0'
    expect(extractRockImageGuid(`/GetImage.ashx?Guid=${guid}`)).toBe(guid)
    expect(extractRockImageGuid(`https://rock.ev.church/GetImage.ashx?guid=${guid}&w=800`)).toBe(guid)
  })

  it('ignores photo URLs without a GUID', () => {
    expect(extractRockImageGuid('https://rock.ev.church/assets/event.jpg')).toBeNull()
  })
})
