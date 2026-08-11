const API_BIBLE_URL = 'https://rest.api.bible/v1'

export const API_BIBLE_CSB_ID = 'a556c5305ee15c3f-01'
export const API_BIBLE_CSB_ABBREVIATION = 'CSB'
export const API_BIBLE_CSB_TITLE = 'Christian Standard Bible'

export interface ApiBiblePassage {
  id: string
  reference: string
  content: string
  copyright: string
  fumsToken: string
}

interface ApiBiblePassageResponse {
  data?: Partial<Omit<ApiBiblePassage, 'fumsToken'>>
  meta?: { fumsToken?: string }
}

const BOOK_USFM: Record<string, string> = {
  genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
  joshua: 'JOS', judges: 'JDG', ruth: 'RUT', '1 samuel': '1SA', '2 samuel': '2SA',
  '1 kings': '1KI', '2 kings': '2KI', '1 chronicles': '1CH', '2 chronicles': '2CH',
  ezra: 'EZR', nehemiah: 'NEH', esther: 'EST', job: 'JOB', psalm: 'PSA', psalms: 'PSA',
  proverbs: 'PRO', ecclesiastes: 'ECC', 'song of solomon': 'SNG', 'song of songs': 'SNG',
  isaiah: 'ISA', jeremiah: 'JER', lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN',
  hosea: 'HOS', joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC',
  nahum: 'NAM', habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG', zechariah: 'ZEC',
  malachi: 'MAL', matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT',
  romans: 'ROM', '1 corinthians': '1CO', '2 corinthians': '2CO', galatians: 'GAL',
  ephesians: 'EPH', philippians: 'PHP', colossians: 'COL', '1 thessalonians': '1TH',
  '2 thessalonians': '2TH', '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT',
  philemon: 'PHM', hebrews: 'HEB', james: 'JAS', '1 peter': '1PE', '2 peter': '2PE',
  '1 john': '1JN', '2 john': '2JN', '3 john': '3JN', jude: 'JUD', revelation: 'REV',
}

const SINGLE_CHAPTER_BOOKS = new Set(['OBA', 'PHM', '2JN', '3JN', 'JUD'])

export function toApiBiblePassageId(reference: string): string {
  const normalized = reference
    .replace(/[–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
  const match = normalized.match(/^(.+?)\s+(\d+)(?::(\d+))?(?:-(?:(\d+):)?(\d+))?$/u)
  if (!match) throw new Error(`Unsupported Bible passage reference: ${reference}`)

  const [, bookName, startChapter, startVerse, explicitEndChapter, finalNumber] = match
  const book = BOOK_USFM[bookName.toLocaleLowerCase('en-NZ')]
  if (!book) throw new Error(`Unsupported Bible book: ${bookName}`)

  if (!startVerse && SINGLE_CHAPTER_BOOKS.has(book)) {
    const start = `${book}.1.${startChapter}`
    return finalNumber ? `${start}-${book}.1.${finalNumber}` : start
  }
  if (!startVerse && finalNumber) return `${book}.${startChapter}-${book}.${finalNumber}`
  if (!startVerse) return `${book}.${startChapter}`

  const start = `${book}.${startChapter}.${startVerse}`
  if (!finalNumber) return start
  const endChapter = explicitEndChapter ?? startChapter
  return `${start}-${book}.${endChapter}.${finalNumber}`
}

function resourceForPassageId(passageId: string): 'chapters' | 'passages' | 'verses' {
  if (passageId.includes('-')) return 'passages'
  return passageId.split('.').length === 3 ? 'verses' : 'chapters'
}

function normalizeApiBibleContent(value: string): string {
  return value
    .replace(/#([—–-])[\s\u00a0]*#/gu, '$1 ')
    .replace(/\u00a0/gu, ' ')
    .replace(/\r\n/gu, '\n')
    .trim()
}

export async function fetchApiBibleCSBPassage(
  reference: string,
  options: { apiKey?: string; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<ApiBiblePassage> {
  const references = reference.split(';').map((part) => part.trim()).filter(Boolean)
  if (references.length === 0) throw new Error('A Bible passage reference is required')

  const passages: ApiBiblePassage[] = []
  for (const passageReference of references) {
    passages.push(await fetchSingleApiBibleCSBPassage(passageReference, options))
  }
  if (passages.length === 1) return passages[0]

  return {
    id: passages.map(({ id }) => id).join(';'),
    reference: passages.map(({ reference: value }) => value).join('; '),
    content: passages.map(({ content }) => content).join('\n\n'),
    copyright: [...new Set(passages.map(({ copyright }) => copyright))].join('\n\n'),
    fumsToken: passages.map(({ fumsToken }) => fumsToken).join('\n'),
  }
}

async function fetchSingleApiBibleCSBPassage(
  reference: string,
  options: { apiKey?: string; fetcher?: typeof fetch; timeoutMs?: number },
): Promise<ApiBiblePassage> {
  const apiKey = options.apiKey ?? process.env.API_BIBLE_KEY
  if (!apiKey) throw new Error('API_BIBLE_KEY is required to import CSB passage text from API.Bible')

  const passageId = toApiBiblePassageId(reference)
  const resource = resourceForPassageId(passageId)
  const url = new URL(
    `${API_BIBLE_URL}/bibles/${API_BIBLE_CSB_ID}/${resource}/${encodeURIComponent(passageId)}`,
  )
  url.searchParams.set('content-type', 'text')
  url.searchParams.set('include-notes', 'false')
  url.searchParams.set('include-titles', 'false')
  url.searchParams.set('include-chapter-numbers', 'false')
  url.searchParams.set('include-verse-numbers', 'true')
  url.searchParams.set('include-verse-spans', 'false')
  url.searchParams.set('fums-version', '3')

  const response = await (options.fetcher ?? fetch)(url, {
    headers: { 'api-key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
  })
  if (!response.ok) throw new Error(`API.Bible passage request failed with status ${response.status}`)

  const body = await response.json() as ApiBiblePassageResponse
  const content = body.data?.content ? normalizeApiBibleContent(body.data.content) : undefined
  const copyright = body.data?.copyright?.trim()
  const fumsToken = body.meta?.fumsToken?.trim()
  if (!body.data?.id || !body.data.reference || !content || !copyright || !fumsToken) {
    throw new Error('API.Bible returned an incomplete CSB passage')
  }
  return {
    id: body.data.id,
    reference: body.data.reference,
    content,
    copyright,
    fumsToken,
  }
}
