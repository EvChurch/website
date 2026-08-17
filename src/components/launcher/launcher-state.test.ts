import { describe, expect, it } from 'vitest'
import {
  chooseInitialCampus,
  createLauncherState,
  launcherItemMatches,
  launcherReducer,
} from './launcher-state'

describe('launcherReducer', () => {
  it('opens, pushes views, goes back, toggles fullscreen, and resets on close', () => {
    let state = launcherReducer(createLauncherState('north'), { type: 'open' })
    state = launcherReducer(state, { type: 'push', view: { type: 'catalogue' } })
    state = launcherReducer(state, { type: 'setQuery', query: 'kids' })
    state = launcherReducer(state, { type: 'setCatalogueScroll', scrollTop: 240 })
    state = launcherReducer(state, {
      type: 'push',
      view: { type: 'content', title: 'Kids', html: '<p>Welcome</p>' },
    })
    state = launcherReducer(state, { type: 'toggleFullscreen' })

    expect(state.presentation).toBe('fullscreen')
    expect(launcherReducer(state, { type: 'back' })).toMatchObject({
      view: { type: 'catalogue' },
      query: 'kids',
      catalogueScrollTop: 240,
    })

    expect(launcherReducer(state, { type: 'close' })).toMatchObject({
      presentation: 'collapsed',
      view: { type: 'home' },
      history: [],
      query: '',
      campusSlug: 'north',
    })
  })

  it('opens giving with a home history entry and clears it completely on close', () => {
    const giving = launcherReducer(createLauncherState('central'), {
      type: 'openGiving',
      presentation: 'fullscreen',
    })

    expect(giving).toMatchObject({
      presentation: 'fullscreen',
      view: { type: 'giving' },
      history: [{ type: 'home' }],
    })
    expect(launcherReducer(giving, { type: 'back' })).toMatchObject({
      view: { type: 'home' },
      history: [],
    })
    expect(launcherReducer(giving, { type: 'close' })).toMatchObject({
      presentation: 'collapsed',
      view: { type: 'home' },
      history: [],
    })
  })
})

describe('launcher campus and search helpers', () => {
  const validCampusSlugs = ['north', 'central', 'unichurch']

  it('prefers route, remembered, member, then Central campus', () => {
    expect(
      chooseInitialCampus({
        pathname: '/campus/north/visit',
        storedCampus: 'central',
        validCampusSlugs,
      }),
    ).toBe('north')
    expect(
      chooseInitialCampus({
        pathname: '/about',
        storedCampus: 'central',
        validCampusSlugs,
      }),
    ).toBe('central')
    expect(
      chooseInitialCampus({
        pathname: '/about',
        storedCampus: 'not-a-campus',
        validCampusSlugs,
      }),
    ).toBe('central')
    expect(
      chooseInitialCampus({
        pathname: '/about',
        storedCampus: null,
        memberCampus: 'north',
        validCampusSlugs,
      }),
    ).toBe('north')
    expect(
      chooseInitialCampus({
        pathname: '/about',
        storedCampus: 'unichurch',
        memberCampus: 'north',
        validCampusSlugs,
      }),
    ).toBe('unichurch')
  })

  it('matches title, blurb, and content text case-insensitively', () => {
    const item = {
      title: 'Join a group',
      promotionalBlurb: 'Find community',
      searchText: 'Meet during the week',
    }
    expect(launcherItemMatches(item, 'GROUP')).toBe(true)
    expect(launcherItemMatches(item, 'community')).toBe(true)
    expect(launcherItemMatches(item, 'during')).toBe(true)
    expect(launcherItemMatches(item, 'baptism')).toBe(false)
    expect(launcherItemMatches(item, '  ')).toBe(true)
  })
})
