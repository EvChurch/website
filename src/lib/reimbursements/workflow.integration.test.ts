import { randomUUID } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SIMPLIFY_REIMBURSEMENTS_UP_SQL } from '@/migrations/20261017_030000_simplify_reimbursements'
import { REIMBURSEMENTS_UP_SQL } from '@/migrations/20261017_020000_reimbursements'
import { REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL } from '@/migrations/20261028_010000_reimbursement_payout_and_pastor_account'
import { REIMBURSEMENT_CAMPUS_UP_SQL } from '@/migrations/20261029_010000_reimbursement_campus'
import { actOnReport, configure, createReport, hasOpened, isFinance, markBatchPaid, openReimbursements, overview, saveDraft, saveProfile, uploadReceipt } from './store'
import { rejectionDetails, approvalPerson, isArchivedReport, isOlderReport, gstMinor, parseMoney, type Actor, type Draft, type Settings } from './model'
import { reconcileReimbursementEmails, type ReimbursementEmail } from './notifications'

const runtime = vi.hoisted(() => ({ actor: vi.fn(), pool: vi.fn() }))
vi.mock('./runtime', () => ({ reimbursementActor: runtime.actor, reimbursementPool: runtime.pool }))
import { handleReimbursementRequest } from './http'
import * as reimbursementApiV1 from '@/app/api/v1/reimbursements/[...path]/route'
import { createKey, updateKey } from '@/lib/api/test-fixtures'
import { API_UP_SQL } from '@/migrations/20261029_020000_api'
const rock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rock-api', () => ({ rockFetch: rock }))

const url = process.env.REIMBURSEMENT_TEST_DATABASE_URL
const actor = (personId: number, finance = false, admin = false): Actor => ({ personId, finance, admin, name: `Person ${personId}`, email: `person${personId}@example.com` })
const claimant = actor(1), rc = actor(2), finance = actor(3, true), stranger = actor(9), senior = actor(4), alternate = actor(5)
const settings: Settings = { minimumReportAmountMinor: 2500, seniorPersonId: 4, seniorName: 'Senior', seniorEmail: senior.email, alternatePersonId: 5, alternateName: 'Alternate', alternateEmail: alternate.email, financeEmail: 'finance@example.com' }
let pool: Pool
const schema = `reimbursement_test_${randomUUID().replaceAll('-', '')}`
let hash: string
let receiptBody: Buffer
async function read(id: string, who = claimant) { return (await overview(pool, who)).reports.find(report => report.id === id)! }
async function act(id: string, who: Actor, action: string, reason = '') { return actOnReport(pool, who, id, { action, reason, version: (await read(id, who)).version }) }
async function validDraft(who = claimant) {
  await saveProfile(pool, who, { accountName: 'Claimant account', accountNumber: '12-1234-1234567-000' })
  const id = await createReport(pool, who)
  const draft: Draft = { campusId: 1, centreId: 1, lines: [{ id: randomUUID(), date: '2026-10-15', description: 'A portion of the lunch receipt', categoryId: 1, amountMinor: 11500, hasGst: true, receiptHash: hash }] }
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
      CREATE TABLE campuses (id integer PRIMARY KEY, name text, is_active boolean, "order" integer);
      INSERT INTO campuses VALUES (1,'North',true,1),(2,'Central',true,2),(3,'Archived',false,3);
      CREATE TABLE responsibility_centres (id serial PRIMARY KEY, name text, approver_rock_person_id numeric, approver_name text, approver_email text, is_active boolean, last_synced_at timestamptz, sort_order integer, rock_id numeric, rock_guid varchar);
      CREATE TABLE reimbursement_finance_members (rock_person_id numeric, last_synced_at timestamptz);`)
    const client = await pool.connect()
    try { await client.query('BEGIN'); await client.query(REIMBURSEMENTS_UP_SQL); await client.query('COMMIT') } finally { client.release() }
    // The schema migration is repeatable without creating duplicate categories.
    await pool.query(REIMBURSEMENTS_UP_SQL)
    await pool.query(REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL)
    await pool.query(REIMBURSEMENT_CAMPUS_UP_SQL)
    await pool.query(REIMBURSEMENT_CAMPUS_UP_SQL)
    await pool.query(API_UP_SQL)
    await pool.query(API_UP_SQL)
    runtime.pool.mockResolvedValue(pool)
    process.env.APP_BASE_URL = 'https://example.com'
  })
  afterAll(async () => { if (pool) { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end() } })
  beforeEach(async () => {
    rock.mockImplementation(async ({endpoint}: {endpoint:string}) => { const id=Number(endpoint.split('/')[1]); return {Id:id,NickName:'Person',LastName:String(id),Email:`person${id}@example.com`} })
    await pool.query(`TRUNCATE api_audit,api_operations,api_keys,reimbursement_email_deliveries,reimbursement_reports,reimbursement_receipt_owners,reimbursement_receipts,reimbursement_profiles,responsibility_centres,reimbursement_finance_members CASCADE;
      INSERT INTO responsibility_centres(id,name,approver_rock_person_id,approver_name,approver_email,is_active,last_synced_at,sort_order)
        VALUES(1,'Hospitality',2,'RC Approver','person2@example.com',true,now(),1),(2,'Unassigned',NULL,NULL,NULL,true,now(),2);
      SELECT setval(pg_get_serial_sequence('responsibility_centres','id'),2);
      INSERT INTO reimbursement_finance_members VALUES(3,now()); UPDATE reimbursement_categories SET archived=false;`)
    await configure(pool, finance, { settings, categories: (await overview(pool, finance)).categories })
    const receipt = await PDFDocument.create()
    receipt.addPage().drawText('Synthetic receipt')
    receiptBody = Buffer.from(await receipt.save())
    hash = await uploadReceipt(pool, claimant, receiptBody, 'receipt.pdf', 'application/pdf')
    runtime.actor.mockResolvedValue(claimant)
  })

  async function api(secret: string, path: string, method:'GET'|'POST'|'PATCH'|'PUT'|'DELETE'='GET', body?:unknown, operationId='operation-1', extraHeaders:Record<string,string>={}) {
    return reimbursementApiV1[method](new NextRequest(`https://example.com/api/v1/reimbursements/${path}`,{method,headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/json','Idempotency-Key':operationId}:{}),...extraHeaders},body:body?JSON.stringify(body):undefined}),{params:Promise.resolve({path:path.split('?')[0].split('/')})})
  }
  async function key(personId=3, scopes:string[]=['reimbursements:reports:read','reimbursements:receipts:read','reimbursements:bank:read','reimbursements:reports:review','reimbursements:payments:confirm']) {
    return createKey(pool,99,{name:'Synthetic script',personId,scopes,expiresAt:null})
  }
  it('creates one-time hashed personal keys with configurable expiry and metadata-only audit', async()=>{
    const created=await key()
    expect(created.secret).toMatch(/^ev_api_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/)
    const stored=(await pool.query('SELECT * FROM api_keys WHERE id=$1',[created.key.id])).rows[0]
    expect(stored.secret_hash).toHaveLength(64);expect(stored.secret_hash).not.toContain(created.secret)
    expect(stored.expires_at).toBeNull()
    const defaultKey=await createKey(pool,99,{name:'Default expiry',personId:3,scopes:['reimbursements:reports:read']})
    expect(Date.parse(defaultKey.key.expiresAt!)-Date.now()).toBeGreaterThan(364*86400000)
    expect((await api('invalid','reports')).status).toBe(401)
    await pool.query("UPDATE api_keys SET expires_at=now()-interval '1 second' WHERE id=$1",[created.key.id])
    expect((await api(created.secret,'reports')).status).toBe(401)
    await updateKey(pool,99,created.key.id,{name:'Renewed',scopes:['reimbursements:reports:read'],expiresAt:null})
    expect((await api(created.secret,'reports')).status).toBe(200)
    await updateKey(pool,99,created.key.id,null,true)
    expect((await api(created.secret,'reports')).status).toBe(401)
    const audit=JSON.stringify((await pool.query('SELECT * FROM api_audit')).rows)
    expect(audit).not.toContain(created.secret);expect(audit).toContain('key.revoked')
  })
  it('paginates visible reports and gates bank details, receipts, PDFs, and history independently',async()=>{
    const first=await validDraft();await act(first.id,claimant,'submit')
    const second=await validDraft();await act(second.id,claimant,'submit')
    const readOnly=await key(3,['reimbursements:reports:read'])
    const page=await (await api(readOnly.secret,'reports?limit=1')).json()
    expect(page.data).toHaveLength(1);expect(page.nextCursor).toBeTruthy()
    expect(page.data[0].bankAccount).toBeNull();expect(page.data[0].pdfUrl).toBeNull();expect(page.data[0].expenses[0].receiptUrl).toBeNull()
    expect(JSON.stringify(page)).not.toContain(hash);expect(JSON.stringify(page)).not.toContain('12-1234-1234567-000')
    const next=await (await api(readOnly.secret,`reports?limit=1&cursor=${page.nextCursor}`)).json()
    expect(next.data).toHaveLength(1);expect(next.data[0].id).not.toBe(page.data[0].id);expect(next.nextCursor).toBeNull();expect(next.syncUntil).toBe(page.syncUntil)
    expect((await api(readOnly.secret,`reports?status=paid&cursor=${page.nextCursor}`)).status).toBe(400)
    expect((await api(readOnly.secret,`reports/${first.id}/receipts/${first.draft.lines[0].id}`)).status).toBe(403)
    expect((await api(readOnly.secret,`reports/${first.id}/pdf`)).status).toBe(403)
    const all=await key(), detail=await api(all.secret,`reports/${first.id}`), data=await detail.json()
    expect(data.bankAccount.number).toBe('12-1234-1234567-000')
    expect(data.pdfUrl).toBe(`/api/v1/reimbursements/reports/${first.id}/pdf`)
    expect(data.expenses[0].receiptUrl).toBe(`/api/v1/reimbursements/reports/${first.id}/receipts/${first.draft.lines[0].id}`)
    expect((await api(all.secret,`reports/${first.id}/receipts/${first.draft.lines[0].id}`)).status).toBe(200)
    expect((await api(all.secret,`reports/${first.id}/receipts/${randomUUID()}`)).status).toBe(404)
    expect((await api(all.secret,`reports/${first.id}/pdf`)).headers.get('content-type')).toBe('application/pdf')
    expect((await api(all.secret,`reports/${first.id}`,'GET',undefined,'unused',{'If-None-Match':detail.headers.get('etag')!})).status).toBe(304)
    const outsider=await key(9)
    expect((await api(outsider.secret,`reports/${first.id}`)).status).toBe(404)
    expect((await api(outsider.secret,`reports/${first.id}/pdf`)).status).toBe(404)
    const purpose=await key(2)
    expect((await (await api(purpose.secret,`reports/${first.id}`)).json()).bankAccount).toBeNull()
    await pool.query('DELETE FROM reimbursement_finance_members WHERE rock_person_id=3')
    expect((await api(all.secret,`reports/${first.id}`)).status).toBe(404)
  })
  it('executes approvals safely under concurrent identical retries and rejects collisions and stale decisions',async()=>{
    const {id}=await validDraft();await act(id,claimant,'submit')
    const purpose=await key(2), own=await key(1)
    const version=(await read(id)).version
    expect((await api(own.secret,`reports/${id}/approve`,'POST',{version})).status).toBe(403)
    expect((await api(purpose.secret,`reports/${id}/approve`,'POST',{version:version-1})).status).toBe(409)
    const responses=await Promise.all([api(purpose.secret,`reports/${id}/approve`,'POST',{version},'same'),api(purpose.secret,`reports/${id}/approve`,'POST',{version},'same')])
    expect(responses.map(response=>response.status)).toEqual([200,200]);expect(await responses[0].json()).toEqual(await responses[1].json())
    let report=await read(id)
    expect(report.history.filter(item=>item.action==='approve')).toHaveLength(1)
    expect(report.history.at(-1)?.apiKey).toEqual({id:purpose.key.id,name:'Synthetic script'})
    expect((await api(purpose.secret,`reports/${id}/reject`,'POST',{version,reason:'Different request'},'same')).status).toBe(409)
    await updateKey(pool,99,purpose.key.id,{name:'Restricted',scopes:['reimbursements:reports:read'],expiresAt:null})
    expect((await api(purpose.secret,`reports/${id}/approve`,'POST',{version},'same')).status).toBe(403)
    const financeKey=await key()
    expect((await api(financeKey.secret,`reports/${id}/approve`,'POST',{version:report.version})).status).toBe(200)
    report=await read(id);expect(report.status).toBe('awaiting-payment')
    expect((await pool.query("SELECT count(*)::int AS count FROM reimbursement_email_deliveries WHERE report_id=$1 AND kind='payment'",[id])).rows[0].count).toBe(1)
  })
  it('records individual and atomic batch payments with no duplicate history or notifications',async()=>{
    const id=await approved(), second=await approved(), created=await key()
    const a={id,version:(await read(id)).version},b={id:second,version:(await read(second)).version}
    const before=(await pool.query('SELECT count(*)::int AS count FROM reimbursement_email_deliveries')).rows[0].count
    expect((await api(created.secret,'payments/confirm','POST',{reports:[a,{...b,version:b.version-1}]},'batch')).status).toBe(409)
    expect((await read(id)).status).toBe('awaiting-payment');expect((await read(second)).status).toBe('awaiting-payment')
    expect((await pool.query('SELECT count(*)::int AS count FROM reimbursement_email_deliveries')).rows[0].count).toBe(before)
    for(let attempt=0;attempt<2;attempt++) expect((await api(created.secret,'payments/confirm','POST',{reports:[a,b]},'batch')).status).toBe(200)
    expect((await read(id)).history.filter(item=>item.action==='paid')).toHaveLength(1)
    expect((await pool.query("SELECT count(*)::int AS count FROM reimbursement_email_deliveries WHERE kind='paid'")).rows[0].count).toBe(2)
    const third=await approved()
    expect((await api(created.secret,'payments/confirm','POST',{reports:[{id:third,version:(await read(third)).version}]},'single')).status).toBe(200)
    await pool.query('DELETE FROM reimbursement_finance_members WHERE rock_person_id=3')
    expect((await api(created.secret,'payments/confirm','POST',{reports:[a,b]},'batch')).status).toBe(403)
  })
  it('preserves whole-report rejection with flags and blocks payment before approval',async()=>{
    const {id,draft}=await validDraft();await act(id,claimant,'submit')
    const purpose=await key(2),financeKey=await key(),version=(await read(id)).version
    expect((await api(purpose.secret,`reports/${id}/reject`,'POST',{version,reason:'Explain the event',rejectedLineIds:[draft.lines[0].id]})).status).toBe(200)
    const report=await read(id);expect(report.status).toBe('rejected');expect(report.history.at(-1)?.rejectedLines?.[0].id).toBe(draft.lines[0].id)
    expect((await api(financeKey.secret,'payments/confirm','POST',{reports:[{id,version:report.version}]})).status).toBe(409)
    await act(id,claimant,'submit');expect((await read(id)).status).toBe('rc-approval')
  })
  it('rejects cookie-only access, oversized and malformed writes, and unexposed actions',async()=>{
    const created=await key(),{id}=await validDraft();await act(id,claimant,'submit')
    expect((await api('', 'reports','GET',undefined,'unused',{Authorization:'',Cookie:'session=browser-session'})).status).toBe(401)
    expect((await api(created.secret,`reports/${id}/approve`,'POST',{version:3},'missing',{'Idempotency-Key':''})).status).toBe(400)
    expect((await api(created.secret,`reports/${id}/approve`,'POST',{version:3},'bad-type',{'Content-Type':'text/plain'})).status).toBe(415)
    expect((await api(created.secret,`reports/${id}/approve`,'POST',{version:3,reason:'x'.repeat(66000)},'too-large')).status).toBe(413)
    expect((await api(created.secret,`reports/${id}/submit`,'POST',{version:3},'submit')).status).toBe(404)
    expect((await api(created.secret,`reports/${id}`,'PATCH',{version:3,draft:{}},'edit')).status).toBe(404)
    expect((await api(created.secret,'reports?limit=101')).status).toBe(400)
    expect((await api(created.secret,'reports?limit=1&limit=2')).status).toBe(400)
    expect((await api(created.secret,'reports?cursor=bad')).status).toBe(400)
    expect((await read(id)).status).toBe('rc-approval')
  })
  it('enforces rate limits and fails closed on identity lookup failures',async()=>{
    const created=await key()
    await pool.query('UPDATE api_keys SET rate_count=120 WHERE id=$1',[created.key.id])
    const limited=await api(created.secret,'reports');expect(limited.status).toBe(429);expect(limited.headers.get('retry-after')).toBe('60')
    await pool.query("UPDATE api_keys SET rate_window=now()-interval '2 minutes' WHERE id=$1",[created.key.id])
    expect((await api(created.secret,'reports')).status).toBe(200)
    rock.mockRejectedValueOnce(new Error('Unavailable'))
    expect((await api(created.secret,'reports')).status).toBe(503)
  })
  it('requires an active campus at submission and preserves historical campus names', async () => {
    const { id, draft } = await validDraft()
    expect((await overview(pool, claimant)).campuses.map(campus => campus.name)).toEqual(['North', 'Central'])
    await saveDraft(pool, claimant, id, 2, { ...draft, campusId: null })
    await expect(act(id, claimant, 'submit')).rejects.toThrow('Choose a campus')
    for (const campusId of [3, 999]) await expect(saveDraft(pool, claimant, id, 3, { ...draft, campusId })).rejects.toThrow('active campus')
    await saveDraft(pool, claimant, id, 3, { ...draft, campusId: 2 })
    await act(id, claimant, 'submit')
    expect(await read(id)).toMatchObject({ campusId: 2, campusName: 'Central' })
    expect((await read(id)).history[0].snapshot).toMatchObject({ campusId: 2, campusName: 'Central' })
    await pool.query(REIMBURSEMENT_CAMPUS_UP_SQL)
    expect((await read(id)).campusName).toBe('Central')
    expect((await pool.query("SELECT body FROM reimbursement_email_deliveries WHERE report_id=$1 AND kind='rc'", [id])).rows[0].body).toContain('Campus: Central')
  })
  it.each(['purpose', 'finance'])('returns the whole report for %s rejection with optional line flags and restarts all approvals', async stage => {
    const { id, draft } = await validDraft()
    const second = { ...draft.lines[0], id: randomUUID(), description: 'Second expense reason' }
    await saveDraft(pool, claimant, id, 2, { ...draft, lines: [...draft.lines, second] })
    await act(id, claimant, 'submit')
    if (stage === 'finance') await act(id, rc, 'approve')
    const reviewer = stage === 'finance' ? finance : rc
    const version = (await read(id, reviewer)).version
    await expect(actOnReport(pool, stranger, id, { action: 'reject', version, reason: 'No', rejectedLineIds: [second.id] })).rejects.toMatchObject({ status: 404 })
    for (const rejectedLineIds of [[randomUUID()], [second.id, second.id]]) {
      await expect(actOnReport(pool, reviewer, id, { action: 'reject', version, reason: 'Check this', rejectedLineIds })).rejects.toThrow('Select expenses from this report only')
    }
    await expect(actOnReport(pool, reviewer, id, { action: 'approve', version, rejectedLineIds: [second.id] })).rejects.toThrow('only available when rejecting')
    await expect(actOnReport(pool, reviewer, id, { action: 'reject', version, rejectedLineIds: [second.id] })).rejects.toThrow('Give a reason')
    await actOnReport(pool, reviewer, id, { action: 'reject', version, reason: 'Please clarify the event.', rejectedLineIds: [second.id] })
    let report = await read(id)
    expect(report.status).toBe('rejected')
    expect(report.lines).toHaveLength(2)
    expect(rejectionDetails(report)?.rejectedLines).toEqual([{ id: second.id, number: 2, description: 'Second expense reason' }])
    await expect(markBatchPaid(pool, finance, { reports: [{ id, version: report.version }] })).rejects.toMatchObject({ status: 409 })
    const email = (await pool.query("SELECT body FROM reimbursement_email_deliveries WHERE report_id=$1 AND kind='rejected'", [id])).rows[0].body
    expect(email).toContain('Expenses flagged: 2. Second expense reason')
    await saveDraft(pool, claimant, id, report.version, { ...report, lines: report.lines.map(line => ({ ...line, description: 'Corrected reason' })) })
    await act(id, claimant, 'submit')
    report = await read(id)
    expect(report.status).toBe('rc-approval')
    expect(report.rcApproverId).toBeNull()
    expect(rejectionDetails(report)).toBeUndefined()
    expect(report.history.find(item => item.action === 'reject')?.rejectedLines?.[0].description).toBe('Second expense reason')
    await act(id, rc, 'reject', 'Wrong purpose for the whole report.')
    expect(rejectionDetails(await read(id))?.rejectedLines).toEqual([])
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
  it('saves below the minimum, blocks submission without side effects, and accepts the exact combined total', async () => {
    const { id, draft } = await validDraft()
    const below = { ...draft, lines: [{ ...draft.lines[0], amountMinor: 2499 }] }
    await saveDraft(pool, claimant, id, 2, below)
    await expect(act(id, claimant, 'submit')).rejects.toThrow('at least $25.00')
    expect(await read(id)).toMatchObject({ status: 'draft', version: 3, history: [], lines: [{ amountMinor: 2499 }] })
    expect((await pool.query('SELECT * FROM reimbursement_email_deliveries WHERE report_id=$1', [id])).rows).toHaveLength(0)
    await saveDraft(pool, claimant, id, 3, { ...draft, lines: [{ ...draft.lines[0], amountMinor: 1250 }, { ...draft.lines[0], id: randomUUID(), amountMinor: 1250 }] })
    await act(id, claimant, 'submit')
    expect((await read(id)).status).toBe('rc-approval')
  })
  it('uses the current global minimum for submissions and resubmissions', async () => {
    const { id, draft } = await validDraft()
    const categories = (await overview(pool, finance)).categories
    await configure(pool, finance, { settings: { ...settings, minimumReportAmountMinor: 12000 }, categories })
    expect((await overview(pool, claimant)).minimumReportAmountMinor).toBe(12000)
    await expect(act(id, claimant, 'submit')).rejects.toThrow('at least $120.00')
    await configure(pool, finance, { settings: { ...settings, minimumReportAmountMinor: 11500 }, categories })
    await act(id, claimant, 'submit')
    await act(id, rc, 'reject', 'Please correct this report.')
    await configure(pool, finance, { settings: { ...settings, minimumReportAmountMinor: 12000 }, categories })
    await saveDraft(pool, claimant, id, (await read(id)).version, draft)
    await expect(act(id, claimant, 'submit')).rejects.toThrow('at least $120.00')
  })
  it('defaults existing settings to $25 and validates minimum settings', async () => {
    await pool.query("UPDATE reimbursement_settings SET data=data-'minimumReportAmountMinor' WHERE id=1")
    expect((await overview(pool, claimant)).minimumReportAmountMinor).toBe(2500)
    const categories = (await overview(pool, finance)).categories
    for (const minimumReportAmountMinor of [-1, 0.5, 100_000_001]) {
      await expect(configure(pool, finance, { settings: { ...settings, minimumReportAmountMinor }, categories })).rejects.toThrow()
    }
    await configure(pool, finance, { settings: { ...settings, minimumReportAmountMinor: 0 }, categories })
    expect((await overview(pool, claimant)).minimumReportAmountMinor).toBe(0)
  })
  it('submits reports without a title', async () => {
    const { id, draft } = await validDraft()
    await saveDraft(pool, claimant, id, 2, draft)
    await act(id, claimant, 'submit')
    expect((await read(id)).status).toBe('rc-approval')
    expect(await read(id)).not.toHaveProperty('title')
  })
  it('adds one shared finance-only purpose idempotently without changing existing reports', async () => {
    const { id } = await validDraft()
    const before = await read(id)
    await pool.query(REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL)
    await pool.query(REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL)
    const centres = (await overview(pool, claimant)).centres.filter(centre => centre.name === 'Pastor Expense Account')
    expect(centres).toHaveLength(1)
    expect(centres[0]).toMatchObject({ financeOnly: true, approverRockPersonId: null })
    expect(await read(id)).toEqual(before)
    await pool.query("UPDATE responsibility_centres SET last_synced_at=now()-interval '1 day'")
    expect((await overview(pool, stranger)).centres.map(centre => centre.id)).toEqual([centres[0].id])
  })
  it('routes shared Pastor Expense Account claims straight to finance, including resubmissions', async () => {
    await pool.query(REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL)
    const centre = (await overview(pool, claimant)).centres.find(centre => centre.financeOnly)!
    const { id, draft } = await validDraft()
    await saveDraft(pool, claimant, id, 2, { ...draft, centreId: centre.id })
    await act(id, claimant, 'submit')
    expect(await read(id)).toMatchObject({ status: 'finance-approval', rcApproverId: null })
    expect(await read(id, rc)).toBeUndefined()
    expect((await pool.query('SELECT kind FROM reimbursement_email_deliveries WHERE report_id=$1', [id])).rows).toEqual([{ kind: 'finance' }])
    await act(id, finance, 'reject', 'Please clarify the description')
    await act(id, claimant, 'submit')
    expect((await read(id)).status).toBe('finance-approval')
    await act(id, finance, 'approve')
    expect((await read(id)).status).toBe('awaiting-payment')
    expect((await pool.query("SELECT 1 FROM reimbursement_email_deliveries WHERE report_id=$1 AND kind='rc-payment'", [id])).rowCount).toBe(0)
    await markBatchPaid(pool, finance, { reports: [{ id, version: (await read(id)).version }] })
    expect((await read(id)).status).toBe('paid')
  })
  it('prevents finance claimants approving their own finance-only claims', async () => {
    await pool.query(REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL)
    await uploadReceipt(pool, finance, receiptBody, 'receipt.pdf', 'application/pdf')
    const centre = (await overview(pool, finance)).centres.find(centre => centre.financeOnly)!
    const { id, draft } = await validDraft(finance)
    await saveDraft(pool, finance, id, 2, { ...draft, centreId: centre.id })
    await act(id, finance, 'submit')
    expect((await read(id, finance)).permissions.approveFinance).toBe(false)
    await expect(act(id, finance, 'approve')).rejects.toMatchObject({ status: 403 })
    await act(id, actor(8, true), 'approve')
    expect((await read(id, finance)).status).toBe('awaiting-payment')
  })
  it.each(['', '12-', '1212341234567000', '12-1234-1234567-0', '12-1234-1234567-0000', '12-1234-1234567-00x'])('rejects an invalid bank number before saving either profile or override: %s', async accountNumber => {
    const { id, draft } = await validDraft()
    await expect(saveProfile(pool, claimant, { accountName: 'Changed', accountNumber })).rejects.toThrow()
    await expect(saveDraft(pool, claimant, id, 2, { ...draft, payoutOverride: { accountName: 'Other', accountNumber } })).rejects.toThrow()
    expect((await read(id)).payoutOverride).toBeNull()
    expect((await overview(pool, claimant)).defaults.accountNumber).toBe('12-1234-1234567-000')
  })
  it.each(['12-1234-1234567-00', '12-1234-1234567-000'])('saves and submits either bank suffix length: %s', async accountNumber => {
    const { id, draft } = await validDraft()
    await saveProfile(pool, claimant, { accountName: 'Claimant account', accountNumber })
    await saveDraft(pool, claimant, id, 2, { ...draft, payoutOverride: { accountName: 'Other', accountNumber } })
    await act(id, claimant, 'submit')
    expect((await read(id)).accountNumber).toBe(accountNumber)
  })
  it('keeps report payout overrides private and independent of saved payment settings', async () => {
    const { id, draft } = await validDraft()
    const payoutOverride = { accountName: 'Custom reimbursement account', accountNumber: '98-7654-7654321-000' }
    await saveDraft(pool, claimant, id, 2, { ...draft, payoutOverride })
    await act(id, claimant, 'submit')
    expect(await read(id)).toMatchObject({ ...payoutOverride, payoutOverride })
    expect(await read(id, rc)).toMatchObject({ accountName: '', accountNumber: '', payoutOverride: null })
    expect(await read(id, finance)).toMatchObject(payoutOverride)
    expect((await overview(pool, claimant)).defaults.accountName).toBe('Claimant account')
    await saveProfile(pool, claimant, { accountName: 'New default', accountNumber: '11-1111-1111111-111' })
    expect(await read(id)).toMatchObject(payoutOverride)
    await act(id, claimant, 'withdraw')
    await act(id, claimant, 'submit')
    expect(await read(id)).toMatchObject(payoutOverride)
    await act(id, claimant, 'withdraw')
    await saveDraft(pool, claimant, id, (await read(id)).version, { ...draft, payoutOverride: null })
    await act(id, claimant, 'submit')
    expect(await read(id)).toMatchObject({ accountName: 'New default', accountNumber: '11-1111-1111111-111', payoutOverride: null })
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
    await pool.query(REIMBURSEMENT_CAMPUS_UP_SQL)
    await pool.query(REIMBURSEMENT_CAMPUS_UP_SQL)
    await pool.query(API_UP_SQL)
    await pool.query(API_UP_SQL)
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
