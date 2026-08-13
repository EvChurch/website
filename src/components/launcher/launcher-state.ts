export type LauncherPresentation = 'collapsed' | 'compact' | 'fullscreen'

export type LauncherView =
  | { type: 'home' }
  | { type: 'catalogue' }
  | { type: 'workflow'; workflowTypeGuid: string; imageUrl?: string; title: string }
  | { type: 'connection'; blockGuid: string; imageUrl?: string; title: string }
  | { type: 'content'; html: string; imageUrl?: string; title: string }

export interface LauncherState {
  presentation: LauncherPresentation
  view: LauncherView
  history: LauncherView[]
  campusSlug: string | null
  query: string
  catalogueScrollTop: number
}

export type LauncherAction =
  | { type: 'open'; presentation?: Exclude<LauncherPresentation, 'collapsed'> }
  | { type: 'close' }
  | { type: 'toggleFullscreen' }
  | { type: 'push'; view: LauncherView }
  | { type: 'back' }
  | { type: 'setCampus'; campusSlug: string | null }
  | { type: 'setQuery'; query: string }
  | { type: 'setCatalogueScroll'; scrollTop: number }

export function createLauncherState(campusSlug: string | null = null): LauncherState {
  return {
    presentation: 'collapsed',
    view: { type: 'home' },
    history: [],
    campusSlug,
    query: '',
    catalogueScrollTop: 0,
  }
}

export function launcherReducer(
  state: LauncherState,
  action: LauncherAction,
): LauncherState {
  switch (action.type) {
    case 'open':
      return { ...state, presentation: action.presentation ?? 'compact' }
    case 'close':
      return {
        ...state,
        presentation: 'collapsed',
        view: { type: 'home' },
        history: [],
        query: '',
        catalogueScrollTop: 0,
      }
    case 'toggleFullscreen':
      return {
        ...state,
        presentation:
          state.presentation === 'fullscreen' ? 'compact' : 'fullscreen',
      }
    case 'push':
      return {
        ...state,
        view: action.view,
        history: [...state.history, state.view],
      }
    case 'back': {
      const view = state.history.at(-1)
      if (!view) return state
      return {
        ...state,
        view,
        history: state.history.slice(0, -1),
      }
    }
    case 'setCampus':
      return { ...state, campusSlug: action.campusSlug, catalogueScrollTop: 0 }
    case 'setQuery':
      return { ...state, query: action.query, catalogueScrollTop: 0 }
    case 'setCatalogueScroll':
      return { ...state, catalogueScrollTop: action.scrollTop }
  }
}

const CAMPUS_PATH_PATTERN = /^\/campus\/(north|central|unichurch)(?:\/|$)/i

export function campusFromPathname(pathname: string): string | null {
  return pathname.match(CAMPUS_PATH_PATTERN)?.[1]?.toLowerCase() || null
}

export function chooseInitialCampus({
  pathname,
  memberCampus,
  storedCampus,
  fallbackCampus = 'central',
  validCampusSlugs,
}: {
  pathname: string
  memberCampus?: string | null
  storedCampus: string | null
  fallbackCampus?: string | null
  validCampusSlugs: readonly string[]
}): string | null {
  const valid = new Set(validCampusSlugs)
  const routeCampus = campusFromPathname(pathname)
  if (routeCampus && valid.has(routeCampus)) return routeCampus
  if (storedCampus && valid.has(storedCampus)) return storedCampus
  if (memberCampus && valid.has(memberCampus)) return memberCampus
  return fallbackCampus && valid.has(fallbackCampus) ? fallbackCampus : null
}

export function launcherItemMatches(
  item: { title: string; promotionalBlurb?: string | null; searchText?: string | null },
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true
  return [item.title, item.promotionalBlurb, item.searchText]
    .filter(Boolean)
    .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery))
}
