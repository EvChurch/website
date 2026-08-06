import type { RockContentChannelItem } from '@/lib/rock-api'
import { isGuid } from '@/lib/rock-forms/constants'

function attribute(rock: RockContentChannelItem, key: string): string {
  const value = rock.AttributeValues?.[key]?.Value
  return typeof value === 'string' ? value.trim() : ''
}

function guid(value: string): string | null {
  return isGuid(value) ? value.toLowerCase() : null
}

function optionalText(value: string): string | null {
  return value || null
}

export type MappedServiceGuideItem = {
  rockId: number
  rockGuid: string | null
  title: string
  content: string | null
  promotionalBlurb: string | null
  bannerImageGuid: string | null
  status: number
  startDateTime: string | null
  expireDateTime: string | null
  priority: number
  sourceOrder: number
  campusGuids: string[]
  directLink: string | null
  workflowGuid: string | null
  connectionOpportunityGuid: string | null
  eventGuid: string | null
}

/** Maps the fixed Rock Service Guide contract without choosing an action. */
export function mapRockServiceGuideItem(rock: RockContentChannelItem): MappedServiceGuideItem {
  const campusGuids = attribute(rock, 'Campuses')
    .split(',')
    .map((value) => guid(value.trim()))
    .filter((value): value is string => value !== null)

  return {
    rockId: rock.Id,
    rockGuid: rock.Guid ? guid(rock.Guid) : null,
    title: rock.Title.trim(),
    content: optionalText(rock.Content?.trim() ?? ''),
    promotionalBlurb: optionalText(attribute(rock, 'PromotionalBlurb')),
    bannerImageGuid: guid(attribute(rock, 'Image')),
    status: rock.Status,
    startDateTime: rock.StartDateTime || null,
    expireDateTime: rock.ExpireDateTime || null,
    priority: rock.Priority ?? 0,
    sourceOrder: rock.Order ?? 0,
    campusGuids: [...new Set(campusGuids)],
    directLink: optionalText(attribute(rock, 'DirectLink')),
    workflowGuid: guid(attribute(rock, 'Workflow')),
    connectionOpportunityGuid: guid(attribute(rock, 'ConnectionOpportunity')),
    eventGuid: guid(attribute(rock, 'Event')),
  }
}
