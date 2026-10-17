'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HiArchiveBoxArrowDown, HiArrowUturnLeft, HiArrowUpTray, HiEllipsisVertical, HiEye, HiPlus, HiTrash, HiXMark } from 'react-icons/hi2'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { reimbursementReportPath, reimbursementViewPaths, type ReimbursementView } from '@/lib/reimbursements/paths'
import { FormSelect } from '@/components/forms/FormSelect'
import type { overview } from '@/lib/reimbursements/store'
import { actionLabels, canArchiveReport, isArchivedReport, isOlderReport, approvalPerson, hasPaymentSettings, gstMinor, money, parseMoney, reportNumber, statusLabels, type Draft, type ExpenseLine, type Settings } from '@/lib/reimbursements/model'

type Overview = Awaited<ReturnType<typeof overview>>
type VisibleReport = Overview['reports'][number]
const pathwayOrder: Record<VisibleReport['status'], number> = { draft: 0, rejected: 1, 'rc-approval': 2, 'finance-approval': 3, 'awaiting-payment': 4, paid: 5, cancelled: 6 }
const inputClass = 'mt-1 w-full rounded-md border border-warm-grey bg-white px-2 py-2 text-base text-brand-black focus:outline-none focus:ring-2 focus:ring-rich-red'
const expenseCellClass = 'block min-h-12 w-full min-w-0 rounded-lg border border-warm-grey bg-white px-3 py-3 text-base leading-7 text-brand-black focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red disabled:bg-warm-white lg:min-h-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-2 lg:py-1 lg:text-sm lg:leading-6 lg:hover:bg-warm-white lg:focus:bg-warm-white lg:disabled:bg-transparent'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-full bg-rich-red px-5 py-2 text-sm font-bold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 disabled:opacity-50'
const secondaryClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-warm-grey bg-white px-5 py-2 text-sm font-bold text-brand-black transition hover:border-rich-red hover:text-rich-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red disabled:opacity-50'
export async function reimbursementRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/reimbursements${path}`, {
    method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to save. Please try again.')
  return result as T
}
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function newLine(): ExpenseLine { return { id: crypto.randomUUID(), date: dateToday(), categoryId: null, description: '', amountMinor: null, hasGst: true, receiptHash: null } }

function ArchiveIcon({ older }: { older: boolean }) {
  const Icon = older ? HiArrowUturnLeft : HiArchiveBoxArrowDown
  return <Icon aria-hidden="true" className="size-4" />
}

function ReportCard({ report, showClaimant, archivable, older, busy, payment, checked, onSelect, onView, onArchive }: {
  report: VisibleReport; showClaimant: boolean; archivable: boolean; older: boolean; busy: boolean; payment: boolean; checked: boolean
  onSelect: (checked: boolean) => void; onView: () => void; onArchive: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    menu.current?.querySelector('button')?.focus()
    function closeOutside(event: PointerEvent) { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setMenuOpen(false) }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') { setMenuOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [menuOpen])
  const number = reportNumber(report.number)
  const rejection = report.status === 'rejected' ? [...report.history].reverse().find(item => ['reject', 'return'].includes(item.action))?.reason : undefined
  const optionClass = 'flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-bold text-brand-black hover:bg-warm-grey/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red disabled:opacity-50'
  return <article aria-label={number} className="relative rounded-xl border border-warm-grey bg-white p-5 pr-16 shadow-sm shadow-brand-black/5">
    <h3 className="text-2xl font-bold leading-tight text-brand-black">{money(report.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0))}</h3>
    <div className="mt-2 flex items-center gap-2">{payment && <input type="checkbox" aria-label={`Select ${number}`} className="size-5 accent-rich-red" disabled={busy} checked={checked} onChange={event => onSelect(event.target.checked)} />}<button className="min-h-11 text-left text-sm font-semibold text-rich-red underline underline-offset-4" onClick={onView}>{number}</button></div>
    {showClaimant && <p className="break-words text-sm font-semibold">{report.claimantName}</p>}
    <p className="mt-1 break-words text-sm text-mid-grey">{report.centreName || 'Choose a purpose'}</p>
    <p className="mt-3 text-sm font-semibold">{isArchivedReport(report) ? 'Archived' : statusLabels[report.status]}</p>
    {rejection && <p className="mt-2 whitespace-pre-line break-words text-sm text-rich-red">{rejection}</p>}
    <div className="absolute right-4 top-4">
      <button ref={trigger} type="button" aria-label={`Options for ${number}`} aria-expanded={menuOpen} aria-controls={`report-options-${report.id}`} onClick={() => setMenuOpen(open => !open)} className="flex size-10 items-center justify-center rounded-full border border-warm-grey text-brand-black transition hover:border-rich-red hover:text-rich-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"><HiEllipsisVertical aria-hidden="true" className="size-5" /></button>
      {menuOpen && <div ref={menu} id={`report-options-${report.id}`} className="absolute right-0 top-12 z-10 w-48 rounded-lg border border-warm-grey bg-white p-2 shadow-xl shadow-brand-black/10" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) setMenuOpen(false) }}>
        <button type="button" className={optionClass} onClick={() => { setMenuOpen(false); onView() }}><HiEye aria-hidden="true" className="size-4" />View report</button>
        {archivable && <button type="button" disabled={busy} className={optionClass} onClick={() => { setMenuOpen(false); onArchive() }}><ArchiveIcon older={older} />{older ? 'Restore as draft' : 'Archive report'}</button>}
      </div>}
    </div>
  </article>
}

export function Reimbursements({ initialOverview, initialReportId, initialView = 'mine' }: { initialOverview: Overview; initialReportId?: string; initialView?: ReimbursementView }) {
  const router = useRouter()
  const [data, setData] = useState(initialOverview)
  const [selected, setSelected] = useState(initialReportId ?? '')
  const [tab, setTab] = useState<ReimbursementView>(initialView)
  useEffect(() => { setSelected(initialReportId ?? ''); setTab(initialView) }, [initialReportId, initialView])
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const [paymentIds, setPaymentIds] = useState<string[]>([])
  const [showOlder, setShowOlder] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<VisibleReport | null>(null)
  function openReport(id: string) { setSelected(id); router.push(reimbursementReportPath(id)) }
  function backToReports() { setSelected(''); router.push(reimbursementViewPaths[tab]) }
  async function refresh() { setData(await reimbursementRequest<Overview>('')) }
  async function run(task: () => Promise<void>) {
    setError(''); setBusy(true)
    try { await task() } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  if (!hasPaymentSettings(data.defaults)) return <div className="mx-auto max-w-xl">
    <div className="mb-6 flex items-center gap-3"><div><h1 className="text-3xl">Set up reimbursements</h1></div></div>
    <PaymentSettings defaults={data.defaults} requiredSetup onSaved={async () => { await refresh() }} />
  </div>
  const report = data.reports.find(report => report.id === selected)
  const list = data.reports.filter(report => tab === 'mine' ? report.claimantId === data.personId
    : tab === 'payments' ? report.status === 'awaiting-payment'
      : report.claimantId !== data.personId && (data.finance || report.permissions.approveRC || report.permissions.visible))
  const selectedPayments = data.reports.filter(report => report.status === 'awaiting-payment' && paymentIds.includes(report.id))

  const needsApproval = (report: VisibleReport) => !isOlderReport(report) && (report.permissions.approveRC || report.permissions.approveFinance)
  function archiveOrRestore(report: VisibleReport, older: boolean) {
    if (!older) { setError(''); setArchiveTarget(report); return }
    void run(async () => { await reimbursementRequest(`/report/${report.id}`, 'POST', { action: 'restore', version: report.version }); await refresh() })
  }
  function reportTable(reports: VisibleReport[], older = false, awaitingApproval = false) {
    return (<>
      <div className="space-y-4 lg:hidden">
        {tab === 'payments' && reports.length > 0 && <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" aria-label="Select all payments" className="size-5 accent-rich-red" disabled={busy} checked={selectedPayments.length === reports.length} ref={input => { if (input) input.indeterminate = selectedPayments.length > 0 && selectedPayments.length < reports.length }} onChange={event => setPaymentIds(event.target.checked ? reports.map(report => report.id) : [])} />Select all</label>}
        {reports.map(report => <ReportCard key={report.id} report={report} showClaimant={tab !== 'mine'} archivable={report.claimantId === data.personId && (canArchiveReport(report) || isArchivedReport(report))} older={older} busy={busy} payment={tab === 'payments'} checked={paymentIds.includes(report.id)} onSelect={checked => setPaymentIds(ids => checked ? [...ids, report.id] : ids.filter(id => id !== report.id))} onView={() => openReport(report.id)} onArchive={() => archiveOrRestore(report, older)} />)}
        {!reports.length && <p className="rounded-xl border border-warm-grey bg-white p-5 text-center text-sm text-mid-grey">{tab === 'payments' ? 'No reports awaiting payment.' : awaitingApproval ? 'No reports awaiting your approval.' : older ? 'No older reports.' : 'No active reports.'}</p>}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-warm-grey bg-white lg:block">
          <table className={`w-full table-fixed text-left text-sm [&_td]:break-words ${tab === 'mine' ? 'min-w-[760px]' : tab === 'payments' ? 'min-w-[980px]' : 'min-w-[936px]'}`}>
            <caption className="sr-only">{tab === 'payments' ? 'Expense reports' : awaitingApproval ? 'Awaiting your approval' : older ? 'Older reports' : 'Active reports'}</caption>
            <colgroup>
              {tab === 'payments' && <col className="w-11" />}
              <col className="w-32" />
              {tab !== 'mine' && <col />}
              <col />
              <col />
              <col className="w-28" />
              <col className="w-20" />
            </colgroup>
            <thead className="border-b border-warm-grey bg-warm-white text-xs text-mid-grey"><tr>
              {tab === 'payments' && <th scope="col" className="px-3 py-2 align-middle"><input type="checkbox" aria-label="Select all payments" className="block size-5 accent-rich-red" disabled={busy || !reports.length} checked={reports.length > 0 && selectedPayments.length === reports.length} ref={input => { if (input) input.indeterminate = selectedPayments.length > 0 && selectedPayments.length < reports.length }} onChange={event => setPaymentIds(event.target.checked ? reports.map(report => report.id) : [])} /></th>}
              <th scope="col" className="px-3 py-2">Report</th>{tab !== 'mine' && <th scope="col" className="px-3 py-2">Claimant</th>}
              <th scope="col" className="px-3 py-2">Purpose</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2 text-right">Total NZD</th><th scope="col" className="w-20 px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody className="divide-y divide-warm-grey">{reports.map(report => <tr key={report.id} className="align-top hover:bg-warm-white/60">
              {tab === 'payments' && <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${reportNumber(report.number)}`} className="size-5 accent-rich-red" disabled={busy} checked={paymentIds.includes(report.id)} onChange={event => setPaymentIds(ids => event.target.checked ? [...ids, report.id] : ids.filter(id => id !== report.id))} /></td>}
              <td className="px-3 py-2"><button onClick={() => openReport(report.id)} className="block text-left font-semibold leading-5 text-rich-red underline underline-offset-4">{reportNumber(report.number)}</button></td>
              {tab !== 'mine' && <td className="px-3 py-2">{report.claimantName}</td>}
              <td className="px-3 py-2">{report.centreName || 'Choose a purpose'}</td>
              <td className="px-3 py-2"><span className="font-semibold">{isArchivedReport(report) ? 'Archived' : statusLabels[report.status]}</span>{report.status === 'rejected' && <p className="mt-1 max-w-sm text-xs text-rich-red">{[...report.history].reverse().find(item => ['reject', 'return'].includes(item.action))?.reason}</p>}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(report.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0))}</td>
              <td className="px-3 py-2"><div className="flex items-start">
                <button aria-label={`View ${reportNumber(report.number)}`} title="View report" className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center text-mid-grey lg:ml-0 lg:min-w-7 hover:bg-warm-white hover:text-rich-red focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red lg:min-h-5" onClick={() => openReport(report.id)}><HiEye className="size-4" aria-hidden="true" /></button>
                {report.claimantId === data.personId && (canArchiveReport(report) || isArchivedReport(report)) && <button className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center text-mid-grey lg:ml-0 lg:min-w-7 hover:bg-warm-white hover:text-rich-red focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red disabled:opacity-50 lg:min-h-5" title={older ? 'Restore as draft' : 'Archive report'} aria-label={`${older ? 'Restore' : 'Archive'} ${reportNumber(report.number)}`} disabled={busy} onClick={() => archiveOrRestore(report, older)}><ArchiveIcon older={older} /></button>}
              </div></td>
            </tr>)}</tbody>
          </table>{!reports.length && <p className="p-5 text-center text-sm text-mid-grey">{tab === 'payments' ? 'No reports awaiting payment.' : awaitingApproval ? 'No reports awaiting your approval.' : older ? 'No older reports.' : 'No active reports.'}</p>}
        </div>
      </>)
  }
  return <div className="mx-auto max-w-[80rem]">
    {archiveTarget && <ReportConfirmation report={archiveTarget} busy={busy} error={error} onClose={() => setArchiveTarget(null)} onConfirm={() => run(async () => {
      await reimbursementRequest(`/report/${archiveTarget.id}`, 'POST', { action: 'archive', version: archiveTarget.version }); await refresh(); setArchiveTarget(null)
    })} />}
    {!report && <header className="mb-8 sm:mb-10"><h1 className="text-4xl leading-tight text-brand-black sm:text-5xl">Reimbursements</h1></header>}
    {error && <p role="alert" className="mb-4 whitespace-pre-line rounded-lg border border-rich-red bg-red-50 p-4 text-brand-black">{error}</p>}
    {data.manage && data.notificationFailures.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-rich-red bg-red-50 p-4"><p>Some reimbursement emails could not be sent. Contact a website administrator. The reports are still available here.</p><ul className="mt-2 text-sm">{data.notificationFailures.map((item, index) => <li key={index}>{reportNumber(item.number)}: {item.subject}</li>)}</ul></div>}
    {selected && !report && <p className="mb-4 rounded-lg bg-white p-4">This report is unavailable. <button className="underline" onClick={backToReports}>Back to reports</button></p>}
    {report ? <ReportEditor key={`${report.id}:${report.status}:${report.version}`} report={report} data={data} onBack={backToReports} refresh={refresh} /> : <>
      <nav aria-label="Expense report views" className="mb-8 flex gap-7 overflow-x-auto border-b border-warm-grey">
        {(['mine', 'approvals', ...(data.finance ? ['payments'] as const : []), 'settings'] as const).map(item => <Link key={item} href={reimbursementViewPaths[item]} rel="nofollow" aria-current={tab === item ? 'page' : undefined} className={`relative shrink-0 whitespace-nowrap py-5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rich-red ${tab === item ? 'text-rich-red' : 'text-dark-grey hover:text-rich-red'}`} onNavigate={() => setTab(item)}>{({ mine: 'My reports', approvals: 'Approvals', payments: 'Payment queue', settings: 'Payment settings' })[item]}{tab === item && <span className="absolute inset-x-0 bottom-0 h-1 bg-rich-red" />}</Link>)}
      </nav>
      {tab === 'settings' ? <PaymentSettings defaults={data.defaults} onSaved={defaults => setData(current => ({ ...current, defaults }))} /> : <>
        {tab === 'payments' ? <>
          {reportTable(list)}
          <section aria-label="Confirm payments" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warm-grey bg-white p-5">
            <p className="text-sm">{selectedPayments.length} selected · {money(selectedPayments.reduce((total, report) => total + report.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0), 0))}</p>
            <button className={`${buttonClass} ml-auto`} disabled={busy || !selectedPayments.length} onClick={() => run(async () => {
              await reimbursementRequest('/payments', 'POST', { reports: selectedPayments.map(report => ({ id: report.id, version: report.version })) })
              setPaymentIds([]); await refresh()
            })}>Confirm Payment</button>
          </section>
        </> : <>
          {tab === 'approvals' && <section className="mb-6" aria-labelledby="awaiting-approval-heading">
            <h2 id="awaiting-approval-heading" className="mb-4 text-3xl leading-tight text-brand-black">Awaiting your approval</h2>
            {reportTable(list.filter(needsApproval), false, true)}
          </section>}
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-3xl leading-tight text-brand-black">Active reports</h2>{tab === 'mine' && <button className={buttonClass} disabled={busy} onClick={() => run(async () => { const result = await reimbursementRequest<{ id: string }>('', 'POST'); await refresh(); openReport(result.id) })}><HiPlus className="mr-2 size-5" aria-hidden="true" />Create</button>}</div>
          {reportTable(list.filter(report => !isOlderReport(report) && (tab !== 'approvals' || !needsApproval(report))).sort((a, b) => pathwayOrder[a.status] - pathwayOrder[b.status]))}
          {list.some(isOlderReport) && <div className="mt-5">
            <button className="min-h-11 text-sm font-semibold text-rich-red underline underline-offset-4" aria-expanded={showOlder} aria-controls="older-expense-reports" onClick={() => setShowOlder(value => !value)}>{showOlder ? 'Hide older' : 'Show older'} ({list.filter(isOlderReport).length})</button>
            {showOlder && <section id="older-expense-reports" className="mt-2"><h2 className="mb-4 text-3xl leading-tight text-brand-black">Older reports</h2>{reportTable(list.filter(isOlderReport), true)}</section>}
          </div>}
        </>}

      </>}
    </>}
  </div>
}

function ReportConfirmation({ report, mode = 'archive', busy, error, onClose, onConfirm }: { report: VisibleReport; mode?: 'archive' | 'edit'; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => { element.close() }
  }, [])
  return <dialog ref={dialog} aria-labelledby="report-confirmation-title" aria-describedby="report-confirmation-description" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-warm-grey bg-white p-6 text-brand-black backdrop:bg-brand-black/40">
    <h2 id="report-confirmation-title" className="text-xl font-semibold">{mode === 'edit' ? 'Edit' : 'Archive'} {reportNumber(report.number)}?</h2>
    <p id="report-confirmation-description" className="mt-3 text-sm">{mode === 'edit' ? 'Returns this report to draft and disregards any current approvals.' : 'This stops the reimbursement process for this report. It will move to older reports and cannot be approved or paid. You can restore it as a draft later and submit it again for approval.'}</p>
    {error && <p role="alert" className="mt-3 text-sm text-rich-red">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button autoFocus className={secondaryClass} disabled={busy} onClick={onClose}>{mode === 'edit' ? 'Cancel' : 'Keep active'}</button><button className={buttonClass} disabled={busy} onClick={onConfirm}>{mode === 'edit' ? busy ? 'Opening…' : 'Edit' : busy ? 'Archiving…' : 'Archive report'}</button></div>
  </dialog>
}

function PaymentSettings({ defaults, onSaved, requiredSetup = false }: { defaults: Overview['defaults']; onSaved: (profile: Overview['defaults']) => void | Promise<void>; requiredSetup?: boolean }) {
  const [profile, setProfile] = useState(defaults)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  return <form className="max-w-xl space-y-5 rounded-xl border border-warm-grey bg-white p-5" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    if (!hasPaymentSettings(profile)) { setError('Enter an account holder and a valid New Zealand bank account number.'); setBusy(false); return }
    try { await reimbursementRequest('/profile', 'PUT', profile); await onSaved(profile); setMessage('Payment settings saved.') }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save payment settings.') }
    finally { setBusy(false) }
  }}><h2 className="text-xl">Payment settings</h2><p className="text-sm text-mid-grey">{requiredSetup ? 'Add your payment details before viewing reports, reviewing claims or filing an expense report.' : 'Your reimbursements will be paid to this account. Changes apply when you next submit a report.'}</p>
    <label className="block">Account holder<input required className={inputClass} maxLength={200} autoComplete="off" value={profile.accountName} onChange={event => setProfile({ ...profile, accountName: event.target.value })} /></label>
    <label className="block">Bank account number<input required className={inputClass} maxLength={30} inputMode="numeric" autoComplete="off" placeholder="00-0000-0000000-000" value={profile.accountNumber} onChange={event => setProfile({ ...profile, accountNumber: event.target.value })} /></label>
    <button className={buttonClass} disabled={busy}>{requiredSetup ? 'Save and continue' : 'Save'}</button>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </form>
}

function ReportEditor({ report, data, onBack, refresh }: { report: VisibleReport; data: Overview; onBack: () => void; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>({ centreId: report.centreId, lines: report.lines })
  const [error, setError] = useState(''); const [saveStatus, setSaveStatus] = useState('Saved')
  const [uploadIds, setUploadIds] = useState<string[]>([])
  const activeUploads = useRef(uploadIds); activeUploads.current = uploadIds
  const [showEditConfirmation, setShowEditConfirmation] = useState(false)
  const [busy, setBusy] = useState(false); const [reason, setReason] = useState('')
  const current = useRef(draft); const version = useRef(report.version); const edited = useRef(0); const saved = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())
  function update(next: Draft) { current.current = next; edited.current++; setDraft(next); setSaveStatus('Unsaved changes') }
  function persist() {
    queue.current = queue.current.catch(() => undefined).then(async () => {
      while (saved.current < edited.current) {
        const snapshot = current.current; const sequence = edited.current
        setSaveStatus('Saving…')
        try {
          const result = await reimbursementRequest<{ version: number }>(`/report/${report.id}`, 'PATCH', { version: version.current, draft: snapshot })
          version.current = result.version; saved.current = sequence; setSaveStatus(saved.current === edited.current ? 'Saved' : 'Saving…'); setError('')
        } catch (error) { setSaveStatus('Not saved — retry'); setError(error instanceof Error ? error.message : 'Unable to save.'); throw error }
      }
    })
    return queue.current
  }
  useEffect(() => {
    if (!report.permissions.edit || edited.current === saved.current) return
    const timeout = setTimeout(() => { void persist().catch(() => undefined) }, 600)
    return () => clearTimeout(timeout)
    // Edits trigger the save; current/queue keep requests serial and retain later keystrokes.
  }, [draft])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (edited.current !== saved.current || activeUploads.current.length) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard)
  }, [])
  useEffect(() => {
    // Flush a last mobile edit before client-side member navigation or a PDF download.
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link || link.target === '_blank' || link.origin !== window.location.origin || edited.current === saved.current && !activeUploads.current.length) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (activeUploads.current.length) { setError('Wait for receipt uploads to finish before leaving this report.'); return }
      setBusy(true)
      void persist().then(() => window.location.assign(link.href)).catch(() => setBusy(false))
    }
    document.addEventListener('click', navigate, true)
    return () => document.removeEventListener('click', navigate, true)
  }, [])
  async function action(action: string) {
    if (activeUploads.current.length) { setError('Wait for receipt uploads to finish before continuing.'); return }
    setBusy(true); setError('')
    try {
      await persist()
      await reimbursementRequest(`/report/${report.id}`, 'POST', { action, version: version.current, reason })
      await refresh()
      if (action === 'delete') onBack()
      return true
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); return false }
    finally { setBusy(false) }
  }
  const centre = data.centres.find(centre => centre.id === draft.centreId)
  const fallback: Settings = { ...data.approvalFallbacks, seniorEmail: '', alternateEmail: '', financeEmail: '' }
  const approver = approvalPerson(centre ? { ...centre, approverEmail: null } : undefined, report.claimantId, fallback)
  const nextApprover = isArchivedReport(report) || report.status === 'cancelled' ? 'No pending approval'
    : report.status === 'finance-approval' ? 'Finance team'
      : ['awaiting-payment', 'paid'].includes(report.status) ? 'No further approval needed'
        : approver?.name || 'No eligible approver configured'
  const total = draft.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0)
  const gst = draft.lines.reduce((sum, line) => sum + gstMinor(line.amountMinor ?? 0, line.hasGst), 0)
  const rejectionReason = report.status === 'rejected' ? [...report.history].reverse().find(item => ['reject', 'return'].includes(item.action))?.reason : undefined
  const editable = report.permissions.edit && !busy
  return <section>
    {showEditConfirmation && <ReportConfirmation report={report} mode="edit" busy={busy} error={error} onClose={() => setShowEditConfirmation(false)} onConfirm={async () => { if (await action('withdraw')) setShowEditConfirmation(false) }} />}
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm"><div><button className="text-rich-red underline underline-offset-4 disabled:opacity-50" disabled={busy || uploadIds.length > 0} onClick={async () => { setBusy(true); try { await persist(); await refresh(); onBack() } catch (error) { setError(error instanceof Error ? error.message : 'Unable to return to reports. Please try again.') } finally { setBusy(false) } }}>Reimbursements</button><span className="mx-2" aria-hidden="true">/</span><span>{reportNumber(report.number)}</span></div></nav><div className="mb-6"><h1 className="text-3xl">Expense Report</h1></div><div className="mb-4"><p aria-live="polite" className="text-sm">{reportNumber(report.number)} · {isArchivedReport(report) ? 'Archived' : statusLabels[report.status]}{editable && ` · ${saveStatus}`}</p></div>
    {error && <p role="alert" className="mb-4 whitespace-pre-line rounded-lg border border-rich-red bg-red-50 p-4">{error}</p>}
    {rejectionReason && <section aria-labelledby="rejection-reason-heading" className="mb-5 rounded-xl border border-rich-red bg-red-50 p-5">
      <h2 id="rejection-reason-heading" className="font-semibold">Reason for rejection</h2>
      <p className="mt-2 whitespace-pre-line break-words">{rejectionReason}</p>
    </section>}
    <div className="grid gap-5 rounded-xl border border-warm-grey bg-white p-5 sm:grid-cols-2">
      <label>Purpose{editable ? <FormSelect value={draft.centreId ?? ''} onChange={event => update({ ...draft, centreId: event.target.value ? Number(event.target.value) : null })}><option value="">Choose a purpose</option>{data.centres.filter(centre => centre.approverRockPersonId).map(centre => <option key={centre.id} value={centre.id}>{centre.name}</option>)}</FormSelect> : <p className="mt-2 font-semibold">{report.centreName}</p>}</label>
      <div><p>Next approver</p><p className={editable ? 'mt-2 border border-transparent py-3 font-semibold' : 'mt-2 font-semibold'}>{nextApprover}</p></div>
    </div>
    <div className="mb-3 mt-6 flex items-start justify-between gap-3">
      <div><h2 className="text-xl">Expenses</h2></div>
      {editable && <button className={`${secondaryClass} shrink-0`} disabled={draft.lines.length >= 100} onClick={() => update({ ...draft, lines: [...draft.lines, newLine()] })}>Add expense</button>}
    </div>
    <div className="space-y-4 lg:space-y-0 lg:rounded-lg lg:border lg:border-warm-grey lg:bg-white">
      <div aria-hidden="true" className="hidden gap-0 border-b border-warm-grey bg-warm-white px-1 py-2 text-xs font-semibold [&>span]:px-2 lg:grid lg:grid-cols-[8rem_1.3fr_1.8fr_6.5rem_6.5rem_7.5rem_9rem_2.75rem]"><span>Date</span><span>Category</span><span>Description</span><span>Net</span><span>Gross</span><span>GST</span><span>Receipt</span><span /></div>
      {draft.lines.map((line, index) => <ExpenseLineEditor key={line.id} line={line} index={index} editable={editable} data={data} onUploading={loading => setUploadIds(ids => loading ? [...new Set([...ids, line.id])] : ids.filter(id => id !== line.id))} shared={draft.lines.some(other => other.id !== line.id && other.receiptHash && other.receiptHash === line.receiptHash)} onChange={next => update({ ...current.current, lines: current.current.lines.map(item => item.id === line.id ? { ...item, ...next } : item) })} onRemove={() => update({ ...draft, lines: draft.lines.filter(item => item.id !== line.id) })} />)}
      <div aria-label="Expense totals" className="grid grid-cols-2 gap-y-3 rounded-xl border border-warm-grey bg-white px-3 py-4 text-sm font-semibold tabular-nums lg:gap-y-1 lg:rounded-none lg:border-0 lg:border-t lg:bg-warm-white lg:px-1 lg:py-3 lg:grid-cols-[8rem_1.3fr_1.8fr_6.5rem_6.5rem_7.5rem_9rem_2.75rem]"><span className="col-span-2 px-2 lg:col-span-3">Total</span><span className="px-2 text-right"><span className="mr-2 lg:sr-only">Net</span>{money(total - gst)}</span><span className="px-2 text-right"><span className="mr-2 lg:sr-only">Gross</span>{money(total)}</span></div></div>
    {report.status !== 'paid' && <div className="mt-6 space-y-4 rounded-xl border border-warm-grey bg-white p-5">
      {(report.permissions.approveRC || report.permissions.approveFinance || !isArchivedReport(report) && data.finance && ['awaiting-payment', 'finance-approval'].includes(report.status)) && <label className="block">Reason or note <span className="text-sm text-mid-grey">(required for rejection)</span><textarea className={inputClass} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} /></label>}
      <div className="flex flex-wrap justify-end gap-3">
        {editable && <><button className={secondaryClass} disabled={busy} onClick={() => { void persist().catch(() => undefined) }}>Save</button><button className={buttonClass} disabled={busy || uploadIds.length > 0} onClick={() => action('submit')}>Submit</button></>}
        {report.permissions.withdraw && <button className={secondaryClass} disabled={busy} onClick={() => { setError(''); setShowEditConfirmation(true) }}>Edit</button>}
        {!isArchivedReport(report) && data.finance && report.status === 'awaiting-payment' && <><button className={secondaryClass} disabled={busy || !reason.trim()} onClick={() => action('return')}>Return for changes</button></>}
        {(report.permissions.approveRC || report.permissions.approveFinance) && <><button className={secondaryClass} disabled={busy || !reason.trim()} onClick={() => action('reject')}>Reject</button><button className={buttonClass} disabled={busy} onClick={() => action('approve')}>Approve</button></>}
      </div>
      {busy && <p role="status">Saving your changes…</p>}
      {report.status === 'awaiting-payment' && <p>Approved and awaiting payment. Finance can record payment from the payment queue.</p>}
    </div>}
    <section className="mt-8"><h2 className="text-2xl">Activity</h2>{!report.history.length && <p className="mt-4 text-sm text-mid-grey">No activity yet.</p>}<ol className="mt-4 space-y-3">{report.history.map((item, index) => <li key={index} className="rounded-lg bg-white p-4 text-sm"><p><strong>{item.name}</strong> · {actionLabels[item.action] ?? item.action} · revision {item.revision}</p><p className="mt-1 text-mid-grey">{new Date(item.at).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</p>{item.reason && <p className="mt-2 whitespace-pre-line break-words">{item.reason}</p>}</li>)}</ol></section>
  </section>
}

function ExpenseLineEditor({ line, index, editable, data, shared, onChange, onRemove, onUploading }: { line: ExpenseLine; index: number; editable: boolean; data: Overview; shared: boolean; onChange: (line: Partial<ExpenseLine>) => void; onRemove: () => void; onUploading: (loading: boolean) => void }) {
  const [expenseMenuOpen, setExpenseMenuOpen] = useState(false)
  const expenseMenu = useRef<HTMLDivElement>(null)
  const expenseMenuTrigger = useRef<HTMLButtonElement>(null)
  const expenseDelete = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!expenseMenuOpen) return
    expenseDelete.current?.focus()
    function closeOutside(event: PointerEvent) { if (!expenseMenu.current?.contains(event.target as Node)) setExpenseMenuOpen(false) }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') { setExpenseMenuOpen(false); expenseMenuTrigger.current?.focus() } }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [expenseMenuOpen])
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = descriptionRef.current
    if (!field) return
    const resize = () => {
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight}px`
    }
    resize()
    let width = field.clientWidth
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) { width = field.clientWidth; resize() }
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [line.description])
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const uploadInProgress = useRef(false)
  const receiptInput = useRef<HTMLInputElement>(null)
  const uploadRequest = useRef<XMLHttpRequest | null>(null)
  useEffect(() => () => { uploadRequest.current?.abort(); onUploading(false) }, [])
  const [inclusive, setInclusive] = useState(line.amountMinor === null ? '' : (line.amountMinor / 100).toFixed(2))
  const [exclusive, setExclusive] = useState(line.amountMinor === null ? '' : ((line.amountMinor - gstMinor(line.amountMinor, line.hasGst)) / 100).toFixed(2))
  const [upload, setUpload] = useState(''); const [file, setFile] = useState<File | null>(null); const [uploading, setUploading] = useState(false)
  function amount(value: string, kind: 'inclusive' | 'exclusive', hasGst = line.hasGst) {
    const parsed = parseMoney(value)
    const gross = parsed === null ? null : kind === 'exclusive' && hasGst ? Math.round(parsed * 115 / 100) : parsed
    if (kind === 'inclusive') { setInclusive(value); setExclusive(gross === null ? '' : ((gross - gstMinor(gross, hasGst)) / 100).toFixed(2)) }
    else { setExclusive(value); setInclusive(gross === null ? '' : (gross / 100).toFixed(2)) }
    onChange({ ...line, amountMinor: gross, hasGst })
  }
  function uploadFile(file: File) {
    if (!editable || uploadInProgress.current) return
    if (file.type && !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { setUpload('Choose a camera photo, JPG, PNG, WebP or PDF receipt.'); setFile(null); return }
    if (file.size > 10 * 1024 * 1024) { setUpload('Choose a receipt smaller than 10 MB.'); return }
    uploadInProgress.current = true
    setUploading(true); onUploading(true); setUpload('Uploading…')
    const request = new XMLHttpRequest(); uploadRequest.current = request; const form = new FormData(); form.set('file', file)
    request.open('POST', '/api/reimbursements/receipt'); request.responseType = 'json'; request.timeout = 120000
    request.upload.onprogress = event => { if (event.lengthComputable) setUpload(`Uploading ${Math.round(event.loaded / event.total * 100)}%`) }
    request.onload = () => {
      uploadInProgress.current = false; setUploading(false); onUploading(false)
      if (request.status >= 200 && request.status < 300 && request.response?.hash) {
        onChange({ receiptHash: request.response.hash }); setUpload(`Uploaded ${file.name}`); setFile(null)
      } else setUpload(request.response?.error || 'Upload failed. Retry below.')
    }
    request.onerror = request.ontimeout = () => { uploadInProgress.current = false; setUploading(false); onUploading(false); setUpload('Upload interrupted. Retry below.') }
    request.send(form)
  }
  return <fieldset
    className={`relative min-w-0 rounded-xl border border-warm-grey bg-white p-5 shadow-sm shadow-brand-black/5 lg:rounded-none lg:border-0 lg:border-b lg:px-1 lg:py-1 lg:shadow-none lg:last:border-b-0 ${dragging ? 'bg-rich-red/5 ring-2 ring-inset ring-rich-red' : ''}`}
    onDragEnter={event => {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault(); event.stopPropagation()
      if (editable && !uploadInProgress.current) { dragDepth.current++; setDragging(true) }
    }}
    onDragOver={event => {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault(); event.stopPropagation()
      event.dataTransfer.dropEffect = editable && !uploadInProgress.current ? 'copy' : 'none'
    }}
    onDragLeave={event => {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault(); event.stopPropagation()
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setDragging(false)
    }}
    onDrop={event => {
      if (!event.dataTransfer.types.includes('Files') && !event.dataTransfer.files.length) return
      event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false)
      if (!editable || uploadInProgress.current) return
      if (event.dataTransfer.files.length !== 1) { setUpload('Drop one receipt file per expense.'); setFile(null); return }
      const receipt = event.dataTransfer.files[0]
      setFile(receipt); uploadFile(receipt)
    }}
  ><legend className="sr-only">Expense {index + 1}</legend>
    <div className="mb-5 flex items-center justify-between gap-3 lg:hidden"><h3 className="text-xl font-bold">Expense {index + 1}</h3>{editable && <div className="relative" ref={expenseMenu} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpenseMenuOpen(false) }}>
      <button ref={expenseMenuTrigger} type="button" aria-label={`Options for expense ${index + 1}`} aria-expanded={expenseMenuOpen} aria-controls={`expense-options-${line.id}`} className="flex size-10 items-center justify-center rounded-full border border-warm-grey text-brand-black transition hover:border-rich-red hover:text-rich-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red" onClick={() => setExpenseMenuOpen(open => !open)}><HiEllipsisVertical className="size-5" aria-hidden="true" /></button>
      {expenseMenuOpen && <div id={`expense-options-${line.id}`} className="absolute right-0 top-12 z-20 w-48 rounded-lg border border-warm-grey bg-white p-2 shadow-xl shadow-brand-black/10"><button ref={expenseDelete} type="button" disabled={uploading} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-bold text-brand-black hover:bg-warm-grey/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red disabled:opacity-50" onClick={onRemove}><HiTrash className="size-4" aria-hidden="true" />Delete expense</button></div>}
    </div>}</div>{dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-warm-white/95 text-sm font-semibold text-rich-red"><HiArrowUpTray className="mr-2 size-5" aria-hidden="true" />{line.receiptHash ? 'Drop to replace receipt' : 'Drop receipt here'}</div>}<div className="grid grid-cols-2 items-start gap-x-4 gap-y-5 lg:gap-x-0 lg:gap-y-0 lg:grid-cols-[8rem_1.3fr_1.8fr_6.5rem_6.5rem_7.5rem_9rem_2.75rem] [&>label]:min-w-0 [&>label>span:first-child]:mb-2 [&>label>span:first-child]:block [&>label>span:first-child]:text-sm [&>label>span:first-child]:font-semibold [&>label>span:first-child]:lg:mb-0 [&>label>span:first-child]:lg:px-2 [&>label>span:first-child]:lg:text-xs [&>label>span:first-child]:lg:sr-only [&_input]:mt-0 [&_select]:mt-0 [&_textarea]:mt-0">
    <label className="col-span-2 lg:col-span-1"><span>Date</span><input disabled={!editable} type="date" className={expenseCellClass} value={line.date} onChange={event => onChange({ ...line, date: event.target.value })} /></label>
    <label className="col-span-2 lg:col-span-1"><span>Category</span><FormSelect variant="cell" disabled={!editable} className={expenseCellClass} value={line.categoryId ?? ''} onChange={event => onChange({ ...line, categoryId: event.target.value ? Number(event.target.value) : null })}><option value="">Choose a category</option>{data.categories.filter(category => !category.archived || category.id === line.categoryId).map(category => <option key={category.id} value={category.id}>{category.name}{category.archived ? ' (archived)' : ''}</option>)}</FormSelect></label>
    <label className="col-span-2 lg:col-span-1"><span>Description</span><textarea ref={descriptionRef} rows={1} disabled={!editable} className={`${expenseCellClass} resize-none overflow-hidden whitespace-pre-wrap break-words`} value={line.description} maxLength={2000} onChange={event => onChange({ ...line, description: event.target.value })} /></label>
    <label><span>Net</span><input disabled={!editable} className={`${expenseCellClass} text-right tabular-nums`} inputMode="decimal" placeholder="0.00" value={exclusive} onChange={event => amount(event.target.value, 'exclusive')} /></label>
    <label><span>Gross</span><input disabled={!editable} className={`${expenseCellClass} text-right tabular-nums`} inputMode="decimal" placeholder="0.00" value={inclusive} onChange={event => amount(event.target.value, 'inclusive')} /></label>
    <div className="col-span-2 min-w-0 lg:col-span-1"><button type="button" role="switch" aria-label={`Includes GST for expense ${index + 1}`} aria-checked={line.hasGst} disabled={!editable} className="flex min-h-11 w-full items-center gap-2 px-0 text-sm focus:outline-none lg:px-2 focus:ring-1 focus:ring-inset focus:ring-rich-red disabled:cursor-default lg:min-h-8" onClick={() => amount(inclusive, 'inclusive', !line.hasGst)}><span aria-hidden="true" className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${line.hasGst ? 'bg-rich-red' : 'bg-mid-grey'}`}><span className={`size-4 rounded-full bg-white transition-transform ${line.hasGst ? 'translate-x-4' : 'translate-x-0'}`} /></span><span className="lg:sr-only">GST</span></button></div>
    <div className="col-span-2 flex min-w-0 items-start border-t border-warm-grey pt-4 lg:border-0 lg:pt-0">
      <div className="min-w-0 flex-1 lg:px-2">
        {line.receiptHash ? <span className="flex w-full items-center lg:w-auto"><a aria-label={`Show receipt for expense ${index + 1}`} title={shared ? 'View receipt (also used on another expense)' : 'View receipt'} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-sm font-semibold text-rich-red hover:bg-warm-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red lg:min-h-8" href={`/api/reimbursements/receipt/${line.receiptHash}`} target="_blank" rel="noopener noreferrer"><HiEye className="size-5" aria-hidden="true" /><span className="lg:sr-only">Show receipt</span></a>{editable && <button type="button" aria-label={`Remove receipt for expense ${index + 1}`} title="Remove receipt" disabled={uploading} className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center text-mid-grey lg:ml-0 lg:min-w-8 hover:bg-warm-white hover:text-rich-red focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red disabled:opacity-50 lg:min-h-8" onClick={() => { if (uploadInProgress.current) return; setFile(null); setUpload(''); onChange({ receiptHash: null }) }}><HiTrash className="size-5 lg:hidden" aria-hidden="true" /><HiXMark className="hidden size-5 lg:block" aria-hidden="true" /></button>}</span> : editable ? <button type="button" aria-label={`Upload receipt for expense ${index + 1}`} title={uploading ? 'Uploading receipt…' : 'Upload receipt'} disabled={uploading} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-sm font-semibold text-rich-red hover:bg-warm-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red disabled:opacity-50 lg:min-h-8" onClick={() => receiptInput.current?.click()}><HiArrowUpTray className="size-5" aria-hidden="true" /><span className="lg:sr-only">Upload receipt</span></button> : <span className="inline-flex min-h-8 items-center text-sm text-mid-grey">—</span>}
        {editable && <input ref={receiptInput} aria-label={`Receipt for expense ${index + 1}`} disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { setFile(file); uploadFile(file) } }} />}
        <p role="status" className={!upload || upload.startsWith('Uploaded ') ? 'sr-only' : 'text-xs'}>{upload}</p>{file && !uploading && <button className={secondaryClass} disabled={!editable} onClick={() => uploadFile(file)}>Retry receipt upload</button>}
      </div>
      {editable && <div className="hidden self-stretch border-l border-warm-grey lg:block"><button type="button" aria-label={`Remove expense ${index + 1}`} title="Remove expense" className="inline-flex min-h-11 min-w-11 items-center justify-center text-mid-grey hover:bg-warm-white hover:text-rich-red focus:outline-none focus:ring-1 focus:ring-inset focus:ring-rich-red lg:min-h-8" onClick={onRemove}><HiTrash className="size-4" aria-hidden="true" /></button></div>}
    </div>
  </div></fieldset>
}
