import { HiCheckCircle, HiExclamationCircle, HiTrash } from 'react-icons/hi2'

import type { MemberGroupCommentThread } from '@/lib/members/data'
import { ConnectGroupCommentComposer } from './ConnectGroupCommentComposer'
import { ConnectGroupCommentItem } from './ConnectGroupCommentItem'

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

export function ConnectGroupComments({
  thread,
  action,
  updateAction,
  deleteAction,
  status,
}: {
  thread: Extract<MemberGroupCommentThread, { access: 'granted' }>
  action: (formData: FormData) => Promise<void>
  updateAction: (commentId: number | string, formData: FormData) => Promise<void>
  deleteAction: (commentId: number | string) => Promise<void>
  status?: 'added' | 'updated' | 'deleted' | 'error'
}) {
  const statusMessage = status === 'added'
    ? 'Comment added successfully.'
    : status === 'updated'
      ? 'Comment updated successfully.'
      : status === 'deleted'
        ? 'Comment deleted.'
        : status === 'error'
          ? 'The comment change could not be saved. Try again.'
          : null

  return (
    <section className="mt-10" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-3xl text-brand-black">Comments</h2>
      {statusMessage && (
        <div role={status === 'error' ? 'alert' : 'status'} className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold text-brand-black ${status === 'error' ? 'border-rich-red/30 bg-light-red' : 'border-newish-green/30 bg-newish-green/10'}`}>
          {status === 'error'
            ? <HiExclamationCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-rich-red" />
            : <HiCheckCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-newish-green" />}
          <p>{statusMessage}</p>
        </div>
      )}
      <div className="mt-6 space-y-4">
        {thread.comments.length === 0 && <p className="rounded-xl border border-warm-grey bg-warm-white p-5 text-sm text-mid-grey">No comments yet.</p>}
        {thread.comments.map((comment) => comment.deletedAt ? (
          <div key={comment.id} className="flex items-center gap-2 px-1 py-1 text-xs text-mid-grey">
            <HiTrash aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span><strong className="font-semibold text-dark-grey">{comment.deletedByName ?? comment.authorName}</strong> deleted a comment · <time dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time></span>
          </div>
        ) : (
          <ConnectGroupCommentItem
            key={comment.id}
            comment={comment}
            currentAuthor={thread.currentAuthor}
            updateAction={updateAction.bind(null, comment.id)}
            deleteAction={deleteAction.bind(null, comment.id)}
          />
        ))}
      </div>
      <ConnectGroupCommentComposer action={action} author={thread.currentAuthor} canPostCoachesOnly={thread.canPostCoachesOnly} />
    </section>
  )
}
