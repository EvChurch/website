export interface LauncherCampus {
  slug: string
  name: string
}

export type LauncherItemAction =
  | { type: 'directLink'; href: string }
  | { type: 'workflow'; workflowTypeGuid: string; imageUrl?: string }
  | { type: 'connection'; blockGuid: string; imageUrl?: string }
  | { type: 'event'; href: string }
  | { type: 'content'; html: string; imageUrl?: string }

export interface LauncherItem {
  id: string
  title: string
  promotionalBlurb?: string
  searchText?: string
  campusSlugs: string[]
  action: LauncherItemAction
}

export interface LauncherData {
  available: boolean
  campuses: LauncherCampus[]
  items: LauncherItem[]
}
