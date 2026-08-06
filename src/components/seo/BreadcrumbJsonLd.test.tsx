import { describe, expect, it } from 'vitest'

import { buildBreadcrumbs } from './BreadcrumbJsonLd'

describe('buildBreadcrumbs', () => {
  it('keeps former Next Steps child pages in a flat public hierarchy', () => {
    expect(buildBreadcrumbs('/newish', 'Newish Connect')).toEqual([
      { name: 'Home', url: 'https://ev.church' },
      { name: 'Newish Connect', url: 'https://ev.church/newish' },
    ])
  })
})
