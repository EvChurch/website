// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ComponentProps } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Reimbursements } from './Reimbursements'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/link', () => ({ default: ({ onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { onNavigate?: () => void }) => <a {...props} onClick={event => { event.preventDefault(); onNavigate?.() }} /> }))
const id = '00000000-0000-4000-8000-000000000001'
const lineId = '00000000-0000-4000-8000-000000000002'
function fixture(): ComponentProps<typeof Reimbursements>['initialOverview'] { return {
  notificationFailures: [], personId: 1, finance: false, manage: false, defaults: { accountName: 'Aroha', accountNumber: '12-1234-1234567-000' }, settings: undefined,
  approvalFallbacks: { seniorPersonId: null, seniorName: '', alternatePersonId: null, alternateName: '' },
  categories: [{ id: 1, name: 'Food & hospitality', archived: false }],
  centres: [{ id: 1, name: 'Hospitality', financeOnly: false, approverRockPersonId: 2, approverName: 'RC Approver' }],
  reports: [{ id, number: 1, version: 1, revision: 0, claimantId: 1, claimantName: 'Aroha', claimantEmail: 'aroha@example.com', centreId: null, centreName: '', accountName: '', accountNumber: '', payoutOverride: null, status: 'draft', history: [], rcApproverId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    lines: [{ id: lineId, date: '', categoryId: null, description: '', amountMinor: null, hasGst: true, receiptHash: null }],
    permissions: { visible: true, bank: true, edit: true, withdraw: false, approveRC: false, approveFinance: false, payment: false },
  }],
} }
let container: HTMLDivElement, root: Root
const fetchMock = vi.fn()
function input(label: string) { const field = [...container.querySelectorAll('label')].find(item => item.textContent?.startsWith(label))?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea'); if (!field) throw Error(`Missing ${label}`); return field }
async function type(label: string, value: string) { await act(async () => { const field = input(label); Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) }) }
function button(text: string) { return [...container.querySelectorAll<HTMLButtonElement>('button,a')].find(item => item.textContent === text)! }
const response = (version: number) => ({ ok: true, json: async () => ({ version }) })
beforeEach(async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  push.mockClear()
  vi.useFakeTimers(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); fetchMock.mockResolvedValue(response(2))
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<Reimbursements initialOverview={fixture()} initialReportId={id} />))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('autosaves incomplete lines and serializes newer keystrokes behind an in-flight save', async () => {
  let finish!: (value: ReturnType<typeof response>) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(response(3))
  await type('Description', 'First')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await type('Description', 'Typed while saving')
  await act(async () => { finish(response(2)); await Promise.resolve() })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const bodies = fetchMock.mock.calls.map(call => JSON.parse(call[1].body))
  expect(Object.keys(bodies[0].draft).sort()).toEqual(['centreId', 'lines', 'payoutOverride'])
  expect(bodies[0].draft.lines[0].description).toBe('First')
  expect(bodies[1].version).toBe(2)
  expect(bodies[1].draft.lines[0].description).toBe('Typed while saving')
  expect(bodies[1].draft.lines[0].amountMinor).toBeNull()
  expect(container.textContent).toContain('Saved')
})
it('calculates both GST fields and preserves line edits completed during an upload', async () => {
  class FakeUpload {
    static current: FakeUpload
    upload = {}; responseType = ''; timeout = 0; status = 200; response = { hash: 'a'.repeat(64) }
    onload: (() => void) | null = null; onerror = null; ontimeout = null
    constructor() { FakeUpload.current = this }
    open() {} send() {} abort() {}
  }
  vi.stubGlobal('XMLHttpRequest', FakeUpload)
  const picker = container.querySelector<HTMLInputElement>('input[type="file"]')!
  const openPicker = vi.spyOn(picker, 'click').mockImplementation(() => undefined)
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Upload receipt for expense 1"]')!.click())
  expect(openPicker).toHaveBeenCalledOnce()
  expect(picker.className).toBe('hidden')
  await act(async () => button('Advanced').click())
  await type('Net', '100.00')
  expect(input('Gross').value).toBe('115.00')
  await act(async () => {
    const file = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(file, 'files', { value: [new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' })] })
    file.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(button('Submit').disabled).toBe(true)
  await type('Description', 'Updated after upload started')
  await act(async () => FakeUpload.current.onload?.())
  expect(input('Description').value).toBe('Updated after upload started')
  expect(input('Gross').value).toBe('115.00')
  expect(button('Submit').disabled).toBe(false)
  expect(container.querySelector('a[aria-label="Show receipt for expense 1"]')).not.toBeNull()
  expect(container.querySelector('button[aria-label="Upload receipt for expense 1"]')).toBeNull()
  await act(async () => vi.advanceTimersByTimeAsync(650))
  const saved = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)
  expect(saved.draft.lines[0]).toMatchObject({ receiptHash: 'a'.repeat(64), description: 'Updated after upload started', amountMinor: 11500 })
})
it('retains edits after a failed autosave and retries the same version', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Offline'))
  await type('Description', 'Keep me')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(container.textContent).toContain('Not saved')
  expect(input('Description').value).toBe('Keep me')
  await act(async () => button('Save').click())
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).version).toBe(1)
  expect(container.textContent).toContain('Saved')
})

it('locks expense editing through the final save, submission and refresh', async () => {
  const data = fixture()
  data.reports[0].payoutOverride = { accountName: 'Custom holder', accountNumber: '12-1234-1234567-001' }
  data.reports[0].lines[0].receiptHash = 'a'.repeat(64)
  data.reports[0].lines.push({ ...data.reports[0].lines[0], id: crypto.randomUUID(), receiptHash: null })
  await act(async () => root.render(<Reimbursements key="submit-lock" initialOverview={data} initialReportId={id} />))
  let finishSave!: (value: ReturnType<typeof response>) => void
  let finishSubmit!: (value: ReturnType<typeof response>) => void
  let finishRefresh!: (value: { ok: boolean; json: () => Promise<typeof data> }) => void
  fetchMock
    .mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { finishSubmit = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve }))
  await act(async () => button('Advanced').click())
  await type('Description', 'Final description')
  await type('Gross', '115.00')
  await act(async () => button('Submit').click())

  function expectLocked() {
    for (const field of container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')) expect(field.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[role="switch"][aria-label^="Includes GST"]')!.disabled).toBe(true)
    expect(button('Add expense')).toBeUndefined()
    expect(container.querySelector('button[aria-label^="Remove receipt"]')).toBeNull()
    expect(container.querySelector('button[aria-label^="Remove expense"]')).toBeNull()
    expect(container.querySelector('button[aria-label^="Options for expense"]')).toBeNull()
    expect(container.querySelector('button[aria-label^="Upload receipt"]')).toBeNull()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(button('Reimbursements').disabled).toBe(true)
    expect(input('Use a different account for this report').disabled).toBe(true)
    expect(input('Account holder').disabled).toBe(true)
    expect(input('Bank account number').disabled).toBe(true)
    expect(input('Description').value).toBe('Final description')
    expect(input('Gross').value).toBe('115.00')
  }
  expectLocked()
  expect(fetchMock.mock.calls.map(call => call[1].method)).toEqual(['PATCH'])
  await act(async () => { finishSave(response(2)) })
  expectLocked()
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ action: 'submit', version: 2 })
  await act(async () => { finishSubmit(response(3)) })
  expectLocked()
  expect(fetchMock.mock.calls.map(call => call[1].method)).toEqual(['PATCH', 'POST', 'GET'])
  const submitted = structuredClone(data)
  Object.assign(submitted.reports[0], { version: 3, status: 'rc-approval' })
  submitted.reports[0].permissions.edit = false
  submitted.reports[0].permissions.withdraw = true
  submitted.reports[0].lines = JSON.parse(fetchMock.mock.calls[0][1].body).draft.lines
  await act(async () => { finishRefresh({ ok: true, json: async () => submitted }) })
  expect(input('Description').disabled).toBe(true)
  expect(input('Amount').value).toBe('115.00')
  expect(container.textContent).toContain('Awaiting purpose approval')
})

it('blocks receipt retries during submission and restores editing after a rejection', async () => {
  class FailedUpload {
    static current: FailedUpload
    upload = {}; responseType = ''; timeout = 0
    onerror: (() => void) | null = null
    constructor() { FailedUpload.current = this }
    open() {} send() {} abort() {}
  }
  vi.stubGlobal('XMLHttpRequest', FailedUpload)
  await act(async () => {
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(picker, 'files', { value: [new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' })] })
    picker.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await act(async () => FailedUpload.current.onerror?.())
  const retry = button('Retry receipt upload')
  expect(retry.disabled).toBe(false)
  const upload = FailedUpload.current
  let finishSubmit!: (value: { ok: boolean; json: () => Promise<{ error: string }> }) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finishSubmit = resolve }))
  await act(async () => button('Submit').click())
  expect(retry.disabled).toBe(true)
  await act(async () => retry.click())
  expect(FailedUpload.current).toBe(upload)
  expect(input('Description').disabled).toBe(true)
  await act(async () => { finishSubmit({ ok: false, json: async () => ({ error: 'Upload a receipt before submitting.' }) }) })
  expect(input('Description').disabled).toBe(false)
  expect(button('Retry receipt upload').disabled).toBe(false)
  expect(button('Add expense')).toBeDefined()
  expect(container.textContent).toContain('Upload a receipt before submitting.')
})

it('keeps the editor open when a final save before member navigation fails', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Offline during navigation'))
  await type('Description', 'Do not lose this last edit')
  const link = document.createElement('a'); link.href = '/members'; document.body.appendChild(link)
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
  try {
    await act(async () => link.dispatchEvent(click))
    expect(click.defaultPrevented).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(input('Description').value).toBe('Do not lose this last edit')
    expect(container.textContent).toContain('Offline during navigation')
  } finally { link.remove() }
})

it('omits report titles and member settings, and labels the purpose', async () => {
  expect(container.textContent).not.toContain('Report title')
  expect(container.querySelector('input[autocomplete="off"]')).toBeNull()
  expect(container.textContent).not.toContain('Reason or note')
  expect(container.textContent).not.toContain('Download summary PDF')
  expect(container.textContent).not.toContain('Cancel report')
  expect(container.textContent).not.toContain('Delete draft')
  expect(container.textContent).not.toContain('Activity')
  expect(container.textContent).not.toContain('No activity yet.')
  expect(container.querySelectorAll('[data-form-select]').length).toBe(2)
  expect(container.querySelector('[aria-label="Expense totals"]')).not.toBeNull()
  expect(container.textContent).toContain('Next approver')
  await act(async () => root.render(<Reimbursements key="list" initialOverview={{ ...fixture(), manage: true, finance: true }} />))
  expect(container.querySelector('table')).not.toBeNull()
  expect(container.textContent).not.toContain('Settings')
  expect(container.textContent).not.toContain('Untitled expense report')
  expect(container.textContent).toContain('EXP-000001')
})

it('shows only Approve and Reject for finance approval, without category adjustments or returns', async () => {
  const data = fixture()
  data.personId = 3; data.finance = true
  data.reports[0].status = 'finance-approval'
  data.reports[0].lines[0].categoryId = 1
  data.reports[0].permissions.edit = false
  data.reports[0].permissions.approveFinance = true
  await act(async () => root.render(<Reimbursements key="finance-approval" initialOverview={data} initialReportId={id} />))
  expect(container.textContent).not.toContain('Finance: categories')
  expect(container.textContent).not.toContain('Save categories')
  expect(container.textContent).not.toContain('Return for changes')
  expect(container.querySelector('select')!.disabled).toBe(true)
  expect([...button('Approve').parentElement!.querySelectorAll('button')].map(item => item.textContent)).toEqual(['Reject', 'Approve'])
})

it('grows and shrinks descriptions to fit wrapped content', async () => {
  const field = input('Description')
  let height = 96
  Object.defineProperty(field, 'scrollHeight', { get: () => height })
  await type('Description', 'A longer description that wraps across several lines')
  expect(field.style.height).toBe('96px')
  height = 32
  await type('Description', 'Short')
  expect(field.style.height).toBe('32px')
  expect(field.classList.contains('resize-none')).toBe(true)
})

it('toggles GST using a switch while keeping the inclusive amount', async () => {
  await act(async () => button('Advanced').click())
  await type('Gross', '115.00')
  const toggle = container.querySelector<HTMLButtonElement>('[role="switch"][aria-label^="Includes GST"]')!
  expect(toggle.getAttribute('aria-checked')).toBe('true')
  await act(async () => toggle.click())
  expect(toggle.getAttribute('aria-checked')).toBe('false')
  expect(input('Gross').value).toBe('115.00')
  expect(input('Net').value).toBe('115.00')
  await act(async () => toggle.click())
  expect(input('Net').value).toBe('100.00')
  expect(button('Advanced').getAttribute('aria-checked')).toBe('true')
})

it('saves personal payment settings separately from reports', async () => {
  await act(async () => root.render(<Reimbursements key="payment-settings" initialOverview={fixture()} />))
  await act(async () => button('Payment settings').click())
  await type('Account holder', 'Aroha Example')
  await type('Bank account number', '12-1234-1234567-000')
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(fetchMock).toHaveBeenCalledWith('/api/reimbursements/profile', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ accountName: 'Aroha Example', accountNumber: '12-1234-1234567-000' }) }))
  expect(container.textContent).toContain('Payment settings saved.')
})

function fileDrag(target: Element, type: string, files: File[] = [], types = ['Files']) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { types, files, dropEffect: 'none' } })
  target.dispatchEvent(event)
  return event
}

it('uploads a receipt dropped anywhere on a row and keeps nested drag highlights stable', async () => {
  class FakeUpload {
    static current: FakeUpload
    upload = {}; responseType = ''; timeout = 0; status = 200; response = { hash: 'b'.repeat(64) }
    onload: (() => void) | null = null; onerror = null; ontimeout = null
    constructor() { FakeUpload.current = this }
    open() {} send = vi.fn<(form: FormData) => void>(); abort() {}
  }
  vi.stubGlobal('XMLHttpRequest', FakeUpload)
  const row = container.querySelector('fieldset')!
  const description = input('Description')
  await act(async () => { fileDrag(row, 'dragenter'); fileDrag(description, 'dragenter'); fileDrag(row, 'dragleave') })
  expect(row.textContent).toContain('Drop receipt here')
  const receipt = new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' })
  await act(async () => { expect(fileDrag(description, 'drop', [receipt]).defaultPrevented).toBe(true) })
  expect(row.textContent).not.toContain('Drop receipt here')
  expect(FakeUpload.current.send).toHaveBeenCalledOnce()
  expect(FakeUpload.current.send.mock.calls[0][0].get('file')).toBe(receipt)
  await act(async () => fileDrag(row, 'drop', [receipt]))
  expect(FakeUpload.current.send).toHaveBeenCalledOnce()
  await act(async () => FakeUpload.current.onload?.())
  expect(row.querySelector('a[aria-label="Show receipt for expense 1"]')?.getAttribute('href')).toContain('b'.repeat(64))
  await act(async () => fileDrag(row, 'dragenter'))
  expect(row.textContent).toContain('Drop to replace receipt')
  await act(async () => fileDrag(row, 'dragleave'))
  expect(row.textContent).not.toContain('Drop to replace receipt')
})

it('rejects multiple or unsupported dropped files and prevents drops on read-only reports', async () => {
  const xhr = vi.fn()
  vi.stubGlobal('XMLHttpRequest', xhr)
  const row = container.querySelector('fieldset')!
  const receipt = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' })
  await act(async () => fileDrag(row, 'drop', [receipt, receipt]))
  expect(row.textContent).toContain('Drop one receipt file per expense.')
  await act(async () => fileDrag(row, 'drop', [new File(['text'], 'notes.txt', { type: 'text/plain' })]))
  expect(row.textContent).toContain('Choose a camera photo, JPG, PNG, WebP or PDF receipt.')
  expect(xhr).not.toHaveBeenCalled()
  const data = fixture(); data.reports[0].permissions.edit = false
  await act(async () => root.render(<Reimbursements key="read-only-drops" initialOverview={data} initialReportId={id} />))
  await act(async () => { expect(fileDrag(container.querySelector('fieldset')!, 'drop', [receipt]).defaultPrevented).toBe(true) })
  expect(xhr).not.toHaveBeenCalled()
  expect(container.textContent).not.toContain('Drop receipt here')
})

it('keeps the existing receipt and shows an error if a dropped replacement fails', async () => {
  class FailedUpload {
    static current: FailedUpload
    upload = {}; responseType = ''; timeout = 0; status = 503; response = { error: 'Receipt upload unavailable' }
    onload: (() => void) | null = null; onerror = null; ontimeout = null
    constructor() { FailedUpload.current = this }
    open() {} send() {} abort() {}
  }
  vi.stubGlobal('XMLHttpRequest', FailedUpload)
  const data = fixture(); data.reports[0].lines[0].receiptHash = 'a'.repeat(64)
  await act(async () => root.render(<Reimbursements key="replacement" initialOverview={data} initialReportId={id} />))
  await act(async () => fileDrag(container.querySelector('fieldset')!, 'drop', [new File(['%PDF'], 'replacement.pdf', { type: 'application/pdf' })]))
  await act(async () => FailedUpload.current.onload?.())
  expect(container.querySelector('a[aria-label="Show receipt for expense 1"]')?.getAttribute('href')).toContain('a'.repeat(64))
  expect(container.textContent).toContain('Receipt upload unavailable')
  expect(container.querySelector('[role="status"].text-xs')?.textContent).toBe('Receipt upload unavailable')
  expect(button('Retry receipt upload')).toBeDefined()
})

it.each([false, true])('requires payment setup before showing any report, including deep links (finance: %s)', async finance => {
  const data = fixture(); data.defaults = { accountName: '', accountNumber: '' }; data.finance = finance
  await act(async () => root.render(<Reimbursements key={`setup-${finance}`} initialOverview={data} initialReportId={id} />))
  expect(container.textContent).toContain('Set up reimbursements')
  expect(container.querySelector('nav')).toBeNull()
  expect(container.querySelector('table')).toBeNull()
  expect(container.textContent).not.toContain('EXP-000001')
  expect(container.textContent).not.toContain('Create')
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(fetchMock).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Enter an account holder')
  await type('Account holder', 'Aroha')
  await type('Bank account number', '12-1234-1234567-000')
  fetchMock.mockImplementation(async (_url: string, options: { method: string }) => ({ ok: true, json: async () => options.method === 'GET' ? fixture() : { ok: true } }))
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(container.textContent).not.toContain('Set up reimbursements')
  expect(container.textContent).toContain('EXP-000001')
})

it('keeps setup locked when payment details fail to save', async () => {
  const data = fixture(); data.defaults = { accountName: 'Aroha', accountNumber: 'invalid' }
  await act(async () => root.render(<Reimbursements key="failed-setup" initialOverview={data} initialReportId={id} />))
  await type('Bank account number', '12-1234-1234567-000')
  fetchMock.mockRejectedValueOnce(new Error('Unable to save payment settings'))
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(container.textContent).toContain('Unable to save payment settings')
  expect(container.textContent).toContain('Set up reimbursements')
  expect(container.querySelector('fieldset')).toBeNull()
})

it('keeps paid and cancelled reports behind Show older and archives or restores rejected reports', async () => {
  const data = fixture()
  const base = data.reports[0]
  data.reports = (['draft', 'rejected', 'paid', 'cancelled'] as const).map((status, index) => ({ ...base, id: `${id.slice(0, -1)}${index + 1}`, number: index + 1, status }))
  await act(async () => root.render(<Reimbursements key="history" initialOverview={data} />))
  expect(container.textContent).toContain('Active reports')
  expect(button('EXP-000001')).toBeDefined()
  expect(button('EXP-000002')).toBeDefined()
  expect(button('EXP-000003')).toBeUndefined()
  expect(button('EXP-000004')).toBeUndefined()
  await act(async () => button('Show older (2)').click())
  expect(button('EXP-000003')).toBeDefined()
  expect(button('EXP-000004')).toBeDefined()
  await act(async () => button('Hide older (2)').click())
  const rejected = data.reports[1]
  const archived = { ...data, reports: data.reports.map(report => report === rejected ? { ...report, version: 2, history: [{ at: new Date().toISOString(), personId: 1, name: 'Aroha', action: 'archive', reason: '', revision: 0 }] } : report) }
  fetchMock.mockResolvedValueOnce(response(2)).mockResolvedValueOnce({ ok: true, json: async () => archived })
  const archive = container.querySelector<HTMLButtonElement>('button[aria-label="Archive EXP-000002"]')!
  expect(archive.textContent).toBe('')
  expect(archive.title).toBe('Archive report')
  await act(async () => archive.click())
  expect(fetchMock).not.toHaveBeenCalled()
  expect(container.querySelector('dialog')!.textContent).toContain('stops the reimbursement process')
  await act(async () => button('Keep active').click())
  expect(container.querySelector('dialog')).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
  await act(async () => archive.click())
  await act(async () => button('Archive report').click())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'archive', version: 1 })
  expect(button('EXP-000002')).toBeUndefined()
  await act(async () => button('Show older (3)').click())
  expect(button('EXP-000002')).toBeDefined()
  fetchMock.mockResolvedValueOnce(response(3)).mockResolvedValueOnce({ ok: true, json: async () => data })
  const restore = container.querySelector<HTMLButtonElement>('button[aria-label="Restore EXP-000002"]')!
  expect(restore.textContent).toBe('')
  expect(restore.title).toBe('Restore as draft')
  expect(restore.querySelector('svg')).not.toBeNull()
  await act(async () => restore.click())
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ action: 'restore', version: 2 })
  expect(container.querySelector('table')!.textContent).toContain('EXP-000002')
})

it('offers quiet archive controls on drafts and both approval stages, and eye buttons open reports', async () => {
  const data = fixture()
  const base = data.reports[0]
  data.reports = (['draft', 'rc-approval', 'finance-approval', 'rejected', 'awaiting-payment'] as const).map((status, index) => ({ ...base, id: `${id.slice(0, -1)}${index + 1}`, number: index + 1, status }))
  await act(async () => root.render(<Reimbursements key="actions" initialOverview={data} />))
  expect(container.querySelectorAll('button[aria-label^="Archive "]')).toHaveLength(4)
  expect(container.querySelectorAll('button[aria-label^="View EXP-"]')).toHaveLength(5)
  expect(container.querySelector('button[aria-label="Archive EXP-000001"]')!.className).toContain('text-mid-grey')
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="View EXP-000001"]')!.click())
  expect(container.querySelector('h1')!.textContent).toBe('Expense Report')
})

it('orders active reports along the approval pathway with awaiting payment last, preserving order within each status', async () => {
  const data = fixture()
  const base = data.reports[0]
  data.reports = (['awaiting-payment', 'finance-approval', 'rejected', 'rc-approval', 'draft', 'awaiting-payment'] as const).map((status, index) => ({ ...base, id: `${id.slice(0, -1)}${index + 1}`, number: index + 1, status }))
  await act(async () => root.render(<Reimbursements key="ordered" initialOverview={data} />))
  expect([...container.querySelectorAll('tbody tr')].map(row => row.querySelector('button')!.textContent)).toEqual(['EXP-000005', 'EXP-000003', 'EXP-000004', 'EXP-000002', 'EXP-000001', 'EXP-000006'])
})

it('removes only the selected line’s receipt, autosaves the empty attachment and allows another upload', async () => {
  const data = fixture()
  data.reports[0].lines[0] = { ...data.reports[0].lines[0], description: 'Keep this expense', amountMinor: 11500, receiptHash: 'a'.repeat(64) }
  data.reports[0].lines.push({ ...data.reports[0].lines[0], id: '00000000-0000-4000-8000-000000000003' })
  await act(async () => root.render(<Reimbursements key="remove-receipt" initialOverview={data} initialReportId={id} />))
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Remove receipt for expense 1"]')!.click())
  expect(container.querySelectorAll('fieldset')).toHaveLength(2)
  expect(input('Description').value).toBe('Keep this expense')
  expect(input('Amount').value).toBe('115.00')
  expect(container.querySelector('a[aria-label="Show receipt for expense 1"]')).toBeNull()
  expect(container.querySelector('button[aria-label="Upload receipt for expense 1"]')).not.toBeNull()
  expect(container.querySelector('a[aria-label="Show receipt for expense 2"]')).not.toBeNull()
  await act(async () => vi.advanceTimersByTimeAsync(650))
  const saved = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)
  expect(saved.draft.lines[0].receiptHash).toBeNull()
  expect(saved.draft.lines[1].receiptHash).toBe('a'.repeat(64))
  data.reports[0].permissions.edit = false
  await act(async () => root.render(<Reimbursements key="readonly-receipt" initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('button[aria-label^="Remove receipt"]')).toBeNull()
  expect(container.querySelector('a[aria-label="Show receipt for expense 1"]')).not.toBeNull()
})

it.each([
  ['draft', 'RC Approver'], ['rejected', 'RC Approver'], ['rc-approval', 'RC Approver'],
  ['finance-approval', 'Finance team'], ['awaiting-payment', 'No further approval needed'],
  ['paid', 'No further approval needed'], ['cancelled', 'No pending approval'],
] as const)('shows the next approver for a %s report', async (status, expected) => {
  const data = fixture()
  data.reports[0].status = status
  data.reports[0].centreId = 1
  data.reports[0].permissions.edit = status === 'draft' || status === 'rejected'
  await act(async () => root.render(<Reimbursements key={status} initialOverview={data} initialReportId={id} />))
  const label = [...container.querySelectorAll('p')].find(item => item.textContent === 'Next approver')!
  expect(label.nextElementSibling!.textContent).toBe(expected)
  expect(container.textContent).not.toContain('Purpose approver')
})

it.each(['rc-approval', 'finance-approval'] as const)('confirms Edit in an in-page modal before withdrawing a %s report', async status => {
  const data = fixture()
  data.reports[0].status = status
  data.reports[0].permissions.edit = false
  data.reports[0].permissions.withdraw = true
  await act(async () => root.render(<Reimbursements key={status} initialOverview={data} initialReportId={id} />))
  await act(async () => button('Edit').click())
  expect(fetchMock).not.toHaveBeenCalled()
  expect(container.querySelector('dialog')!.textContent).toContain('Returns this report to draft and disregards any current approvals.')
  expect(container.querySelector('dialog')!.textContent).not.toMatch(/both approvals/i)
  await act(async () => button('Cancel').click())
  expect(container.querySelector('dialog')).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
  await act(async () => button('Edit').click())
  fetchMock.mockResolvedValueOnce(response(2)).mockResolvedValueOnce({ ok: true, json: async () => data })
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>('dialog button')].find(item => item.textContent === 'Edit')!.click())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'withdraw', version: 1 })
  expect(container.querySelector('dialog')).toBeNull()
})

it.each(['rc-approval', 'finance-approval'] as const)('places Approve last and requires a rejection reason for %s', async status => {
  const data = fixture()
  data.finance = status === 'finance-approval'
  data.reports[0].status = status
  data.reports[0].permissions = { ...data.reports[0].permissions, edit: false, approveRC: status === 'rc-approval', approveFinance: status === 'finance-approval' }
  await act(async () => root.render(<Reimbursements key={status} initialOverview={data} initialReportId={id} />))
  expect(container.textContent).toContain('(required for rejection)')
  expect(container.textContent).not.toContain('return or payment correction')
  expect(button('Reject').disabled).toBe(true)
  expect(button('Approve').disabled).toBe(false)
  const actions = [...button('Approve').parentElement!.querySelectorAll('button')].map(item => item.textContent)
  expect(actions.slice(-2)).toEqual(['Reject', 'Approve'])
  await type('Reason or note', '   ')
  expect(button('Reject').disabled).toBe(true)
  await type('Reason or note', 'Please attach an itemised receipt')
  expect(button('Reject').disabled).toBe(false)
})

it('selects all or individual pending payments and confirms only the selected reports', async () => {
  const data = fixture()
  data.finance = true
  data.personId = 3
  const base = data.reports[0]
  data.reports = (['awaiting-payment', 'paid', 'awaiting-payment'] as const).map((status, index) => ({ ...base, id: `${id.slice(0, -1)}${index + 1}`, number: index + 1, status }))
  await act(async () => root.render(<Reimbursements key="payment-queue" initialOverview={data} />))
  await act(async () => button('Payment queue').click())
  expect(container.textContent).not.toContain('Record completed payments')
  expect(container.textContent).not.toContain('Payment date')
  expect(container.textContent).not.toContain('Payment reference')
  expect(button('Confirm Payment').disabled).toBe(true)
  const all = container.querySelector<HTMLInputElement>('input[aria-label="Select all payments"]')!
  const checkboxes = [...container.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')]
  expect(checkboxes).toHaveLength(2)
  expect(all.className).toContain('accent-rich-red')
  await act(async () => all.click())
  expect(checkboxes.every(input => input.checked)).toBe(true)
  expect(button('Confirm Payment').disabled).toBe(false)
  await act(async () => checkboxes[0].click())
  expect(all.indeterminate).toBe(true)
  expect(all.checked).toBe(false)
  await act(async () => all.click())
  expect(checkboxes.every(input => input.checked)).toBe(true)
  await act(async () => all.click())
  expect(checkboxes.every(input => !input.checked)).toBe(true)
  expect(button('Confirm Payment').disabled).toBe(true)
  await act(async () => checkboxes[1].click())
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ batch: 'batch-1' }) }).mockResolvedValueOnce({ ok: true, json: async () => data })
  await act(async () => button('Confirm Payment').click())
  expect(fetchMock.mock.calls[0][0]).toBe('/api/reimbursements/payments')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reports: [{ id: data.reports[2].id, version: 1 }] })
  expect(button('Confirm Payment').disabled).toBe(true)
})

it.each(['purpose', 'finance'] as const)('prioritizes actionable approvals for %s reviewers without duplicating active reports', async role => {
  const data = fixture()
  data.finance = role === 'finance'
  const base = data.reports[0]
  data.reports = (['rc-approval', 'finance-approval', 'awaiting-payment', 'paid'] as const).map((status, index) => ({
    ...base, id: `${id.slice(0, -1)}${index + 1}`, number: index + 1, claimantId: 2, status,
    permissions: { ...base.permissions, edit: false, approveRC: role === 'purpose' && status === 'rc-approval', approveFinance: role === 'finance' && status === 'finance-approval' },
  }))
  await act(async () => root.render(<Reimbursements key={role} initialOverview={data} />))
  await act(async () => button('Approvals').click())
  const tables = [...container.querySelectorAll('table')]
  expect(tables.map(table => table.querySelector('caption')?.textContent)).toEqual(['Awaiting your approval', 'Active reports'])
  const actionable = role === 'purpose' ? 'EXP-000001' : 'EXP-000002'
  expect(tables[0].textContent).toContain(actionable)
  expect(tables[1].textContent).not.toContain(actionable)
  expect(tables[1].textContent).toContain('EXP-000003')
  expect(container.textContent).not.toContain('EXP-000004')
  await act(async () => button('Show older (1)').click())
  expect(button('EXP-000004')).toBeDefined()
})

it('shows the latest rejection reason above the report fields only while rejected', async () => {
  const data = fixture()
  data.reports[0].status = 'rejected'
  data.reports[0].history = [
    { at: new Date().toISOString(), personId: 2, name: 'Approver', action: 'reject', reason: 'Old reason', revision: 1 },
    { at: new Date().toISOString(), personId: 3, name: 'Finance', action: 'reject', reason: 'Please attach an itemised receipt.\nThe total must match.', revision: 2 },
  ]
  await act(async () => root.render(<Reimbursements key="rejected-reason" initialOverview={data} initialReportId={id} />))
  const notice = container.querySelector('section[aria-labelledby="rejection-reason-heading"]')!
  expect(notice.textContent).toContain('Please attach an itemised receipt.\nThe total must match.')
  expect(notice.textContent).not.toContain('Old reason')
  expect(notice.compareDocumentPosition(container.querySelector('fieldset')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  data.reports[0].status = 'rc-approval'
  await act(async () => root.render(<Reimbursements key="resubmitted-reason" initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('section[aria-labelledby="rejection-reason-heading"]')).toBeNull()
})

it('keeps paid reports read-only without notes, correction actions, or payment metadata', async () => {
  const data = fixture()
  data.finance = true
  Object.assign(data.reports[0], {
    status: 'paid',
    history: [{ at: new Date().toISOString(), personId: 3, name: 'Finance', action: 'paid', reason: '', revision: 1 }],
    permissions: { ...data.reports[0].permissions, edit: false },
  })
  await act(async () => root.render(<Reimbursements key="paid-clean" initialOverview={data} initialReportId={id} />))
  expect(container.textContent).toContain('Paid')
  for (const text of ['Reason or note', 'Correct accidental paid status', 'Payment date:', 'PAYMENT-REFERENCE', 'PAYMENT-BATCH']) expect(container.textContent).not.toContain(text)
  expect(button('Submit')).toBeUndefined()
  expect(container.textContent).toContain('Activity')
})

it('offers Create beside active reports only on My reports', async () => {
  await act(async () => root.render(<Reimbursements key="create-navigation" initialOverview={{ ...fixture(), finance: true }} />))
  expect(button('Create')).toBeDefined()
  expect(button('Create').parentElement?.textContent).toContain('Active reports')
  for (const tab of ['Approvals', 'Payment settings', 'Payment queue']) {
    await act(async () => button(tab).click())
    expect(button('Create')).toBeUndefined()
  }
  await act(async () => button('My reports').click())
  expect(button('Create')).toBeDefined()
})

it('opens mobile report actions, dismisses with Escape, and confirms archiving', async () => {
  await act(async () => root.render(<Reimbursements key="mobile-actions" initialOverview={fixture()} />))
  const card = container.querySelector('article')!
  expect(card.textContent).toContain('$0.00')
  const options = card.querySelector<HTMLButtonElement>('button[aria-label="Options for EXP-000001"]')!
  expect(options.getAttribute('aria-expanded')).toBe('false')
  await act(async () => options.click())
  expect(options.getAttribute('aria-expanded')).toBe('true')
  expect(button('View report')).toBeDefined()
  expect(button('Archive report')).toBeDefined()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(button('View report')).toBeUndefined()
  expect(document.activeElement).toBe(options)
  await act(async () => options.click())
  await act(async () => button('Archive report').click())
  expect(container.querySelector('dialog')!.textContent).toContain('stops the reimbursement process')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('shows only view in a paid card menu and restores archived cards as drafts', async () => {
  const data = fixture()
  data.reports[0].status = 'paid'
  await act(async () => root.render(<Reimbursements key="mobile-paid" initialOverview={data} />))
  await act(async () => button('Show older (1)').click())
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label^="Options for"]')!.click())
  expect(button('View report')).toBeDefined()
  expect(button('Archive report')).toBeUndefined()
  expect(button('Restore as draft')).toBeUndefined()
  data.reports[0].status = 'draft'
  data.reports[0].history = [{ at: new Date().toISOString(), personId: 1, name: 'Aroha', action: 'archive', reason: '', revision: 0 }]
  await act(async () => root.render(<Reimbursements key="mobile-archived" initialOverview={data} />))
  await act(async () => button('Show older (1)').click())
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label^="Options for"]')!.click())
  fetchMock.mockResolvedValueOnce(response(2)).mockResolvedValueOnce({ ok: true, json: async () => fixture() })
  await act(async () => button('Restore as draft').click())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'restore', version: 1 })
})

it('deletes a mobile expense card through its options and hides the menu during review', async () => {
  const options = container.querySelector<HTMLButtonElement>('button[aria-label="Options for expense 1"]')!
  expect(options.getAttribute('aria-expanded')).toBe('false')
  await act(async () => options.click())
  expect(button('Delete expense')).toBeDefined()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(button('Delete expense')).toBeUndefined()
  await act(async () => options.click())
  await act(async () => button('Delete expense').click())
  expect(container.querySelector('fieldset')).toBeNull()
  const data = fixture()
  data.reports[0].status = 'rc-approval'
  data.reports[0].permissions.edit = false
  await act(async () => root.render(<Reimbursements key="readonly-expense-cards" initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('fieldset')).not.toBeNull()
  expect(container.querySelector('button[aria-label="Options for expense 1"]')).toBeNull()
})

it('links each view and opens reports using their own paths', async () => {
  const data = fixture(); data.finance = true
  await act(async () => root.render(<Reimbursements key="paths" initialOverview={data} />))
  for (const [label, suffix] of [['My reports', ''], ['Approvals', '/approvals'], ['Payment queue', '/payment-queue'], ['Payment settings', '/payment-settings']]) {
    expect(button(label).getAttribute('href')).toBe(`/members/reimbursements${suffix}`)
  }
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="View EXP-000001"]')!.click())
  expect(push).toHaveBeenLastCalledWith(`/members/reimbursements/reports/${id}`)
})

it('follows route changes when returning through browser history', async () => {
  const data = fixture(); data.finance = true
  await act(async () => root.render(<Reimbursements key="history-paths" initialOverview={data} initialView="approvals" />))
  expect(button('Approvals').getAttribute('aria-current')).toBe('page')
  await act(async () => root.render(<Reimbursements key="history-paths" initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('h1')!.textContent).toBe('Expense Report')
  await act(async () => root.render(<Reimbursements key="history-paths" initialOverview={data} initialView="approvals" />))
  expect(button('Approvals').getAttribute('aria-current')).toBe('page')
  expect(container.querySelector('h1')!.textContent).toBe('Reimbursements')
})


it('starts with a single inclusive Amount and retains no-GST amounts when GST controls are hidden', async () => {
  expect(button('Advanced').getAttribute('aria-expanded')).toBe('false')
  expect(button('Advanced').getAttribute('role')).toBe('switch')
  expect(button('Advanced').getAttribute('aria-checked')).toBe('false')
  expect(container.querySelector('[role="switch"][aria-label^="Includes GST"]')).toBeNull()
  expect([...container.querySelectorAll('label')].some(label => label.textContent?.startsWith('Net'))).toBe(false)
  expect(container.querySelector('[aria-label="Expense totals"]')!.textContent).not.toMatch(/Net|Gross/)
  await type('Amount', '115.00')
  await act(async () => button('Advanced').click())
  expect(input('Net').value).toBe('100.00')
  expect(button('Advanced').getAttribute('aria-checked')).toBe('true')
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"][aria-label^="Includes GST"]')!.click())
  await act(async () => button('Advanced').click())
  expect(input('Amount').value).toBe('115.00')
  await type('Amount', '230.00')
  await act(async () => button('Advanced').click())
  expect(input('Net').value).toBe('230.00')
  expect(input('Gross').value).toBe('230.00')
  expect(container.querySelector('[role="switch"][aria-label^="Includes GST"]')!.getAttribute('aria-checked')).toBe('false')
  await act(async () => button('Advanced').click())
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).draft.lines[0]).toMatchObject({ amountMinor: 23000, hasGst: false })
})

it('allows reviewers to reveal GST without editing or autosaving', async () => {
  const data = fixture()
  Object.assign(data.reports[0], { status: 'rc-approval', lines: [{ ...data.reports[0].lines[0], amountMinor: 11500, hasGst: false }] })
  data.reports[0].permissions.edit = false
  data.reports[0].permissions.approveRC = true
  await act(async () => root.render(<Reimbursements key="review-gst" initialOverview={data} initialReportId={id} />))
  expect(input('Amount').disabled).toBe(true)
  await act(async () => button('Advanced').click())
  expect(input('Net').value).toBe('115.00')
  expect(input('Gross').disabled).toBe(true)
  const toggle = container.querySelector<HTMLButtonElement>('[role="switch"][aria-label^="Includes GST"]')!
  expect(toggle.disabled).toBe(true)
  expect(toggle.getAttribute('aria-checked')).toBe('false')
  await act(async () => button('Advanced').click())
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(fetchMock).not.toHaveBeenCalled()
})

it('blocks incomplete bank numbers, autosaves valid overrides serially and clears them without changing the profile', async () => {
  expect(container.querySelector('[aria-label="Report bank account"]')!.hasAttribute('data-giving-private')).toBe(true)
  expect(container.querySelector('[aria-label="Report bank account"]')!.textContent).toContain('Aroha')
  expect(container.textContent).toContain('12-****-*****67-000')
  expect(container.textContent).not.toContain('12-1234-1234567-000')
  let finish!: (value: ReturnType<typeof response>) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(response(3))
  await act(async () => input('Use a different account for this report').click())
  await type('Account holder', 'Other holder')
  await type('Bank account number', '12-')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(input('Bank account number').value).toBe('12')
  expect(fetchMock).not.toHaveBeenCalled()
  expect(container.textContent).toContain('00-0000-0000000-00')
  await type('Bank account number', '121234123456700')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).draft.payoutOverride).toEqual({ accountName: 'Other holder', accountNumber: '12-1234-1234567-00' })
  await type('Bank account number', '12-1234-1234567-001')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => finish(response(2)))
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ version: 2, draft: { payoutOverride: { accountName: 'Other holder', accountNumber: '12-1234-1234567-001' } } })
  await act(async () => input('Use a different account for this report').click())
  expect(container.querySelector('input[autocomplete="off"]')).toBeNull()
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toMatchObject({ version: 3, draft: { payoutOverride: null } })
  expect(container.querySelector('[aria-label="Report bank account"]')!.textContent).toContain('12-****-*****67-000')
  expect(fetchMock.mock.calls.every(call => call[0] === `/api/reimbursements/report/${id}` && call[1].method === 'PATCH')).toBe(true)
})

it('restores an existing override but does not save an empty replacement', async () => {
  const data = fixture()
  data.reports[0].payoutOverride = { accountName: 'Saved holder', accountNumber: '12-1234-1234567-001' }
  await act(async () => root.render(<Reimbursements key="existing-override" initialOverview={data} initialReportId={id} />))
  const checkbox = input('Use a different account for this report')
  if (!(checkbox instanceof HTMLInputElement)) throw Error('Expected an account override checkbox')
  expect(checkbox.checked).toBe(true)
  expect(input('Account holder').value).toBe('Saved holder')
  expect(input('Bank account number').value).toBe('12-1234-1234567-001')
  await act(async () => input('Use a different account for this report').click())
  await act(async () => input('Use a different account for this report').click())
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(fetchMock).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Not saved')
})

it.each([true, false])('shows only permitted report bank details for read-only viewers (bank: %s)', async bank => {
  const data = fixture()
  Object.assign(data.reports[0], { accountName: 'Report holder', accountNumber: '98-1234-1234567-000', payoutOverride: { accountName: 'Private override', accountNumber: '99-1234-1234567-000' } })
  data.reports[0].permissions.edit = false
  data.reports[0].permissions.bank = bank
  await act(async () => root.render(<Reimbursements key={`bank-${bank}`} initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('[aria-label="Report bank account"]') !== null).toBe(bank)
  if (bank) expect(container.querySelector('[aria-label="Report bank account"]')!.hasAttribute('data-giving-private')).toBe(true)
  expect(container.textContent?.includes('Report holder')).toBe(bank)
  expect(container.textContent?.includes('98-****-*****67-000')).toBe(bank)
  expect(container.textContent).not.toContain('98-1234-1234567-000')
  expect(container.textContent).not.toContain('12-1234-1234567-000')
  expect(container.textContent).not.toContain('Private override')
  expect(container.textContent).not.toContain('99-1234-1234567-000')
  expect(container.textContent).not.toContain('Use a different account for this report')
})

it('hides saved bank details and override controls without bank permission even on an editable report', async () => {
  const data = fixture()
  data.reports[0].permissions.bank = false
  await act(async () => root.render(<Reimbursements key="no-bank" initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('[aria-label="Report bank account"]')).toBeNull()
  expect(container.textContent).not.toContain('12-1234-1234567-000')
  expect(container.textContent).not.toContain('Use a different account for this report')
})

it.each(['draft', 'rejected'] as const)('includes the shared Pastor Expense Account and routes %s reports directly to Finance team', async status => {
  const data = fixture()
  data.reports[0].status = status
  data.centres.push({ id: 2, name: 'Pastor Expense Account', financeOnly: true, approverRockPersonId: null, approverName: null })
  data.centres.push({ id: 3, name: 'Unconfigured purpose', financeOnly: false, approverRockPersonId: null, approverName: null })
  await act(async () => root.render(<Reimbursements key="finance-purpose" initialOverview={data} initialReportId={id} />))
  const purpose = container.querySelector<HTMLSelectElement>('select')!
  expect([...purpose.options].map(option => option.textContent)).toEqual(['Choose a purpose', 'Hospitality', 'Pastor Expense Account'])
  await act(async () => { purpose.value = '2'; purpose.dispatchEvent(new Event('change', { bubbles: true })) })
  const label = [...container.querySelectorAll('p')].find(item => item.textContent === 'Next approver')!
  expect(label.nextElementSibling!.textContent).toBe('Finance team')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).draft.centreId).toBe(2)
  await act(async () => { purpose.value = '1'; purpose.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(label.nextElementSibling!.textContent).toBe('RC Approver')
})


it('reveals and hides the bank account number without autosaving or exposing it to recordings', async () => {
  const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-label$="bank account number"]')!
  expect(toggle().getAttribute('aria-label')).toBe('Show bank account number')
  expect(container.textContent).not.toContain('12-1234-1234567-000')
  await act(async () => toggle().click())
  expect(toggle().getAttribute('aria-label')).toBe('Hide bank account number')
  expect(toggle().getAttribute('aria-pressed')).toBe('true')
  expect(container.textContent).toContain('12-1234-1234567-000')
  expect(toggle().closest('[data-giving-private]')).not.toBeNull()
  await act(async () => toggle().click())
  expect(toggle().getAttribute('aria-pressed')).toBe('false')
  expect(container.textContent).not.toContain('12-1234-1234567-000')
  await act(async () => vi.advanceTimersByTimeAsync(650))
  expect(fetchMock).not.toHaveBeenCalled()
})

it('masks unformatted bank numbers as well as formatted bank numbers', async () => {
  const data = fixture()
  data.reports[0].permissions.edit = false
  data.reports[0].accountNumber = '1212341234567000'
  await act(async () => root.render(<Reimbursements key="unformatted-bank" initialOverview={data} initialReportId={id} />))
  expect(container.querySelector('[aria-label="Bank account number"]')!.textContent).toBe('12*********67000')
  expect(container.textContent).not.toContain('1212341234567000')
})


it('shows a pencil link to saved bank settings only while the claimant reveals the number', async () => {
  expect(container.querySelector('a[aria-label="Edit saved bank account"]')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Show bank account number"]')!.click())
  const link = container.querySelector('a[aria-label="Edit saved bank account"]')!
  expect(link.getAttribute('href')).toBe('/members/reimbursements/payment-settings')
  expect(link.textContent).toBe('')
  expect(link.querySelector('svg')).not.toBeNull()
  expect(link.parentElement?.querySelector('button[aria-label="Hide bank account number"]')).not.toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Hide bank account number"]')!.click())
  expect(container.querySelector('a[aria-label="Edit saved bank account"]')).toBeNull()
  const data = fixture()
  data.reports[0].permissions.edit = false
  await act(async () => root.render(<Reimbursements key="review-bank-link" initialOverview={data} initialReportId={id} />))
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Show bank account number"]')!.click())
  expect(container.querySelector('a[aria-label="Edit saved bank account"]')).toBeNull()
})


it.each(['121234123456700', '12-1234-1234567-000'])('formats payment settings input and saves a valid suffix: %s', async number => {
  await act(async () => root.render(<Reimbursements key={number} initialOverview={fixture()} initialView="settings" />))
  await type('Bank account number', number)
  const formatted = number.includes('-') ? number : '12-1234-1234567-00'
  expect(input('Bank account number').value).toBe(formatted)
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).accountNumber).toBe(formatted)
})

it('does not save incomplete payment settings', async () => {
  await act(async () => root.render(<Reimbursements key="incomplete-bank" initialOverview={fixture()} initialView="settings" />))
  await type('Bank account number', '12123412345670')
  expect(input('Bank account number').value).toBe('12-1234-1234567-0')
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(fetchMock).not.toHaveBeenCalled()
})
