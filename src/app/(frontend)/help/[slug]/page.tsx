import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Markdown from 'react-markdown'
import { helpArticles } from '../../../../../content/help/articles'
import { canReadMemberHelp } from '@/lib/help/access'
import { readHelpArticle } from '@/lib/help/content'
import { HelpSupport } from '@/components/help/HelpSupport'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = helpArticles.find(article => article.slug === slug)
  return article?.access === 'public' ? { title: article.title, description: article.description } : { title: 'Help' }
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const definition = helpArticles.find(article => article.slug === slug)
  if (!definition) notFound()
  if (definition.access === 'members' && !await canReadMemberHelp()) redirect(`/auth/login?returnTo=${encodeURIComponent(`/help/${definition.slug}`)}`)
  const article = await readHelpArticle(definition)
  return <>
    <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap gap-2 text-sm"><Link className="text-rich-red underline" href="/help">Help</Link><span aria-hidden="true">/</span><Link className="text-rich-red underline" href={`/help?topic=${encodeURIComponent(article.topic)}`}>{article.topic}</Link><span aria-hidden="true">/</span><span>{article.audience}</span></nav>
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <article className="min-w-0 max-w-3xl"><p className="text-sm font-semibold text-rich-red">{article.audience}</p><h1 className="mt-3 text-3xl sm:text-4xl">{article.title}</h1><p className="mt-4 text-lg leading-7 text-dark-grey">{article.description}</p>
        <div className="mt-8 text-base leading-7 [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-2xl [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2 [&_a]:font-semibold [&_a]:text-rich-red [&_a]:underline [&_a]:underline-offset-4 [&_img]:my-6 [&_img]:w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-warm-grey [&_blockquote]:border-l-4 [&_blockquote]:border-rich-red [&_blockquote]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-white [&_pre]:p-4">
          <Markdown skipHtml>{article.body}</Markdown>
        </div>
      </article>
      <aside className="self-start rounded-xl border border-warm-grey bg-white p-5 lg:sticky lg:top-8"><h2 className="font-semibold">In reimbursements</h2><nav aria-label="Related help" className="mt-4 flex flex-col gap-4 text-sm">{helpArticles.filter(item => item.topic === article.topic && item.access === 'public').map(item => <Link key={item.slug} aria-current={item.slug === slug ? 'page' : undefined} className={item.slug === slug ? 'font-semibold text-rich-red' : 'text-dark-grey hover:text-rich-red'} href={`/help/${item.slug}`}>{item.title}</Link>)}<Link className="border-t border-warm-grey pt-4 font-semibold text-rich-red" href="/reimbursement">Open reimbursements <span aria-hidden="true">→</span></Link></nav></aside>
    </div>
    <HelpSupport />
  </>
}
