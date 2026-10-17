import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { access } from 'node:fs/promises'
import path from 'node:path'
import Markdown from 'react-markdown'
import { helpArticles } from '../../../content/help/articles'
import { listHelpArticles, searchHelpArticles } from './content'

const auth = vi.hoisted(() => ({ member: vi.fn() }))
vi.mock('@/auth/member-session', () => ({ getCurrentMemberProfile: auth.member }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
}))
import { canReadMemberHelp } from './access'
import HelpArticlePage, { generateMetadata } from '@/app/(frontend)/help/[slug]/page'
import { metadata } from '@/app/(frontend)/help/layout'

const originalLength = helpArticles.length
afterEach(() => { helpArticles.splice(originalLength); auth.member.mockReset() })

describe('help content and access', () => {
  it('loads all three guides with unique URLs and valid help links and images', async () => {
    const articles = await listHelpArticles(false)
    expect(new Set(articles.map(article => article.slug)).size).toBe(3)
    expect(articles.map(article => article.audience)).toEqual(['Claimants', 'Purpose approvers', 'Finance'])
    for (const article of articles) {
      expect(article.body).toContain('## ')
      const links = [...article.body.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1])
      for (const link of links) expect(['/reimbursement', '/contact', ...helpArticles.map(item => `/help/${item.slug}`)]).toContain(link)
      const images = [...article.body.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1])
      expect(images).toHaveLength(1)
      for (const image of images) {
        expect(image).toMatch(/^\/images\/help\/[a-z-]+\.png$/)
        await expect(access(path.join(process.cwd(), 'public', image))).resolves.toBeUndefined()
      }
    }
  })
  it('searches full article text and combines topic and audience filters', async () => {
    const articles = await listHelpArticles(false)
    expect(searchHelpArticles(articles, 'CAMERA').map(article => article.slug)).toEqual(['claim-an-expense'])
    expect(searchHelpArticles(articles, 'confirm payment', 'Reimbursements', 'Finance').map(article => article.slug)).toEqual(['finance-reimbursements'])
    expect(searchHelpArticles(articles, 'camera', '', 'Finance')).toEqual([])
    expect(searchHelpArticles(articles, 'no-such-answer')).toEqual([])
  })
  it('does not read or expose restricted content in public search or metadata', async () => {
    helpArticles.push({ slug: 'internal-only', title: 'Private operational detail', description: 'Private description', audience: 'Finance', topic: 'Internal', access: 'members' })
    const publicArticles = await listHelpArticles(false)
    expect(searchHelpArticles(publicArticles, 'private')).toEqual([])
    expect(publicArticles.some(article => article.slug === 'internal-only')).toBe(false)
    expect(await generateMetadata({ params: Promise.resolve({ slug: 'internal-only' }) })).toEqual({ title: 'Help' })
    auth.member.mockResolvedValue(null)
    await expect(HelpArticlePage({ params: Promise.resolve({ slug: 'internal-only' }) })).rejects.toThrow('REDIRECT:/auth/login?returnTo=%2Fhelp%2Finternal-only')
    auth.member.mockResolvedValue({ personId: 1 })
    expect(await canReadMemberHelp()).toBe(true)
  })
  it('does not make authentication a dependency of public-only help', async () => {
    expect(await canReadMemberHelp()).toBe(false)
    expect(auth.member).not.toHaveBeenCalled()
  })
  it('returns not found for uncatalogued paths before reading any file', async () => {
    await expect(HelpArticlePage({ params: Promise.resolve({ slug: '../../AGENTS' }) })).rejects.toThrow('NOT_FOUND')
  })
  it('disables indexing and renders Markdown without executable HTML or URLs', () => {
    expect(metadata?.robots).toMatchObject({ index: false, follow: false, googleBot: { index: false, follow: false } })
    const html = renderToStaticMarkup(<Markdown skipHtml>{'<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n**Safe instructions**'}</Markdown>)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('<strong>Safe instructions</strong>')
  })
})
