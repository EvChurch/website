export const ROCK_FIELD_TYPES = {
  text: '9c204cd0-1233-41c5-818a-c5da439445aa',
  image: '97f8157d-a8c8-4ab3-96a2-9cb2a9049e6d',
  date: '6b6aa175-4758-453f-8d83-fcd8044b5f36',
  singleSelect: '7525c4cb-ee6b-41d4-9b64-a08048d5a5c0',
  multiSelect: 'bd0d9b57-2a41-4490-89ff-f01dab7d4904',
  memo: 'c28c7bf3-a552-4d77-9408-dedcf760ced0',
  boolean: '1edafded-dfe6-4334-b019-6eecba89e05a',
  currency: '3ee69cbc-35ce-4496-88cc-8327a447603f',
  file: '6f9e2dd0-e39e-4602-adf9-eb710a75304a',
  campuses: '69254f91-c97f-4c2d-9acb-1683b088097b',
  integer: 'a75dfc58-7a1b-4799-bf31-451b2bbe38ff',
  gender: '2e28779b-4c76-4142-ae8d-49ea31ddb503',
  phone: '6b1908ec-12a2-463a-a7bd-970ce0faf097',
  url: 'c0d0d7e2-c3b0-4004-abea-4bbfad10d5d2',
  person: 'e4eab7b2-0b76-429b-afe4-ad86d7428c70',
  address: '0a495222-23b7-41d3-82c8-d484cdb75d17',
  dateTime: 'fe95430c-322d-4b67-9c77-dfd1d4408725',
} as const

import type { RockListItem } from './types'

export function parseRockOptions(value?: string): RockListItem[] {
  if (!value) return []
  try {
    const options = JSON.parse(value)
    return Array.isArray(options) ? options : []
  } catch {
    return []
  }
}
