import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ list: vi.fn(), latest: vi.fn(), detail: vi.fn() }))
vi.mock('@/lib/daily-readings/data', () => ({
  getPublishedDailyReadings: mocks.list,
  getLatestDailyReading: mocks.latest,
  getDailyReadingByRockId: mocks.detail,
}))

import { GET as list, OPTIONS } from './route'
import { GET as latest } from './latest/route'
import { GET as detail } from './[readingId]/route'

const reading = {
  id: 999,
  rockId: 42,
  sourceName: 'Daily Bible Reading',
  sourceDate: '2026-10-18T11:00:00.000Z',
  rockSentAt: '2026-10-18T18:00:00.000Z',
  openingScripture: 'Be still.',
  passageReference: 'Psalm 46:10',
  passageText: '[10] Be still, and know that I am God.',
  bibleVersionAbbreviation: 'CSB',
  bibleVersionTitle: 'Christian Standard Bible',
  bibleCopyright: 'Sample copyright notice',
  apiBibleFumsToken: 'first-token\n second-token\n',
  questions: ['What does this teach you?'],
  prayerPrompts: ['Pray for peace.'],
  rockGuid: 'internal-field',
  importedAt: 'internal-field',
}
const request = (query = '') => new Request(`https://ev.church/api/daily-readings${query}`)
const readDetail = (id: string) => detail(request(), { params: Promise.resolve({ readingId: id }) })

describe('public daily readings API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.list.mockResolvedValue([reading])
    mocks.latest.mockResolvedValue(reading)
    mocks.detail.mockResolvedValue(reading)
  })

  it('returns bounded recent summaries with public IDs and CORS', async () => {
    const response = await list(request('?limit=5'))
    expect(mocks.list).toHaveBeenCalledWith(5)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()
    expect(body.readings[0]).toEqual({
      id: 42, title: reading.sourceName, date: reading.sourceDate,
      publishedAt: reading.rockSentAt, openingScripture: reading.openingScripture,
      passageReference: reading.passageReference, questions: reading.questions,
      prayerPrompts: reading.prayerPrompts,
    })
  })

  it('defaults to 20 and returns an empty list when there are no readings', async () => {
    mocks.list.mockResolvedValue([])
    expect(await (await list(request())).json()).toEqual({ readings: [] })
    expect(mocks.list).toHaveBeenCalledWith(20)
  })

  it.each(['0', '-1', '101', '1.5', 'abc', '', 'Infinity', '9007199254740992'])(
    'rejects invalid list limit %s before fetching', async value => {
      expect((await list(request(`?limit=${value}`))).status).toBe(400)
      expect(mocks.list).not.toHaveBeenCalled()
    },
  )

  it('hydrates the latest summary to include passage text and attribution', async () => {
    mocks.latest.mockResolvedValue({ ...reading, passageText: '' })
    const response = await latest()
    expect(mocks.detail).toHaveBeenCalledWith(42)
    const body = await response.json()
    expect(body.reading).toMatchObject({
      id: 42, passageVerses: [{ number: 10, text: 'Be still, and know that I am God.' }],
      bibleCopyright: reading.bibleCopyright,
      apiBibleFumsTokens: ['first-token', 'second-token'],
    })
    expect(body.reading).not.toHaveProperty('rockGuid')
    expect(body.reading).not.toHaveProperty('importedAt')
    expect(body.reading).not.toHaveProperty('passageText')
  })

  it('fetches an individual reading by its public ID', async () => {
    const response = await readDetail('42')
    expect(mocks.detail).toHaveBeenCalledWith(42)
    expect((await response.json()).reading.passageVerses).toEqual([
      { number: 10, text: 'Be still, and know that I am God.' },
    ])
  })

  it.each(['0', '-2', '1.5', 'unknown', '9007199254740992'])(
    'rejects invalid reading ID %s before fetching', async id => {
      expect((await readDetail(id)).status).toBe(400)
      expect(mocks.detail).not.toHaveBeenCalled()
    },
  )

  it('returns 404 for missing or unpublished readings', async () => {
    mocks.latest.mockResolvedValue(null)
    mocks.detail.mockResolvedValue(null)
    expect((await latest()).status).toBe(404)
    expect((await readDetail('42')).status).toBe(404)
  })

  it('returns CORS-enabled JSON errors without leaking backend details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mocks.list.mockRejectedValue(new Error('private database connection'))
      mocks.latest.mockRejectedValue(new Error('private database connection'))
      mocks.detail.mockRejectedValue(new Error('private database connection'))
      for (const response of [await list(request()), await latest(), await readDetail('42')]) {
        expect(response.status).toBe(503)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
        expect(await response.json()).toEqual({ error: 'Daily readings are temporarily unavailable.' })
      }
    } finally {
      log.mockRestore()
    }
  })

  it('supports browser preflight without authentication', () => {
    const response = OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
  })
})
