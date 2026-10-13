import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@/payload-types'

const mocks = vi.hoisted(() => ({
  rockFetchAll: vi.fn(),
  find: vi.fn(),
  unstableCache: vi.fn((loader: unknown) => loader),
}))
vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }))
vi.mock('./rock-api', () => ({ rockFetchAll: mocks.rockFetchAll }))
vi.mock('./payload', () => ({ getPayloadClient: async () => ({ find: mocks.find }) }))

import {
  applyExplainingChristianityAction,
  getExplainingChristianityAction,
} from './explaining-christianity'

const fallback = { label: 'Register your interest', href: '?launcher=explaining-christianity' }
const event = {
  id: 20,
  rockEventId: 9,
  title: 'A renamed course',
  slug: 'faith-course-september',
  startDate: '2099-09-14T06:30:00Z',
  endDate: '2099-09-14T08:00:00Z',
  registrationStatus: 'open',
  registrationUrl: 'https://registration.ev.church/Registration?RegistrationInstanceId=10',
}
const rock = () => ({
  EventCalendars: [{ Id: 1 }],
  Attributes: [{
    Id: 10133,
    EntityTypeQualifierValue: '1',
    FieldType: { Class: 'Rock.Field.Types.BooleanFieldType' },
  }],
  EventCalendarItems: [{ Id: 12, EventItemId: 9 }],
  AttributeValues: [{ Id: 200, EntityId: 12, Value: 'True' }],
})

function useRock(data: Record<string, unknown>) {
  mocks.rockFetchAll.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
    if (!(endpoint in data)) throw new Error(`Unexpected endpoint ${endpoint}`)
    return data[endpoint]
  })
}

describe('EC registration action', () => {
  beforeEach(() => {
    mocks.find.mockReset()
    mocks.rockFetchAll.mockReset()
    useRock(rock())
    mocks.find.mockResolvedValue({ docs: [event] })
  })

  it('refreshes the action on the events cache tag and a five-minute fallback', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['explaining-christianity-action-v2'],
      { tags: ['events'], revalidate: 300 },
    )
  })

  it('matches the explicit Rock marker, even when the title and slug change', async () => {
    await expect(getExplainingChristianityAction()).resolves.toMatchObject({
      label: 'Register now', href: '?launcher=registration&registrationInstanceId=10',
      eventHref: '/events/faith-course-september',
    })
    expect(mocks.rockFetchAll).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'AttributeValues',
      params: { $filter: 'AttributeId eq 10133', $select: 'Id,EntityId,Value' },
    }))
    expect(mocks.rockFetchAll).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'Attributes',
      params: expect.objectContaining({
        $filter: expect.stringContaining("EntityType/Name eq 'Rock.Model.EventCalendarItem'"),
      }),
    }))
  })

  it('does not infer EC from its name or slug when the marker is unticked', async () => {
    const data = rock()
    data.AttributeValues[0].Value = 'False'
    useRock(data)
    mocks.find.mockResolvedValue({ docs: [{ ...event, title: 'Explaining Christianity', slug: 'explaining-christianity' }] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it.each(['closed', 'full', 'coming-soon', null])('uses interest for registration status %s', async (registrationStatus) => {
    mocks.find.mockResolvedValue({ docs: [{ ...event, registrationStatus }] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it.each([null, '', 'https://untrusted.example/register', 'http://rock.ev.church/register'])('uses interest for unavailable or invalid registration URL %s', async (registrationUrl) => {
    mocks.find.mockResolvedValue({ docs: [{ ...event, registrationUrl }] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('uses interest when the event is missing or has not been synced', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('uses interest after the event ends', async () => {
    mocks.find.mockResolvedValue({ docs: [{ ...event, startDate: '2000-01-01T00:00:00Z', endDate: '2000-01-02T00:00:00Z' }] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('uses interest when the event has no date', async () => {
    mocks.find.mockResolvedValue({ docs: [{ ...event, startDate: null, endDate: null }] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('selects the earliest eligible marked event, skipping closed courses', async () => {
    const data = rock()
    data.EventCalendarItems.push({ Id: 13, EventItemId: 10 }, { Id: 14, EventItemId: 11 })
    data.AttributeValues.push({ Id: 201, EntityId: 13, Value: 'true' }, { Id: 202, EntityId: 14, Value: 'True' })
    useRock(data)
    mocks.find.mockResolvedValue({ docs: [
      { ...event, id: 22, rockEventId: 11, slug: 'later', startDate: '2099-10-01T00:00:00Z', endDate: null },
      { ...event, registrationStatus: 'closed' },
      { ...event, id: 21, rockEventId: 10, slug: 'next-open', startDate: '2099-09-20T00:00:00Z', endDate: null },
    ] })
    await expect(getExplainingChristianityAction()).resolves.toMatchObject({
      label: 'Register now', href: '?launcher=registration&registrationInstanceId=10', eventHref: '/events/next-open',
    })
  })

  it('includes the Auckland date, time and event location', async () => {
    mocks.find.mockResolvedValue({ docs: [{ ...event,
      campus: { name: 'Central', slug: 'central' },
      location: { name: 'Seminar Room', address: '22 Symonds St' },
    }] })
    const action = await getExplainingChristianityAction()
    expect(action.description).toContain('14 September 2099')
    expect(action.description).toContain('6:30 pm')
    expect(action.description).toContain('Central · Seminar Room · 22 Symonds St')
  })

  it('does not invent missing location details', async () => {
    const action = await getExplainingChristianityAction()
    expect(action.description).not.toMatch(/undefined|null| · $/)
  })

  it.each([
    'https://rock.ev.church/Registration?RegistrationInstanceId=10',
    'https://registration.ev.church/course',
    'https://registration.ev.church/?RegistrationInstanceId=0',
    'https://registration.ev.church/?RegistrationInstanceId=9007199254740992',
  ])('uses the validated form URL when it cannot be embedded: %s', async (registrationUrl) => {
    mocks.find.mockResolvedValue({ docs: [{ ...event, registrationUrl }] })
    await expect(getExplainingChristianityAction()).resolves.toMatchObject({ href: registrationUrl })
  })

  it.each(['EventCalendars', 'Attributes', 'EventCalendarItems', 'AttributeValues'])('uses interest when %s is empty', async (endpoint) => {
    useRock({ ...rock(), [endpoint]: [] })
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('ignores marker attributes belonging to another calendar', async () => {
    const data = rock()
    data.Attributes[0].EntityTypeQualifierValue = '2'
    useRock(data)
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('joins values to calendar-item IDs, not event IDs', async () => {
    const data = rock()
    data.AttributeValues[0].EntityId = 9
    useRock(data)
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
  })

  it('uses interest if Rock fails without leaking provider details', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.rockFetchAll.mockRejectedValue(new Error('private provider details'))
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
    expect(warn).toHaveBeenCalledWith('EC event lookup unavailable; using the interest form.')
    warn.mockRestore()
  })

  it('uses interest if the event catalogue fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.find.mockRejectedValue(new Error('database unavailable'))
    await expect(getExplainingChristianityAction()).resolves.toEqual(fallback)
    warn.mockRestore()
  })
})

describe('EC page buttons', () => {
  const layout: NonNullable<Page['layout']> = [
    { blockType: 'hero', heading: 'Explore faith', image: 1, buttons: [{ ...fallback, variant: 'primary', id: 'hero-button' }] },
    { blockType: 'cta', heading: 'Curious?', buttons: [fallback, { label: 'Contact', href: '/contact' }] },
    { blockType: 'content', heading: 'About the course', body: {
      root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
    } },
  ]

  it('updates both EC buttons without changing other content or mutating CMS data', () => {
    const action = { label: 'Register now', href: '/events/course' }
    const result = applyExplainingChristianityAction(layout, action)
    expect(result[0]).toMatchObject({ buttons: [{ ...action, variant: 'primary', id: 'hero-button' }] })
    expect(result[1]).toMatchObject({ buttons: [action, { label: 'Contact', href: '/contact' }] })
    expect(result[2]).toBe(layout[2])
    expect(layout[0]).toMatchObject({ buttons: [expect.objectContaining(fallback)] })
  })

  it('retains the original interest form in fallback mode', () => {
    expect(applyExplainingChristianityAction(layout, fallback)).toEqual(layout)
  })

  it('adds More info and a description only to blocks containing an EC action', () => {
    const action = { label: 'Register now', href: '?launcher=registration&registrationInstanceId=10',
      eventHref: '/events/course', description: 'Monday, 6:30 pm · Seminar Room',
    }
    const result = applyExplainingChristianityAction(layout, action)
    expect(result[0]).toMatchObject({ actionDescription: action.description, buttons: [
      expect.objectContaining({ label: 'Register now', href: action.href }),
      expect.objectContaining({ label: 'More info', href: action.eventHref, variant: 'text' }),
    ] })
    expect(result[1]).toMatchObject({ actionDescription: action.description, buttons: [
      expect.objectContaining({ href: action.href }), { label: 'Contact', href: '/contact' },
      expect.objectContaining({ label: 'More info', href: action.eventHref, variant: 'secondary' }),
    ] })
    expect(result[2]).toBe(layout[2])
    expect(layout[0]).not.toHaveProperty('actionDescription')
  })
})
