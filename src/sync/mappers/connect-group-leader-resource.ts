import type { RockAttributeValue, RockContentChannelItem } from '@/lib/rock-api'
import { isGuid } from '@/lib/rock-forms/constants'

function attribute(rock: RockContentChannelItem, key: string): RockAttributeValue | undefined {
  return rock.AttributeValues?.[key]
}

function text(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

function guid(value: string | null | undefined): string | null {
  const normalized = text(value)
  return normalized && isGuid(normalized) ? normalized.toLowerCase() : null
}

function attributeText(rock: RockContentChannelItem, key: string): string | null {
  return text(attribute(rock, key)?.Value)
}

function mapHost(value: RockAttributeValue | undefined): MappedResourceHost | null {
  const personAliasGuid = guid(value?.Value)
  const name = text(value?.ValueFormatted) ?? text(value?.PersistedTextValue)
  if (!personAliasGuid && !name) return null
  return { personAliasGuid, name: name ?? '' }
}

function mapFile(value: RockAttributeValue | undefined): MappedResourceFile | null {
  const fileGuid = guid(value?.Value)
  if (!fileGuid) return null
  return { guid: fileGuid, name: text(value?.PersistedTextValue) ?? '' }
}

export type MappedResourceHost = {
  personAliasGuid: string | null
  name: string
}

export type MappedResourceFile = {
  guid: string
  name: string
}

export type MappedConnectGroupLeaderResource = {
  rockId: number
  rockGuid: string | null
  title: string
  status: number
  startDateTime: string | null
  expireDateTime: string | null
  campusGuids: string[]
  youtubeUrl: string | null
  promotionalImageGuid: string | null
  description: string | null
  hosts: MappedResourceHost[]
  bibleReference: string | null
  leaderNotesFile: MappedResourceFile | null
  memberStudyFile: MappedResourceFile | null
  priority: number
  sourceOrder: number
}

/** Maps the fixed Rock Content Channel 24 attribute contract without persistence concerns. */
export function mapRockConnectGroupLeaderResource(
  rock: RockContentChannelItem,
): MappedConnectGroupLeaderResource {
  const campusGuids = (attributeText(rock, 'Campus') ?? '')
    .split(',')
    .map((value) => guid(value))
    .filter((value): value is string => value !== null)
  const hosts = [mapHost(attribute(rock, 'Host1')), mapHost(attribute(rock, 'Host2'))].filter(
    (host): host is MappedResourceHost => host !== null,
  )

  return {
    rockId: rock.Id,
    rockGuid: guid(rock.Guid),
    title: rock.Title.trim(),
    status: rock.Status,
    startDateTime: rock.StartDateTime || null,
    expireDateTime: rock.ExpireDateTime || null,
    campusGuids: [...new Set(campusGuids)],
    youtubeUrl: attributeText(rock, 'YouTubeURL'),
    promotionalImageGuid: guid(attributeText(rock, 'PromotionalImage')),
    description: attributeText(rock, 'Description') ?? text(rock.Content),
    hosts,
    bibleReference: attributeText(rock, 'BibleReference'),
    leaderNotesFile: mapFile(attribute(rock, 'Resource1File')),
    memberStudyFile: mapFile(attribute(rock, 'Resource2File')),
    priority: rock.Priority ?? 0,
    sourceOrder: rock.Order ?? 0,
  }
}
