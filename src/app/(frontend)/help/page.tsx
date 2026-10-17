import Link from 'next/link'
import { canReadMemberHelp } from '@/lib/help/access'
import { listHelpArticles, searchHelpArticles } from '@/lib/help/content'
import { HelpSupport } from '@/components/help/HelpSupport'

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string; audience?: string }> }) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.slice(0, 200) : ''
  const topic = typeof params.topic === 'string' ? params.topic : ''
  const audience = typeof params.audience === 'string' ? params.audience : ''
  const articles = await listHelpArticles(await canReadMemberHelp())
  const results = searchHelpArticles(articles, query, topic, audience)
  const topics = [...new Set(articles.map(article => article.topic))]
  const audiences = [...new Set(articles.map(article => article.audience))]
  const filtering = Boolean(query || topic || audience)
  return <>
    <div className="max-w-3xl"><p className="text-sm font-semibold text-rich-red">Ev Church help</p><h1 className="mt-3 text-4xl sm:text-5xl">How can we help?</h1><p className="mt-4 text-lg text-dark-grey">Find a guide, follow the steps, and get on with your day.</p></div>
    <form action="/help" role="search" className="mt-8 flex max-w-3xl gap-2">
      <label htmlFor="help-search" className="sr-only">Search help</label><input id="help-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder="Search expenses, receipts, approvals…" className="min-h-12 min-w-0 flex-1 rounded-lg border border-warm-grey bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-rich-red" />
      {topic && <input type="hidden" name="topic" value={topic} />}{audience && <input type="hidden" name="audience" value={audience} />}
      <button className="rounded-lg bg-rich-red px-5 py-3 font-bold text-white">Search</button>
    </form>
    {!filtering && <section className="mt-10"><h2 className="text-xl">Browse by topic</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{topics.map(item => <Link key={item} href={`/help?topic=${encodeURIComponent(item)}`} className="rounded-xl border border-warm-grey bg-white p-6 transition-colors hover:border-rich-red"><h3 className="text-xl">{item}</h3><p className="mt-2 text-sm text-dark-grey">{articles.filter(article => article.topic === item).length} guides <span aria-hidden="true">→</span></p></Link>)}</div></section>}
    <section className="mt-10" aria-labelledby="help-guides-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="help-guides-heading" className="text-xl">{filtering ? `${results.length} ${results.length === 1 ? 'guide' : 'guides'} found` : 'Guides'}</h2>{filtering && <Link className="text-sm font-semibold text-rich-red underline" href="/help">Clear filters</Link>}</div>
      <nav aria-label="Help audiences" className="mt-4 flex flex-wrap gap-2">{audiences.map(item => {
        const search = new URLSearchParams({ audience: item }); if (query) search.set('q', query); if (topic) search.set('topic', topic)
        return <Link key={item} href={`/help?${search}`} aria-current={audience === item ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${audience === item ? 'border-rich-red bg-rich-red text-white' : 'border-warm-grey bg-white hover:border-rich-red'}`}>{item}</Link>
      })}</nav>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.map(article => <Link key={article.slug} href={`/help/${article.slug}`} className="flex flex-col rounded-xl border border-warm-grey bg-white p-6 transition-colors hover:border-rich-red"><p className="text-xs font-bold text-rich-red">{article.audience}</p><h3 className="mt-3 text-xl">{article.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-dark-grey">{article.description}</p><span className="mt-5 text-sm font-semibold">Read guide <span aria-hidden="true">→</span></span></Link>)}</div>
      {!results.length && <div className="mt-5 rounded-xl border border-warm-grey bg-white p-8"><h3 className="text-lg">No guides found</h3><p className="mt-2 text-sm text-dark-grey">Try a different search or clear the filters. You can also contact us below.</p></div>}
    </section>
    <HelpSupport />
  </>
}
