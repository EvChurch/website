'use client'

import { useMemo, useState } from 'react'
import { HiChevronDoubleLeft, HiChevronDoubleRight, HiChevronLeft, HiChevronRight, HiEllipsisVertical } from 'react-icons/hi2'

import { useGivingExperience } from '@/components/giving/GivingExperienceProvider'
import { formInputClass } from '@/components/forms/form-styles'
import type {
  CancellationFeedbackReason,
  MemberGiftHistoryPage,
  MemberGivingOverview,
  MemberRecurringGift,
} from '@/lib/members/giving'

const reasonOptions: Array<{ value: CancellationFeedbackReason; label: string }> = [
  { value: 'changing_details', label: "I'm changing the details of my giving" },
  { value: 'circumstances_changed', label: 'My circumstances have changed' },
  { value: 'mistake', label: 'I set this up by mistake' },
  { value: 'prefer_not_to_say', label: "I'd rather not say" },
  { value: 'other', label: 'Other' },
]

const currency = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
})

const date = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatAmount(amountMinor: number) {
  return currency.format(amountMinor / 100)
}

function transactionFeeLabel(transactionFeeMinor: number) {
  return transactionFeeMinor > 0 ? `Plus ${formatAmount(transactionFeeMinor)} transaction fee` : null
}

function TransactionFeeLine({ transactionFeeMinor, className = 'text-sm text-mid-grey' }: { transactionFeeMinor: number; className?: string }) {
  const label = transactionFeeLabel(transactionFeeMinor)
  return label ? <p className={className}>{label}</p> : null
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled yet'
  return date.format(new Date(value))
}

function frequencyLabel(value: string) {
  return value === 'one-off'
    ? 'One-off'
    : value.charAt(0).toUpperCase() + value.slice(1)
}

function pageWindow(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 1, totalPages - 2))
  const end = Math.min(totalPages, start + 2)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function StartGivingButton({ label = 'Start giving' }: { label?: string }) {
  const { givingSurfaceAvailable, openGiving } = useGivingExperience()
  return (
    <button
      type="button"
      disabled={!givingSurfaceAvailable}
      onClick={() => openGiving()}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-rich-red px-5 text-sm font-bold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function RecurringGiftCard({
  gift,
  menuOpen,
  cancelling,
  onToggle,
  onCancel,
}: {
  gift: MemberRecurringGift
  menuOpen: boolean
  cancelling: boolean
  onToggle: () => void
  onCancel: () => void
}) {
  return (
    <article className="relative rounded-xl border border-warm-grey bg-white p-5 pr-16 shadow-sm shadow-brand-black/5">
      <div>
        <h3 className="text-2xl font-bold leading-tight text-brand-black">{formatAmount(gift.amountMinor)}</h3>
        <p className="mt-1 text-sm text-mid-grey">
          {frequencyLabel(gift.frequency)} to {gift.fundName}
        </p>
        <TransactionFeeLine transactionFeeMinor={gift.transactionFeeMinor} className="mt-1 text-sm text-mid-grey" />
        <p className="mt-3 text-sm font-semibold text-brand-black">Next gift: {formatDate(gift.nextPaymentDate)}</p>
      </div>
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-grey text-brand-black transition hover:border-rich-red hover:text-rich-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
          aria-label="Recurring gift options"
          aria-expanded={menuOpen}
        >
          <HiEllipsisVertical aria-hidden="true" className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-12 z-10 w-56 rounded-lg border border-warm-grey bg-white p-2 shadow-xl shadow-brand-black/10">
            <button
              type="button"
              disabled={cancelling}
              onClick={onCancel}
              className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-bold text-rich-red transition hover:bg-warm-grey/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red disabled:cursor-wait disabled:opacity-60"
            >
              {cancelling ? 'Stopping' : 'Stop recurring gift'}
            </button>
          </div>
        )}
      </div>
      {menuOpen && (
        <button
          type="button"
          aria-label="Close recurring gift options"
          className="fixed inset-0 z-0 cursor-default"
          onClick={onToggle}
          tabIndex={-1}
        />
      )}
    </article>
  )
}

function Pagination({
  page,
  totalPages,
  loading,
  onPage,
}: {
  page: number
  totalPages: number
  loading: boolean
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const buttonClass = 'flex h-10 w-10 items-center justify-center rounded-full border border-warm-grey text-sm font-bold text-brand-black transition hover:border-rich-red hover:text-rich-red disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <nav aria-label="Gift history pages" className="mt-6 flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} disabled={loading || page === 1} onClick={() => onPage(1)} aria-label="First page">
        <HiChevronDoubleLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      <button type="button" className={buttonClass} disabled={loading || page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <HiChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      {pageWindow(page, totalPages).map((item) => (
        <button
          key={item}
          type="button"
          className={`${buttonClass} ${item === page ? 'border-rich-red bg-rich-red text-white hover:text-white' : ''}`}
          disabled={loading}
          onClick={() => onPage(item)}
          aria-current={item === page ? 'page' : undefined}
        >
          {item}
        </button>
      ))}
      <button type="button" className={buttonClass} disabled={loading || page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <HiChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
      <button type="button" className={buttonClass} disabled={loading || page >= totalPages} onClick={() => onPage(totalPages)} aria-label="Last page">
        <HiChevronDoubleRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </nav>
  )
}

function FeedbackStep({
  operationId,
  onClose,
}: {
  operationId: number
  onClose: (openLauncher: boolean) => void
}) {
  const [reason, setReason] = useState<CancellationFeedbackReason>('changing_details')
  const [note, setNote] = useState('')
  const otherInvalid = reason === 'other' && note.trim().length === 0

  function submit(openLauncher: boolean) {
    if (otherInvalid) return
    onClose(openLauncher)
    fetch('/api/member/giving/cancellation-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId, reason, note: note.trim() || undefined }),
    }).catch(() => undefined)
  }

  return (
    <>
      <h2 id="cancelled-giving-title" className="text-2xl leading-tight text-brand-black">Recurring gift cancelled</h2>
      <fieldset className="mt-5 space-y-3">
        <legend className="text-sm font-bold text-brand-black">What changed?</legend>
        {reasonOptions.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-3 text-sm text-dark-grey">
            <input
              type="radio"
              name="cancellation-reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
              className="mt-0.5 size-4 accent-rich-red"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {reason === 'other' && (
        <textarea
          className={`${formInputClass} mt-4 resize-y`}
          maxLength={500}
          rows={4}
          required
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      )}
      {reason === 'changing_details' ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" disabled={otherInvalid} onClick={() => submit(true)} className="min-h-11 rounded-full bg-rich-red px-5 text-sm font-bold text-white transition hover:bg-deep-red disabled:opacity-50">Set up new giving</button>
          <button type="button" disabled={otherInvalid} onClick={() => submit(false)} className="min-h-11 rounded-full border border-warm-grey px-5 text-sm font-bold text-brand-black transition hover:border-rich-red hover:text-rich-red disabled:opacity-50">I&apos;ve already done this</button>
        </div>
      ) : (
        <button type="button" disabled={otherInvalid} onClick={() => submit(false)} className="mt-5 min-h-11 rounded-full bg-rich-red px-5 text-sm font-bold text-white transition hover:bg-deep-red disabled:opacity-50">Done</button>
      )}
    </>
  )
}

export function MemberGiving({ initialOverview }: { initialOverview: MemberGivingOverview }) {
  const { openGiving } = useGivingExperience()
  const [recurringGifts, setRecurringGifts] = useState(initialOverview.recurringGifts)
  const [recentActivity, setRecentActivity] = useState(initialOverview.recentActivity)
  const [history, setHistory] = useState(initialOverview.giftHistory)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [confirming, setConfirming] = useState<MemberRecurringGift | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [cancelError, setCancelError] = useState(false)
  const [feedbackOperationId, setFeedbackOperationId] = useState<number | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const hasAnyGiving = recurringGifts.length > 0 || recentActivity.length > 0 || history.gifts.length > 0
  const showHistory = history.gifts.length > 0

  const emptyMessage = useMemo(() => {
    if (hasAnyGiving) return null
    return (
      <section className="rounded-xl border border-warm-grey bg-white p-8 text-center shadow-sm shadow-brand-black/5">
        <h2 className="text-3xl leading-tight text-brand-black">You don&apos;t have any online giving history yet</h2>
        <div className="mt-6"><StartGivingButton /></div>
      </section>
    )
  }, [hasAnyGiving])

  async function loadPage(page: number) {
    if (page === history.page || historyLoading) return
    setHistoryLoading(true)
    setHistoryError(false)
    try {
      const response = await fetch(`/api/member/giving/history?page=${page}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('history unavailable')
      setHistory(await response.json() as MemberGiftHistoryPage)
    } catch {
      setHistoryError(true)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function cancelGift(gift: MemberRecurringGift) {
    setCancellingId(gift.id)
    setCancelError(false)
    try {
      const response = await fetch(`/api/member/giving/schedules/${gift.id}/cancel`, { method: 'POST' })
      if (!response.ok && response.status !== 202) throw new Error('cancel failed')
      const result = await response.json() as { status: 'cancelled' | 'unknown'; operationId?: number }
      setRecurringGifts((current) => current.filter((item) => item.id !== gift.id))
      setOpenMenuId(null)
      setConfirming(null)
      if (result.status === 'unknown') {
        setRecentActivity((current) => [{
          id: `schedule:${gift.id}`,
          label: 'Cancelling' as const,
          amountMinor: gift.amountMinor,
          frequency: gift.frequency,
          fundName: gift.fundName,
          happenedAt: new Date().toISOString(),
        }, ...current].slice(0, 3))
      } else if (result.operationId) {
        setFeedbackOperationId(result.operationId)
      }
    } catch {
      setCancelError(true)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-4xl leading-tight text-brand-black sm:text-5xl">Giving</h1>
      </header>

      <div className="space-y-8">
        {emptyMessage}

        {hasAnyGiving && (
          <>
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-3xl leading-tight text-brand-black">Recurring gifts</h2>
                <StartGivingButton label="Start new gift" />
              </div>
              {recurringGifts.length > 0 ? (
                <div className="grid gap-4">
                  {recurringGifts.map((gift) => (
                    <RecurringGiftCard
                      key={gift.id}
                      gift={gift}
                      menuOpen={openMenuId === gift.id}
                      cancelling={cancellingId === gift.id}
                      onToggle={() => setOpenMenuId((current) => current === gift.id ? null : gift.id)}
                      onCancel={() => {
                        setCancelError(false)
                        setOpenMenuId(null)
                        setConfirming(gift)
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-warm-grey bg-white p-5 shadow-sm shadow-brand-black/5">
                  <p className="font-semibold text-brand-black">No active recurring gifts</p>
                </div>
              )}
            </section>

            {recentActivity.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl leading-tight text-brand-black">Recent activity</h2>
                <div className="divide-y divide-warm-grey rounded-xl border border-warm-grey bg-white shadow-sm shadow-brand-black/5">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-brand-black">{item.label}</p>
                        <p className="text-sm text-mid-grey">{frequencyLabel(item.frequency)} to {item.fundName}</p>
                      </div>
                      <p className="text-sm font-bold text-brand-black">{formatAmount(item.amountMinor)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showHistory && (
              <section>
                <h2 className="mb-4 text-2xl leading-tight text-brand-black">Gift history</h2>
                <div className="divide-y divide-warm-grey rounded-xl border border-warm-grey bg-white shadow-sm shadow-brand-black/5">
                  {history.gifts.map((gift) => (
                    <div key={gift.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="font-bold text-brand-black">{formatDate(gift.completedAt)}</p>
                        <p className="text-sm text-mid-grey">{frequencyLabel(gift.giftType)} to {gift.fundName}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-base font-bold text-brand-black">{formatAmount(gift.amountMinor)}</p>
                        <TransactionFeeLine transactionFeeMinor={gift.transactionFeeMinor} />
                      </div>
                    </div>
                  ))}
                </div>
                {historyError && <p className="mt-3 text-sm font-semibold text-rich-red">Couldn&apos;t load more gifts. Try again.</p>}
                <Pagination page={history.page} totalPages={history.totalPages} loading={historyLoading} onPage={(page) => void loadPage(page)} />
              </section>
            )}
          </>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/50 px-5">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-giving-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="cancel-giving-title" className="text-2xl leading-tight text-brand-black">Stop recurring gift?</h2>
            <p className="mt-3 text-sm leading-relaxed text-mid-grey">
              This will stop your {frequencyLabel(confirming.frequency).toLowerCase()} gift of {formatAmount(confirming.amountMinor)} to {confirming.fundName}.
              {confirming.transactionFeeMinor > 0 ? ` ${transactionFeeLabel(confirming.transactionFeeMinor)}.` : ''}
            </p>
            {cancelError && <p className="mt-3 text-sm font-semibold text-rich-red">Couldn&apos;t cancel this recurring gift. Try again.</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled={cancellingId === confirming.id} onClick={() => void cancelGift(confirming)} className="min-h-11 rounded-full bg-rich-red px-5 text-sm font-bold text-white transition hover:bg-deep-red disabled:cursor-wait disabled:opacity-60">Stop recurring gift</button>
              <button type="button" disabled={cancellingId === confirming.id} onClick={() => { setCancelError(false); setConfirming(null) }} className="min-h-11 rounded-full border border-warm-grey px-5 text-sm font-bold text-brand-black transition hover:border-rich-red hover:text-rich-red disabled:opacity-60">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {feedbackOperationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/50 px-5">
          <div role="dialog" aria-modal="true" aria-labelledby="cancelled-giving-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <FeedbackStep
              operationId={feedbackOperationId}
              onClose={(openLauncher) => {
                setFeedbackOperationId(null)
                if (openLauncher) openGiving()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
