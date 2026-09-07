'use client'
import { useEffect, useState } from 'react'
import type { ArticleBlock, ReviewQuestion } from '@/lib/sermon-articles/content'

interface Review { id: number; title: string; author: string; status: string; revision: string; blocks: ArticleBlock[]; questions: ReviewQuestion[] }
export function ArticleReview() {
  const [article, setArticle] = useState<Review | null>(null)
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('Loading your article…')
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    const token = window.location.hash.slice(1)
    setToken(token)
    fetch('/api/sermon-articles/review', { headers: { 'x-sermon-review': token } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setArticle(data); setMessage('') })
      .catch(() => setMessage('This review link is invalid or unavailable. Please use the link in your email.'))
  }, [])
  async function save(action: 'save' | 'publish') {
    if (!article) return
    setBusy(true)
    try {
      const response = await fetch('/api/sermon-articles/review', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sermon-review': token }, body: JSON.stringify({ action, revision: article.revision, blocks: article.blocks, resolvedQuestions: article.questions.filter((q) => q.resolved).map((q) => q.id) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setArticle(data)
      setMessage(action === 'publish' ? 'Your article is published.' : 'Your changes are saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save. Try again.') }
    finally { setBusy(false) }
  }
  function editBlock(index: number, value: string) {
    if (!article) return
    setArticle({ ...article, blocks: article.blocks.map((block, i) => i !== index ? block : block.type === 'scripture' ? { ...block, reference: value } : { ...block, text: value }) })
    setConfirmed(false)
  }
  return <main className="mx-auto max-w-3xl px-5 py-12 text-brand-black">
    <p className="text-sm font-semibold">Ev Church · Article review</p>
    <p role="status" className="my-4">{message}</p>
    {article && <>
      <h1 className="mb-2 text-4xl font-bold">{article.title}</h1><p className="mb-8">{article.author}</p>
      {article.status === 'published' ? <p>Your article has been published. Thank you for reviewing it.</p> : <>
        <p className="mb-4">Edit the article, check it against the sermon, and resolve the questions below. Approval publishes it immediately.</p>
        <audio controls preload="none" className="mb-8 w-full" src={`/api/sermon-articles/review?audio=${article.id}`} />
        <fieldset disabled={busy} className="space-y-6">
          {article.blocks.map((block, index) => <section key={index} className="rounded border border-warm-grey p-4">
            <label className="block text-sm font-semibold" htmlFor={`block-${index}`}>{block.type === 'scripture' ? 'Scripture reference (CSB)' : block.type === 'heading' ? 'Heading' : 'Paragraph'}</label>
            {block.type === 'scripture' ? <><input className="my-2 w-full border p-2" id={`block-${index}`} value={block.reference} onChange={(event) => editBlock(index, event.target.value)} /><blockquote className="whitespace-pre-wrap border-l-4 border-rich-red pl-4">{block.text}</blockquote><p className="mt-2 text-sm">Save to retrieve verified wording after changing a reference.</p><p className="mt-2 text-xs">{block.copyright}</p></> : <textarea className="mt-2 w-full border p-2" id={`block-${index}`} rows={block.type === 'heading' ? 2 : 6} value={block.text} onChange={(event) => editBlock(index, event.target.value)} />}
            <div className="mt-3 flex gap-4 text-sm"><button type="button" onClick={() => { setArticle({ ...article, blocks: article.blocks.filter((_, i) => i !== index) }); setConfirmed(false) }}>Remove block</button></div>
          </section>)}
          <div className="flex gap-4">{(['paragraph', 'heading', 'scripture'] as const).map((type) => <button key={type} type="button" className="rounded border px-3 py-2" onClick={() => { setArticle({ ...article, blocks: [...article.blocks, type === 'scripture' ? { type, reference: '', text: '', copyright: '', fumsToken: '' } : { type, text: '' }] }); setConfirmed(false) }}>Add {type}</button>)}</div>
          {!!article.questions.length && <section><h2 className="text-2xl font-bold">Questions to resolve</h2>{article.questions.map((question) => <label key={question.id} className="mt-4 flex gap-3"><input type="checkbox" checked={question.resolved} onChange={(event) => { setArticle({ ...article, questions: article.questions.map((q) => q.id === question.id ? { ...q, resolved: event.target.checked } : q) }); setConfirmed(false) }} /><span>{question.text}<span className="block text-sm">Check the audio and make any correction above, then mark resolved.</span></span></label>)}</section>}
          <button type="button" className="rounded border px-5 py-3" onClick={() => save('save')}>Save changes</button>
          <label className="flex gap-3"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I have checked the article, its meaning and Scripture references, and approve publication.</span></label>
          <button type="button" className="rounded bg-rich-red px-5 py-3 text-white disabled:opacity-40" disabled={!confirmed || article.questions.some((q) => !q.resolved)} onClick={() => save('publish')}>Approve and publish now</button>
        </fieldset>
      </>}
    </>}
  </main>
}
