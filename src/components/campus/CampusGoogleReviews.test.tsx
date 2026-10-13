// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CampusGoogleReviews } from './CampusGoogleReviews'

class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect() {}

  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this)
  }

  takeRecords() {
    return []
  }

  unobserve() {}
}

describe('CampusGoogleReviews', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('removes the whole section when Google Places fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))

    await act(async () => {
      root.render(
        <CampusGoogleReviews
          apiKey="test-key"
          campusName="Ev North"
          campusSlug="north"
          googleMapsUrl="https://maps.google.com/"
          placeId="test-place"
          reviewUrl="https://search.google.com/local/writereview?placeid=test-place"
        />,
      )
    })

    expect(container.innerHTML).toBe('')
  })
})
