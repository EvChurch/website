import { describe, expect, it, vi } from 'vitest'

import {
  API_BIBLE_CSB_ID,
  fetchApiBibleCSBPassage,
  toApiBiblePassageId,
} from './api-bible'

describe('toApiBiblePassageId', () => {
  it.each([
    ['Hebrews 5:11-14', 'HEB.5.11-HEB.5.14'],
    ['Hebrews 5:11-6:20', 'HEB.5.11-HEB.6.20'],
    ['Psalm 119:105', 'PSA.119.105'],
    ['1 Corinthians 13:1-13', '1CO.13.1-1CO.13.13'],
    ['John 3', 'JHN.3'],
    ['Jude 5-7', 'JUD.1.5-JUD.1.7'],
    ['Philemon 6', 'PHM.1.6'],
  ])('converts %s to %s', (reference, expected) => {
    expect(toApiBiblePassageId(reference)).toBe(expected)
  })
})

describe('fetchApiBibleCSBPassage', () => {
  it('requests CSB text, attribution, and a FUMS token with the API key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        id: 'HEB.5.11-HEB.5.14',
        bibleId: API_BIBLE_CSB_ID,
        reference: 'Hebrews 5:11-14',
        content: '11 We have a great deal #—\u00a0#to say about this.',
        copyright: 'Christian Standard Bible copyright notice',
      },
      meta: { fumsToken: 'fums-token' },
    }), { status: 200 }))

    await expect(fetchApiBibleCSBPassage('Hebrews 5:11-14', {
      apiKey: 'test-key', fetcher,
    })).resolves.toEqual({
      id: 'HEB.5.11-HEB.5.14',
      reference: 'Hebrews 5:11-14',
      content: '11 We have a great deal — to say about this.',
      copyright: 'Christian Standard Bible copyright notice',
      fumsToken: 'fums-token',
    })

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: `/v1/bibles/${API_BIBLE_CSB_ID}/passages/HEB.5.11-HEB.5.14`,
        searchParams: expect.any(URLSearchParams),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'api-key': 'test-key' }),
      }),
    )
    const requestedUrl = fetcher.mock.calls[0]?.[0] as URL
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      'content-type': 'text',
      'fums-version': '3',
      'include-notes': 'false',
      'include-titles': 'false',
    })
  })

  it.each([
    ['Psalm 119:105', '/verses/PSA.119.105'],
    ['John 3', '/chapters/JHN.3'],
  ])('selects the correct resource for %s', async (reference, suffix) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        id: toApiBiblePassageId(reference),
        reference,
        content: 'Passage text',
        copyright: 'Copyright notice',
      },
      meta: { fumsToken: 'fums-token' },
    }), { status: 200 }))

    await fetchApiBibleCSBPassage(reference, { apiKey: 'test-key', fetcher })

    expect((fetcher.mock.calls[0]?.[0] as URL).pathname).toBe(
      `/v1/bibles/${API_BIBLE_CSB_ID}${suffix}`,
    )
  })

  it('fetches and combines non-contiguous passage references', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: 'GEN.14.17-GEN.14.24',
          reference: 'Genesis 14:17-24',
          content: '17 Genesis passage.',
          copyright: 'Christian Standard Bible copyright notice',
        },
        meta: { fumsToken: 'genesis-token' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: 'HEB.7.1-HEB.7.10',
          reference: 'Hebrews 7:1-10',
          content: '1 Hebrews passage.',
          copyright: 'Christian Standard Bible copyright notice',
        },
        meta: { fumsToken: 'hebrews-token' },
      }), { status: 200 }))

    await expect(fetchApiBibleCSBPassage(
      'Genesis 14:17-24; Hebrews 7:1-10',
      { apiKey: 'test-key', fetcher },
    )).resolves.toEqual({
      id: 'GEN.14.17-GEN.14.24;HEB.7.1-HEB.7.10',
      reference: 'Genesis 14:17-24; Hebrews 7:1-10',
      content: '17 Genesis passage.\n\n1 Hebrews passage.',
      copyright: 'Christian Standard Bible copyright notice',
      fumsToken: 'genesis-token\nhebrews-token',
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('fails closed when no API key is configured', async () => {
    await expect(fetchApiBibleCSBPassage('John 3:16', { apiKey: '' }))
      .rejects.toThrow('API_BIBLE_KEY is required')
  })
})
