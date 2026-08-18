'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { HiPencilSquare, HiTrash } from 'react-icons/hi2'

import { parseCommentRichText, type CommentRichTextRun } from '@/lib/members/comment-rich-text'
import type { MemberGroupComment } from '@/lib/members/data'
import { ConnectGroupCommentComposer } from './ConnectGroupCommentComposer'
import { MemberAvatar } from './MemberAvatar'

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`
  const years = Math.floor(days / 365)
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}

function RichRun({ run }: { run: CommentRichTextRun }) {
  let content: ReactNode = run.text
  if (run.href) content = <a href={run.href} target="_blank" rel="nofollow noreferrer" className="font-semibold text-rich-red underline">{content}</a>
  if (run.italic) content = <em>{content}</em>
  if (run.bold) content = <strong>{content}</strong>
  return content
}

function RichCommentBody({ body }: { body: string }) {
  const document = parseCommentRichText(body)
  if (!document) return <p className="whitespace-pre-wrap text-sm leading-relaxed text-dark-grey">{body}</p>
  const content: ReactNode[] = []
  for (let index = 0; index < document.blocks.length;) {
    const block = document.blocks[index]
    if (block?.type === 'bullet') {
      const items: ReactNode[] = []
      while (document.blocks[index]?.type === 'bullet') {
        const item = document.blocks[index]
        items.push(<li key={`item-${index}`}>{item?.children.map((run, runIndex) => <RichRun key={runIndex} run={run} />)}</li>)
        index += 1
      }
      content.push(<ul key={`list-${index}`} className="list-disc space-y-1 pl-5">{items}</ul>)
      continue
    }
    content.push(<p key={`block-${index}`}>{block?.children.map((run, runIndex) => <RichRun key={runIndex} run={run} />)}</p>)
    index += 1
  }
  return <div className="space-y-2 text-sm leading-relaxed text-dark-grey">{content}</div>
}

export function ConnectGroupCommentItem({
  comment,
  currentAuthor,
  updateAction,
  deleteAction,
}: {
  comment: MemberGroupComment
  currentAuthor: { name: string; avatarUrl: string | null }
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (editing) {
    return (
      <ConnectGroupCommentComposer
        action={updateAction}
        author={currentAuthor}
        canPostCoachesOnly={false}
        initialBody={comment.body}
        fixedCoachesOnly={comment.coachesOnly}
        onCancel={() => setEditing(false)}
        variant="edit"
      />
    )
  }

  return (
    <article className={`overflow-hidden rounded-xl border ${comment.coachesOnly ? 'border-amber-200 bg-amber-50' : 'border-warm-grey bg-white'}`}>
      <header className={`flex h-13 items-center border-b pl-4 ${comment.coachesOnly ? 'border-amber-200' : 'border-warm-grey'}`}>
        <MemberAvatar name={comment.authorName} src={comment.avatarUrl} size="xsmall" />
        <div className="flex h-full min-w-0 flex-1 flex-wrap content-center items-center gap-x-2 gap-y-1 px-2.5 py-2 text-xs leading-none">
          <strong className="text-brand-black">{comment.authorName}</strong>
          <time className="basis-full text-mid-grey sm:basis-auto" dateTime={comment.createdAt} title={comment.createdAt ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.createdAt)) : undefined}>{relativeTime(comment.createdAt)}{comment.edited ? ' (edited)' : ''}</time>
        </div>
        <div className="flex self-stretch items-stretch">
          {comment.canEdit && <button type="button" onClick={() => setEditing(true)} aria-label="Edit comment" title="Edit comment" className="flex w-10 items-center justify-center border-l border-warm-grey bg-warm-white text-mid-grey transition-colors hover:bg-white hover:text-rich-red"><HiPencilSquare aria-hidden="true" className="h-4 w-4" /></button>}
          {comment.canDelete && <button type="button" onClick={() => setConfirmingDelete(true)} aria-label="Delete comment" title="Delete comment" className="flex w-10 items-center justify-center border-l border-warm-grey bg-warm-white text-mid-grey transition-colors hover:bg-white hover:text-rich-red"><HiTrash aria-hidden="true" className="h-4 w-4" /></button>}
        </div>
      </header>
      <div className="px-4 py-4"><RichCommentBody body={comment.body} /></div>
      {confirmingDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-brand-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingDelete(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`delete-comment-${comment.id}`} className="w-full max-w-md rounded-2xl bg-warm-white p-6 shadow-2xl sm:p-8">
            <h2 id={`delete-comment-${comment.id}`} className="text-2xl text-brand-black">Delete this comment?</h2>
            <p className="mt-3 text-sm leading-relaxed text-dark-grey">The comment text will be removed. A small record showing who deleted it will remain in the thread.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} autoFocus className="min-h-11 rounded-lg px-4 text-sm font-bold text-mid-grey hover:text-brand-black">Cancel</button>
              <form action={deleteAction}>
                <button type="submit" className="min-h-11 rounded-lg bg-rich-red px-5 text-sm font-bold text-white hover:bg-brand-black">Delete comment</button>
              </form>
            </div>
          </section>
        </div>
      )}
    </article>
  )
}
