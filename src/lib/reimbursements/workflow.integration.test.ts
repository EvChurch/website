import { randomUUID } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SIMPLIFY_REIMBURSEMENTS_UP_SQL } from '@/migrations/20261017_030000_simplify_reimbursements'
import { REIMBURSEMENTS_UP_SQL } from '@/migrations/20261017_020000_reimbursements'
import { actOnReport, configure, createReport, hasOpened, isFinance, markBatchPaid, openReimbursements, overview, saveDraft, saveProfile, uploadReceipt } from './store'
import { approvalPerson, isArchivedReport, isOlderReport, gstMinor, parseMoney, type Actor, type Draft, type Settings } from './model'
import { reconcileReimbursementEmails, type ReimbursementEmail } from './notifications'

const runtime = vi.hoisted(() => ({ actor: vi.fn(), pool: vi.fn() }))
vi.mock('./runtime', () => ({ reimbursementActor: runtime.actor, reimbursementPool: runtime.pool }))
import { handleReimbursementRequest } from './http'

const url = process.env.REIMBURSEMENT_TEST_DATABASE_URL
const actor = (personId: number, finance = false, admin = false): Actor => ({ personId, finance, admin, name: `Person ${personId}`, email: `person${personId}@example.com` })
const claimant = actor(1), rc = actor(2), finance = actor(3, true), stranger = actor(9), senior = actor(4), alternate = actor(5)
const settings: Settings = { seniorPersonId: 4, seniorName: 'Senior', seniorEmail: senior.email, alternatePersonId: 5, alternateName: 'Alternate', alternateEmail: alternate.email, financeEmail: 'finance@example.com' }
let pool: Pool
const schema = `reimbursement_test_${randomUUID().replaceAll('-', '')}`
let hash: string
let receiptBody: Buffer
async function read(id: string, who = claimant) { return (await overview(pool, who)).reports.find(report => report.id === id)! }
async function act(id: string, who: Actor, action: string, reason = '') { return actOnReport(pool, who, id, { action, reason, version: (await read(id, who)).version }) }
async function validDraft(who = claimant) {
  await saveProfile(pool, who, { accountName: 'Claimant account', accountNumber: '12-1234-1234567-000' })
  const id = await createReport(pool, who)
  const draft: Draft = { centreId: 1, lines: [{ id: randomUUID(), date: '2026-10-15', description: 'A portion of the lunch receipt', categoryId: 1, amountMinor: 11500, hasGst: true, receiptHash: hash }] }
  await saveDraft(pool, who, id, 1, draft)
  return { id, draft }
}
async function approved() { const { id } = await validDraft(); await act(id, claimant, 'submit'); await act(id, rc, 'approve'); await act(id, finance, 'approve'); return id }

describe.skipIf(!url)('Reimbursement PostgreSQL workflow and authenticated HTTP boundary', () => {
  beforeAll(async () => {
    const target = new URL(url!)
    if (!target.pathname.startsWith('/evchurch_dev_wt_') || !['', 'localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Use a local Codex worktree database only')
    const setup = new Pool({ connectionString: url })
    await setup.query(`CREATE SCHEMA ${schema}`)
    await setup.end()
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` })
    await pool.query(`CREATE TYPE enum_payload_jobs_task_slug AS ENUM ('inline'); CREATE TYPE enum_payload_jobs_log_task_slug AS ENUM ('inline');
      CREATE TABLE responsibility_centres (id integer PRIMARY KEY, name text, approver_rock_person_id numeric, approver_name text, approver_email text, is_active boolean, last_synced_at timestamptz, sort_order integer);
      CREATE TABLE reimbursement_finance_members (rock_person_id numeric, last_synced_at timestamptz);`)
    const client = await pool.connect()
    try { await client.query('BEGIN'); await client.query(REIMBURSEMENTS_UP_SQL); await client.query('COMMIT') } finally { client.release() }
    // The schema migration is repeatable without creating duplicate categories.
    await pool.query(REIMBURSEMENTS_UP_SQL)
    runtime.pool.mockResolvedValue(pool)
    process.env.APP_BASE_URL = 'https://example.com'
  })
  afterAll(async () => { if (pool) { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end() } })
  beforeEach(async () => {
    await pool.query(`TRUNCATE reimbursement_email_deliveries,reimbursement_reports,reimbursement_receipt_owners,reimbursement_receipts,reimbursement_profiles,responsibility_centres,reimbursement_finance_members CASCADE;
      INSERT INTO responsibility_centres VALUES(1,'Hospitality',2,'RC Approver','person2@example.com',true,now(),1),(2,'Unassigned',NULL,NULL,NULL,true,now(),2);
      INSERT INTO reimbursement_finance_members VALUES(3,now()); UPDATE reimbursement_categories SET archived=false;`)
    await configure(pool, finance, { settings, categories: (await overview(pool, finance)).categories })
    const receipt = await PDFDocument.create()
    receipt.addPage().drawText('Synthetic receipt')
    receiptBody = Buffer.from(await receipt.save())
    hash = await uploadReceipt(pool, claimant, receiptBody, 'receipt.pdf', 'application/pdf')
    runtime.actor.mockResolvedValue(claimant)
  })
  it('keeps menu opt-in permanent and incomplete drafts private, with optimistic saves', async () => {
    expect(await hasOpened(pool, 1)).toBe(false)
    await openReimbursements(pool, 1)
    expect(await hasOpened(pool, 1)).toBe(true)
    const id = await createReport(pool, claimant)
    await saveDraft(pool, claimant, id, 1, { centreId: null, lines: [{ id: randomUUID(), date: '', categoryId: null, description: '', amountMinor: null, hasGst: false, receiptHash: null }] })
    expect((await read(id)).lines).toHaveLength(1)
    expect((await overview(pool, finance)).reports).toHaveLength(0)
    expect((await overview(pool, actor(7, false, true))).reports).toHaveLength(0)
    await expect(saveDraft(pool, claimant, id, 1, await read(id))).rejects.toMatchObject({ status: 409 })
    await expect(act(id, claimant, 'submit')).rejects.toThrow('Line 1:')
    await act(id, claimant, 'archive')
    expect(isArchivedReport(await read(id))).toBe(true)
    expect(await hasOpened(pool, 1)).toBe(true)
  })
  it('ignores legacy ledger mappings when reading reports', async () => {
    const { id, draft } = await validDraft()
    const legacyLines = draft.lines.map(line => ({ ...line, accountCode: 'OLD-LEDGER' }))
    await pool.query('UPDATE reimbursement_reports SET lines=$2::jsonb WHERE id=$1', [id, JSON.stringify(legacyLines)])
    expect((await read(id)).lines[0]).not.toHaveProperty('accountCode')
    expect((await overview(pool, finance)).categories[0]).not.toHaveProperty('accountCode')
  })
  it('submits reports without a title', async () => {
    const { id, draft } = await validDraft()
    await saveDraft(pool, claimant, id, 2, draft)
    await act(id, claimant, 'submit')
    expect((await read(id)).status).toBe('rc-approval')
    expect(await read(id)).not.toHaveProperty('title')
  })
  it('migrates legacy fields and snapshots without losing report or receipt history', async () => {
    const id = await approved()
    await markBatchPaid(pool, finance, { reports: [{ id, version: (await read(id)).version }] })
    const before = await read(id)
    await pool.query(`ALTER TABLE reimbursement_reports ADD COLUMN title text, ADD COLUMN payment_date date,
      ADD COLUMN payment_reference text, ADD COLUMN payment_batch uuid;
      ALTER TABLE reimbursement_categories ADD COLUMN account_code text;`)
    const legacyHistory = before.history.map(entry => ({ ...entry,
      ...(entry.action === 'paid' ? { reason: 'Payment date: old; reference: obsolete; batch: old' } : {}),
      ...(entry.snapshot ? { snapshot: { ...entry.snapshot, title: 'Old title', lines: entry.snapshot.lines.map(line => ({ ...line, accountCode: 'OLD' })) } } : {}),
    }))
    await pool.query(`UPDATE reimbursement_reports SET title='Old title',payment_date='2026-10-17',payment_reference='obsolete',payment_batch=$2,
      lines=$3::jsonb,history=$4::jsonb WHERE id=$1`, [id, randomUUID(), JSON.stringify(before.lines.map(line => ({ ...line, accountCode: 'OLD' }))), JSON.stringify(legacyHistory)])
    const migrate = async () => {
      const client = await pool.connect()
      try { await client.query('BEGIN'); await client.query(SIMPLIFY_REIMBURSEMENTS_UP_SQL); await client.query('COMMIT') }
      catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    await migrate(); await migrate()
    const columns = (await pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name IN ('reimbursement_reports','reimbursement_categories')`, [schema])).rows.map(row => row.column_name)
    for (const field of ['title', 'payment_date', 'payment_reference', 'payment_batch', 'account_code']) expect(columns).not.toContain(field)
    expect(await read(id)).toEqual(before)
    expect((await pool.query('SELECT 1 FROM reimbursement_receipts WHERE hash=$1', [hash])).rowCount).toBe(1)
  })
  it('rejects removed actions and payment fields rather than retaining hidden functionality', async () => {
    const id = await approved()
    const report = await read(id)
    for (const action of ['classify', 'reverse-payment', 'delete', 'cancel']) {
      await expect(actOnReport(pool, finance, id, { action, version: report.version })).rejects.toThrow()
    }
    await expect(markBatchPaid(pool, finance, { reports: [{ id, version: report.version }], reference: 'obsolete', date: '2026-10-17' })).rejects.toThrow()
    expect((await read(id)).status).toBe('awaiting-payment')
  })
  it('deduplicates receipt bytes while preventing hash-based theft or forged file types', async () => {
    expect(await uploadReceipt(pool, stranger, receiptBody, 'another.pdf', 'application/pdf')).toBe(hash)
    expect((await pool.query('SELECT count(*)::int n FROM reimbursement_receipts')).rows[0].n).toBe(1)
    expect((await pool.query('SELECT count(*)::int n FROM reimbursement_receipt_owners')).rows[0].n).toBe(2)
    const { id, draft } = await validDraft()
    draft.lines.push({ ...draft.lines[0], id: randomUUID(), categoryId: 2, amountMinor: 1000 })
    await saveDraft(pool, claimant, id, 2, draft)
    await act(id, claimant, 'submit')
    const other = actor(8); const otherId = await createReport(pool, other)
    await expect(saveDraft(pool, other, otherId, 1, draft)).rejects.toMatchObject({ status: 403 })
    await expect(uploadReceipt(pool, claimant, Buffer.from('<html>bad</html>'), 'x.png', 'image/png')).rejects.toThrow('JPEG')
  })
  it('routes pending approvals to a new assignee and preserves an already received approval', async () => {
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    expect((await read(id, rc)).accountNumber).toBe('')
    expect((await read(id, finance)).accountNumber).toBe('12-1234-1234567-000')
    expect(await read(id, stranger)).toBeUndefined()
    await pool.query("UPDATE responsibility_centres SET approver_rock_person_id=6,approver_email='person6@example.com' WHERE id=1")
    expect(await read(id, rc)).toBeUndefined()
    await expect(actOnReport(pool, rc, id, { action: 'approve', version: (await read(id)).version })).rejects.toMatchObject({ status: 404 })
    await act(id, actor(6), 'approve')
    await pool.query('UPDATE responsibility_centres SET approver_rock_person_id=2 WHERE id=1')
    expect((await read(id)).status).toBe('finance-approval')
    expect((await read(id)).rcApproverId).toBe(6)
    expect((await read(id, rc)).permissions.approveRC).toBe(false)
    await act(id, finance, 'approve')
    expect((await read(id)).status).toBe('awaiting-payment')
    await expect(saveDraft(pool, claimant, id, (await read(id)).version, await read(id))).rejects.toMatchObject({ status: 403 })
  })
  it('preserves rejected report details while archiving and restores as a draft for fresh approvals', async () => {
    const { id } = await validDraft()
    await act(id, claimant, 'submit')
    await act(id, rc, 'reject', 'Please check the receipt')
    await expect(act(id, rc, 'archive')).rejects.toMatchObject({ status: 403 })
    await expect(act(id, finance, 'archive')).rejects.toMatchObject({ status: 403 })
    const rejected = await read(id)
    await act(id, claimant, 'archive')
    let report = await read(id)
    expect(isOlderReport(report)).toBe(true)
    expect(report.status).toBe('rejected')
    expect(report.history.find(item => item.action === 'reject')?.reason).toBe('Please check the receipt')
    expect(report.lines).toEqual(rejected.lines)
    expect((await pool.query("SELECT 1 FROM reimbursement_email_deliveries WHERE state IN ('pending','sending','failed')")).rowCount).toBe(0)
    await expect(actOnReport(pool, claimant, id, { action: 'restore', version: rejected.version })).rejects.toMatchObject({ status: 409 })
    await expect(act(id, claimant, 'archive')).rejects.toMatchObject({ status: 409 })
    await act(id, claimant, 'restore')
    expect(isArchivedReport(await read(id))).toBe(false)
    expect((await read(id)).status).toBe('draft')
    await act(id, claimant, 'archive')
    await expect(act(id, claimant, 'submit')).rejects.toMatchObject({ status: 403 })
    await act(id, claimant, 'restore')
    await act(id, claimant, 'submit')
    expect(isOlderReport(await read(id))).toBe(false)
    await act(id, rc, 'reject', 'Another correction')
    expect(isArchivedReport(await read(id))).toBe(false)
    expect((await read(id)).status).toBe('rejected')
  })
  it.each(['draft', 'rc-approval', 'finance-approval'] as const)('stops archived %s reports and reminders until restored and resubmitted', async status => {
    const { id } = await validDraft()
    if (status !== 'draft') await act(id, claimant, 'submit')
    if (status === 'finance-approval') await act(id, rc, 'approve')
    const before = await read(id)
    await act(id, claimant, 'archive')
    let report = await read(id)
    expect(isArchivedReport(report)).toBe(true)
    expect(report.permissions.edit).toBe(false)
    expect(report.permissions.withdraw).toBe(false)
    await expect(actOnReport(pool, claimant, id, { action: 'archive', version: before.version })).rejects.toMatchObject({ status: 409 })
    await expect(saveDraft(pool, claimant, id, report.version, report)).rejects.toMatchObject({ status: 403 })
    await expect(act(id, claimant, 'submit')).rejects.toMatchObject({ status: 403 })
    if (status !== 'draft') {
      const approver = status === 'rc-approval' ? rc : finance
      await expect(act(id, approver, 'approve')).rejects.toMatchObject({ status: 403 })
      expect((await read(id, approver)).permissions.approveRC).toBe(false)
      expect((await read(id, approver)).permissions.approveFinance).toBe(false)
    }
    const transport = vi.fn(async () => 'not sent')
    await reconcileReimbursementEmails(pool, transport, new Date(Date.now() + 4 * 86_400_000))
    expect(transport).not.toHaveBeenCalled()
    expect((await pool.query("SELECT 1 FROM reimbursement_email_deliveries WHERE state IN ('pending','sending','failed')")).rowCount).toBe(0)
    await act(id, claimant, 'restore')
    report = await read(id)
    expect(report.status).toBe('draft')
    expect(report.rcApproverId).toBeNull()
    expect(report.permissions.edit).toBe(true)
    await act(id, claimant, 'submit')
    expect((await read(id)).status).toBe('rc-approval')
    await reconcileReimbursementEmails(pool, transport)
    expect(transport).toHaveBeenCalled()
  })
  it('does not allow archiving approved or paid reports', async () => {
    const id = await approved()
    await expect(act(id, claimant, 'archive')).rejects.toMatchObject({ status: 403 })
    await markBatchPaid(pool, finance, { reports: [{ id, version: (await read(id)).version }] })
    await expect(act(id, claimant, 'archive')).rejects.toMatchObject({ status: 403 })
  })
  it('restarts the complete pipeline after a finance rejection or claimant withdrawal', async () => {
    const { id } = await validDraft(); await act(id, claimant, 'submit'); await act(id, rc, 'approve')
    await act(id, finance, 'reject', 'Please correct the amount')
    let report = await read(id)
    expect(report.status).toBe('rejected')
    expect(report.history.at(-1)?.reason).toBe('Please correct the amount')
    await saveDraft(pool, claimant, id, report.version, { ...report, lines: report.lines.map(line => ({ ...line, description: 'Corrected lunch' })) })
    await act(id, claimant, 'submit')
    report = await read(id)
    expect(report.revision).toBe(2); expect(report.status).toBe('rc-approval'); expect(report.rcApproverId).toBeNull()
    await expect(actOnReport(pool, finance, id, { action: 'approve', version: report.version })).rejects.toMatchObject({ status: 403 })
    expect(report.history.find(item => item.action === 'submit')?.snapshot?.lines[0].description).toBe('A portion of the lunch receipt')
    await act(id, rc, 'approve'); await act(id, claimant, 'withdraw')
    expect((await read(id)).status).toBe('draft'); expect((await read(id)).rcApproverId).toBeNull()
  })
  it('prevents self approval and requires a separate finance approver', async () => {
    await pool.query('UPDATE responsibility_centres SET approver_rock_person_id=1 WHERE id=1')
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    expect((await read(id)).permissions.approveRC).toBe(false)
    await act(id, senior, 'approve'); await act(id, finance, 'approve')
    expect((await read(id)).status).toBe('awaiting-payment')
    expect(approvalPerson({ id: 1, name: '', approverRockPersonId: 4, approverName: '', approverEmail: '' }, 4, settings)?.id).toBe(5)
    await pool.query('UPDATE responsibility_centres SET approver_rock_person_id=3 WHERE id=1')
    const next = await validDraft(); await act(next.id, claimant, 'submit'); await act(next.id, finance, 'approve')
    expect((await read(next.id, finance)).permissions.approveFinance).toBe(false)
  })
  it('rejects unassigned centres, stale directories, missing receipts and archived categories', async () => {
    const { id, draft } = await validDraft()
    await expect(saveDraft(pool, claimant, id, 2, { ...draft, centreId: 2 })).rejects.toThrow('assigned approver')
    await pool.query('UPDATE reimbursement_categories SET archived=true WHERE id=1')
    await expect(act(id, claimant, 'submit')).rejects.toThrow('active category')
    await pool.query('UPDATE reimbursement_categories SET archived=false WHERE id=1')
    await pool.query("UPDATE responsibility_centres SET last_synced_at=now()-interval '1 hour'")
    await expect(act(id, claimant, 'submit')).rejects.toThrow('eligible purpose approver')
    await pool.query("UPDATE reimbursement_finance_members SET last_synced_at=now()-interval '1 hour'")
    expect(await isFinance(pool, 3)).toBe(false)
  })
  it('only updates the signed-in person’s payment settings over HTTP', async () => {
    await saveProfile(pool, claimant, { accountName: 'Original', accountNumber: '12-1234-1234567-000' })
    runtime.pool.mockResolvedValue(pool)
    const profileRequest = (origin = 'https://ev.church') => new NextRequest('https://ev.church/api/reimbursements/profile', { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ accountName: 'Attempt', accountNumber: '' }) })
    runtime.actor.mockResolvedValue(null)
    expect((await handleReimbursementRequest(profileRequest(), ['profile'])).status).toBe(401)
    runtime.actor.mockResolvedValue(stranger)
    expect((await handleReimbursementRequest(profileRequest('https://evil.example'), ['profile'])).status).toBe(403)
    const request = new NextRequest('https://ev.church/api/reimbursements/profile', { method: 'PUT', headers: { origin: 'https://ev.church', 'content-type': 'application/json' }, body: JSON.stringify({ personId: claimant.personId, accountName: 'Stranger', accountNumber: '98-7654-7654321-000' }) })
    expect((await handleReimbursementRequest(request, ['profile'])).status).toBe(200)
    expect((await overview(pool, claimant)).defaults.accountName).toBe('Original')
    expect((await overview(pool, stranger)).defaults.accountName).toBe('Stranger')
  })
  it('keeps submitted bank details and category names independent of later defaults', async () => {
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    const other = await validDraft(); const report = await read(other.id)
    await saveProfile(pool, claimant, { accountName: 'New account', accountNumber: '98-7654-7654321-000' })
    await saveDraft(pool, claimant, other.id, report.version, { ...report, accountNumber: '11-1111-1111111-111' })
    expect((await overview(pool, claimant)).defaults.accountNumber).toBe('98-7654-7654321-000')
    await act(other.id, claimant, 'submit')
    expect((await read(other.id)).accountNumber).toBe('98-7654-7654321-000')
    const categories = (await overview(pool, finance)).categories.map(category => category.id === 1 ? { ...category, name: 'Renamed food' } : category)
    await configure(pool, finance, { settings, categories })
    expect((await read(id)).accountNumber).toBe('12-1234-1234567-000')
    expect((await read(id)).lines[0].categoryName).toBe('Food & hospitality')
    await expect(configure(pool, claimant, { settings, categories })).rejects.toMatchObject({ status: 403 })
    await configure(pool, finance, { settings, categories: categories.map(category => category.id === 1 ? { ...category, name: 'Food & hospitality' } : category) })
  })
  it('confirms payment with an audit event instead of payment metadata', async () => {
    const id = await approved()
    await markBatchPaid(pool, finance, { reports: [{ id, version: (await read(id)).version }] })
    const report = await read(id)
    expect(report.status).toBe('paid')
    expect(report.history.at(-1)).toMatchObject({ action: 'paid', personId: finance.personId, reason: '' })
    expect(report.history.at(-1)?.at).toBeTruthy()
    for (const field of ['paymentDate', 'paymentReference', 'paymentBatch', 'title']) expect(report).not.toHaveProperty(field)
  })
  it('confirms payments over HTTP without returning batch metadata', async () => {
    const id = await approved()
    await saveProfile(pool, finance, { accountName: 'Finance', accountNumber: '12-1234-1234567-000' })
    runtime.actor.mockResolvedValue(finance)
    const request = new NextRequest('https://example.com/api/reimbursements/payments', {
      method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ reports: [{ id, version: (await read(id)).version }] }),
    })
    const response = await handleReimbursementRequest(request, ['payments'])
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect((await read(id)).status).toBe('paid')
  })
  it('records batches atomically and rejects duplicate payment attempts and stale approvals', async () => {
    const first = await approved(), second = await approved()
    await expect(markBatchPaid(pool, finance, { reports: [{ id: first, version: (await read(first)).version }, { id: second, version: 1 }] })).rejects.toMatchObject({ status: 409 })
    expect((await read(first)).status).toBe('awaiting-payment')
    const commands = [first, second].map(async id => ({ id, version: (await read(id)).version }))
    const reports = await Promise.all(commands)
    await markBatchPaid(pool, finance, { reports })
    expect((await read(first)).status).toBe('paid'); expect((await read(second)).status).toBe('paid')
    await expect(markBatchPaid(pool, finance, { reports })).rejects.toMatchObject({ status: 409 })
    await expect(act(first, claimant, 'withdraw')).rejects.toMatchObject({ status: 403 })
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    const version = (await read(id)).version
    const results = await Promise.allSettled([actOnReport(pool, rc, id, { action: 'approve', version }), actOnReport(pool, rc, id, { action: 'approve', version })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  })
  it('emails the current assignee only, sends repeat reminders and keeps bank details off RC copies', async () => {
    const messages: ReimbursementEmail[] = []
    const send = vi.fn(async (message: ReimbursementEmail) => { messages.push(message); return randomUUID() })
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    await pool.query("UPDATE responsibility_centres SET approver_rock_person_id=6,approver_email='person6@example.com' WHERE id=1")
    await pool.query("UPDATE reimbursement_reports SET updated_at=now()-interval '5 days' WHERE id=$1", [id])
    await reconcileReimbursementEmails(pool, send)
    expect(messages.map(message => message.to)).toEqual(['person6@example.com'])
    await reconcileReimbursementEmails(pool, send)
    expect(messages).toHaveLength(1)
    await reconcileReimbursementEmails(pool, send, new Date(Date.now() + 2 * 86400000 + 1000))
    expect(messages).toHaveLength(2)
    await act(id, actor(6), 'approve'); await act(id, finance, 'approve')
    await reconcileReimbursementEmails(pool, send)
    const payment = messages.find(message => message.subject.includes('ready for payment'))!
    expect(payment.text).toContain('12-1234-1234567-000'); expect(payment.pdf?.subarray(0, 5).toString()).toBe('%PDF-')
    const rcCopy = messages.find(message => message.to === 'person6@example.com' && message.subject.includes('approved for payment'))!
    expect(rcCopy.text).not.toContain('12-1234'); expect(rcCopy.pdf).toBeDefined()
    await reconcileReimbursementEmails(pool, send)
    expect(messages.filter(message => message.to === claimant.email && message.subject.includes('approved'))).toHaveLength(1)
    await reconcileReimbursementEmails(pool, send, new Date(Date.now() + 7 * 86400000 + 1000))
    expect(messages.filter(message => message.to === settings.financeEmail && message.subject.includes('ready for payment'))).toHaveLength(2)
  })
  it('retries an immutable email and sends one simplified payment confirmation', async () => {
    const messages: ReimbursementEmail[] = []
    let failing = true
    const send = vi.fn(async (message: ReimbursementEmail) => { messages.push(message); if (failing) throw new Error('Temporary transport failure'); return randomUUID() })
    const id = await approved()
    await reconcileReimbursementEmails(pool, send)
    const original = messages.find(message => message.subject.includes('ready for payment'))!
    failing = false
    await reconcileReimbursementEmails(pool, send)
    const retries = messages.filter(message => message.subject.includes('ready for payment'))
    expect(retries).toHaveLength(2)
    expect(retries[1].pdf).toEqual(original.pdf)
    expect(retries[1].text).toBe(original.text)
    await markBatchPaid(pool, finance, { reports: [{ id, version: (await read(id)).version }] })
    await reconcileReimbursementEmails(pool, send)
    const remittances = messages.filter(message => message.subject.includes('remittance advice'))
    expect(remittances).toHaveLength(1)
    expect(remittances[0].text).toContain('Finance has confirmed payment')
    expect(remittances[0].text).not.toMatch(/Reference:|Batch:|Payment date:/)
  })
  it('cancels a payment email when the report changes during PDF preparation', async () => {
    const id = await approved()
    const query = pool.query.bind(pool)
    let changed = false
    const spy = vi.spyOn(pool, 'query').mockImplementation((...args: Parameters<typeof pool.query>) => {
      const result = query(...args)
      if (!changed && typeof args[0] === 'string' && args[0].startsWith('UPDATE reimbursement_email_deliveries SET payload=')) {
        changed = true
        return Promise.resolve(result).then(async value => {
          await markBatchPaid(pool, finance, { reports: [{ id, version: (await read(id)).version }] })
          return value
        })
      }
      return result
    })
    const send = vi.fn(async () => randomUUID())
    try { await reconcileReimbursementEmails(pool, send) } finally { spy.mockRestore() }
    expect(changed).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect((await pool.query("SELECT state FROM reimbursement_email_deliveries WHERE report_id=$1 AND kind='payment'", [id])).rows[0].state).toBe('cancelled')
  })
  it('revokes queued finance recipients and isolates an approver email configuration failure', async () => {
    const messages: ReimbursementEmail[] = []
    const send = async (message: ReimbursementEmail) => { messages.push(message); return randomUUID() }
    await approved()
    await configure(pool, finance, { settings: { ...settings, financeEmail: 'replacement@example.com' }, categories: (await overview(pool, finance)).categories })
    const pending = await validDraft(); await act(pending.id, claimant, 'submit')
    await pool.query("UPDATE responsibility_centres SET approver_email='' WHERE id=1")
    const warning = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try { await reconcileReimbursementEmails(pool, send) } finally { warning.mockRestore() }
    expect(messages.some(message => message.to === 'finance@example.com')).toBe(false)
    expect(messages.some(message => message.to === 'replacement@example.com' && message.text.includes('12-1234'))).toBe(true)
    expect(messages.some(message => message.to === 'person2@example.com')).toBe(false)
  })
  it('restores an unsent request when an approver returns, and exposes an interrupted final attempt', async () => {
    const messages: ReimbursementEmail[] = []
    const send = async (message: ReimbursementEmail) => { messages.push(message); return randomUUID() }
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    await pool.query("UPDATE responsibility_centres SET approver_rock_person_id=6,approver_email='person6@example.com' WHERE id=1")
    await reconcileReimbursementEmails(pool, send)
    await pool.query("UPDATE responsibility_centres SET approver_rock_person_id=2,approver_email='person2@example.com' WHERE id=1")
    await reconcileReimbursementEmails(pool, send)
    expect(messages.map(message => message.to)).toEqual(['person6@example.com', 'person2@example.com'])
    await act(id, rc, 'approve'); await act(id, finance, 'approve')
    await pool.query("UPDATE reimbursement_email_deliveries SET state='sending',attempts=6,lease_until=now()-interval '1 minute' WHERE report_id=$1 AND kind='payment'", [id])
    await reconcileReimbursementEmails(pool, send)
    expect(messages.some(message => message.subject.includes('ready for payment'))).toBe(false)
    expect((await overview(pool, finance)).notificationFailures).toEqual([expect.objectContaining({ subject: expect.stringContaining('ready for payment') })])
  })
  it('requires complete payment settings for claimants, reviewers and finance before report access', async () => {
    const { id } = await validDraft(); await act(id, claimant, 'submit')
    await pool.query('DELETE FROM reimbursement_profiles WHERE person_id=$1', [claimant.personId])
    const request = (path: string, method = 'GET', input?: unknown) => new NextRequest(`https://example.com/api/reimbursements${path}`, { method, headers: { origin: 'https://example.com', 'content-type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) })
    for (const who of [claimant, rc, finance]) {
      runtime.actor.mockResolvedValue(who)
      const response = await handleReimbursementRequest(request(''))
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.reports).toEqual([])
      expect(data.notificationFailures).toEqual([])
      for (const [path, method] of [[`/report/${id}`, 'POST'], [`/report/${id}`, 'PATCH'], [`/pdf/${id}`, 'GET'], [`/receipt/${hash}`, 'GET'], ['/receipt', 'POST'], ['/payments', 'POST'], ['', 'POST']]) {
        const result = await handleReimbursementRequest(request(path, method), path.split('/').filter(Boolean))
        expect(result.status).toBe(403)
        expect((await result.json()).error).toContain('Set up your payment settings')
      }
      expect((await handleReimbursementRequest(request('/profile', 'PUT', { accountName: 'Incomplete', accountNumber: '' }), ['profile'])).status).toBe(400)
      expect((await handleReimbursementRequest(request('/profile', 'PUT', { accountName: who.name, accountNumber: '12-1234-1234567-000' }), ['profile'])).status).toBe(200)
      expect((await (await handleReimbursementRequest(request(''))).json()).reports).toHaveLength(1)
    }
    runtime.actor.mockResolvedValue(rc)
    const review = await handleReimbursementRequest(request(`/report/${id}`, 'POST', { action: 'approve', version: (await read(id)).version }), ['report', id])
    expect(review.status).toBe(200)
    expect((await read(id)).status).toBe('finance-approval')
  })
  it('enforces login, origin, private downloads and receipt/report visibility at HTTP endpoints', async () => {
    const { id } = await validDraft()
    const request = (path: string, method = 'GET', origin = 'https://example.com') => new NextRequest(`https://example.com/api/reimbursements${path}`, { method, headers: { origin } })
    runtime.actor.mockResolvedValue(null)
    expect((await handleReimbursementRequest(request(''))).status).toBe(401)
    runtime.actor.mockResolvedValue(claimant)
    expect((await handleReimbursementRequest(request('', 'POST', 'https://evil.example'))).status).toBe(403)
    let response = await handleReimbursementRequest(request(`/receipt/${hash}`), ['receipt', hash])
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toContain('no-store')
    await saveProfile(pool, stranger, { accountName: 'Stranger', accountNumber: '12-1234-1234567-000' })
    runtime.actor.mockResolvedValue(stranger)
    response = await handleReimbursementRequest(request(`/receipt/${hash}`), ['receipt', hash])
    expect(response.status).toBe(404)
    expect((await handleReimbursementRequest(request(`/pdf/${id}`), ['pdf', id])).status).toBe(404)
    runtime.actor.mockResolvedValue(claimant)
    response = await handleReimbursementRequest(request(`/pdf/${id}`), ['pdf', id])
    expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toBe('application/pdf')
  })
})

it('calculates GST in cents and accepts either amount input without floating point money drift', () => {
  expect(parseMoney('100.05')).toBe(10005); expect(parseMoney('1.001')).toBeNull(); expect(parseMoney('-1')).toBeNull()
  expect(gstMinor(11500, true)).toBe(1500); expect(gstMinor(11500, false)).toBe(0); expect(gstMinor(1, true)).toBe(0)
})
