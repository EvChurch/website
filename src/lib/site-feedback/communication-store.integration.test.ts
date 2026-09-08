import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FEEDBACK_COMMUNICATIONS_SQL } from '@/migrations/20260908_150000_feedback_communications'
import { deliverFeedbackCommunication, feedbackCommunicationHistory, prepareFeedbackCommunication, reconcileFeedbackCommunications } from './communication-store'
import type { CommunicationItem } from './communication'

const connectionString = process.env.FEEDBACK_COMMUNICATION_TEST_DATABASE_URL
const schema = `feedback_email_test_${randomUUID().replaceAll('-', '')}`
const suite = connectionString ? describe : describe.skip
let pool: Pool
let admin: Pool
const item = (id: number, kind: CommunicationItem['kind'] = 'finished'): CommunicationItem => ({
  feedbackId: id, kind, title: 'Website feedback', message: 'This is now fixed. Thank you for letting us know.',
})
const prepare = (items: CommunicationItem[]) => prepareFeedbackCommunication(pool, { items }, 'website@ev.church')

suite('durable feedback communications (isolated PostgreSQL schema)', () => {
  beforeAll(async () => {
    const url = new URL(connectionString!)
    if (url.hostname || url.searchParams.get('host') !== '/var/run/postgresql' ||
      url.pathname !== '/evchurch_dev_wt_feedback_stakeholder_emails') throw new Error('Local feedback test database required')
    admin = new Pool({ connectionString })
    await admin.query(`CREATE SCHEMA ${schema}`)
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` })
    await pool.query(`CREATE TABLE feedback_submissions (id integer PRIMARY KEY, email text,
      resolution_status text, triaged_at timestamptz, delivery_phase text, delivery_verification_result text);
      CREATE TABLE payload_mcp_api_keys (id integer, feedback_submissions_find boolean, feedback_submissions_update boolean);
      INSERT INTO payload_mcp_api_keys VALUES (1, true, true), (2, true, false);
      CREATE TYPE enum_payload_jobs_task_slug AS ENUM ('other');
      CREATE TYPE enum_payload_jobs_log_task_slug AS ENUM ('other');`)
    await pool.query(FEEDBACK_COMMUNICATIONS_SQL)
    await pool.query(FEEDBACK_COMMUNICATIONS_SQL)
    await pool.query(`INSERT INTO feedback_submissions SELECT n, 'person@example.com', 'resolved', now(), 'verified', 'passed'
      FROM generate_series(1, 30) n`)
  })
  afterAll(async () => {
    await pool?.end()
    if (admin) {
      await admin.query(`DROP SCHEMA ${schema} CASCADE`)
      await admin.end()
    }
  })
  it('grants tool permissions only to existing feedback readers/writers', async () => {
    const result = await pool.query('SELECT payload_mcp_tool_send_feedback_update FROM payload_mcp_api_keys ORDER BY id')
    expect(result.rows.map(row => row.payload_mcp_tool_send_feedback_update)).toEqual([true, false])
  })
  it('concurrent requests reserve one outcome and send only once', async () => {
    const ids = await Promise.all([prepare([item(1)]), prepare([item(1)])])
    expect(ids[0]).toBe(ids[1])
    const send = vi.fn().mockResolvedValue({ providerId: 'provider-1' })
    await Promise.all(ids.map(id => deliverFeedbackCommunication(pool, id, { send })))
    expect(send).toHaveBeenCalledTimes(1)
    const history = await feedbackCommunicationHistory(pool, 1)
    expect(history).toHaveLength(1)
    expect(history[0].status).toBe('sent')
    expect(history[0].provider_id).toBe('provider-1')
  })
  it('keeps a combined email immutable and does not resend for overlapping groups', async () => {
    const id = await prepare([item(2), item(3)])
    expect(await prepare([{ ...item(2), message: 'Changed after first request' }])).toBe(id)
    await expect(prepare([item(3), item(4)])).rejects.toThrow('already have an email')
    expect(await feedbackCommunicationHistory(pool, 4)).toHaveLength(0)
    const history = await feedbackCommunicationHistory(pool, 2)
    expect(history[0].message.text).not.toContain('Changed after first request')
  })
  it('finished and closed share one outcome slot, even after reopening', async () => {
    const id = await prepare([item(5)])
    await pool.query("UPDATE feedback_submissions SET resolution_status = 'wont-fix' WHERE id = 5")
    expect(await prepare([item(5, 'closed')])).toBe(id)
    await pool.query("UPDATE feedback_submissions SET resolution_status = 'planned' WHERE id = 5")
    await expect(prepare([item(5, 'triaged')])).rejects.toThrow('outcome email already')
  })
  it('allows one triaged acknowledgement followed by one finished email', async () => {
    await pool.query("UPDATE feedback_submissions SET resolution_status = 'planned' WHERE id = 6")
    await prepare([item(6, 'triaged')])
    await pool.query("UPDATE feedback_submissions SET resolution_status = 'resolved' WHERE id = 6")
    await prepare([item(6)])
    expect((await feedbackCommunicationHistory(pool, 6)).map(row => row.stage).sort()).toEqual(['outcome', 'triaged'])
  })
  it('rolls back a mixed-recipient batch without reserving or sending anything', async () => {
    await pool.query("UPDATE feedback_submissions SET email = 'other@example.com' WHERE id = 8")
    await expect(prepare([item(7), item(8)])).rejects.toThrow('same submitter')
    expect(await feedbackCommunicationHistory(pool, 7)).toHaveLength(0)
    expect(await feedbackCommunicationHistory(pool, 8)).toHaveLength(0)
  })
  it('retries failures using the same immutable provider request and idempotency key', async () => {
    const id = await prepare([item(9)])
    const now = new Date(Date.now() + 100)
    const send = vi.fn().mockRejectedValueOnce(new Error('secret provider detail')).mockResolvedValue({ providerId: 'provider-9' })
    const failed = await deliverFeedbackCommunication(pool, id, { send }, now)
    expect(failed.status).toBe('pending')
    expect(failed.error).not.toContain('secret')
    await deliverFeedbackCommunication(pool, id, { send }, now)
    expect(send).toHaveBeenCalledTimes(1)
    const result = await deliverFeedbackCommunication(pool, id, { send }, new Date(now.getTime() + 61_000))
    expect(result.status).toBe('sent')
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1])
  })
  it('preserves the lease after provider acceptance if saving the result fails', async () => {
    const id = await prepare([item(14)])
    await pool.query(`CREATE FUNCTION fail_sent_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.status = 'sent' THEN RAISE EXCEPTION 'simulated database failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_sent_update BEFORE UPDATE ON feedback_communications FOR EACH ROW EXECUTE FUNCTION fail_sent_update()`)
    const send = vi.fn().mockResolvedValue({ providerId: 'provider-14' })
    await expect(deliverFeedbackCommunication(pool, id, { send })).rejects.toThrow('simulated database failure')
    expect((await feedbackCommunicationHistory(pool, 14))[0].status).toBe('sending')
    await pool.query('DROP TRIGGER fail_sent_update ON feedback_communications')
    await pool.query("UPDATE feedback_communications SET lease_expires_at = now() - interval '1 minute' WHERE id = $1", [id])
    expect((await deliverFeedbackCommunication(pool, id, { send })).status).toBe('sent')
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1])
  })
  it('does not send a delayed triage email after resolution or to a changed recipient', async () => {
    await pool.query("UPDATE feedback_submissions SET resolution_status = 'planned' WHERE id = 12")
    const triage = await prepare([item(12, 'triaged')])
    await pool.query("UPDATE feedback_submissions SET resolution_status = 'resolved' WHERE id = 12")
    const changed = await prepare([item(13)])
    await pool.query("UPDATE feedback_submissions SET email = 'changed@example.com' WHERE id = 13")
    const send = vi.fn()
    expect((await deliverFeedbackCommunication(pool, triage, { send })).status).toBe('failed')
    expect((await deliverFeedbackCommunication(pool, changed, { send })).status).toBe('failed')
    expect(send).not.toHaveBeenCalled()
  })
  it('recovers an expired lease with the same key and stops outside the safe window', async () => {
    const id = await prepare([item(10)])
    await pool.query(`UPDATE feedback_communications SET status = 'sending', attempts = 1,
      first_attempt_at = now() - interval '10 minutes', lease_expires_at = now() - interval '1 minute'
      WHERE id = $1`, [id])
    const send = vi.fn().mockResolvedValue({ providerId: 'provider-10' })
    expect((await deliverFeedbackCommunication(pool, id, { send })).status).toBe('sent')
    expect(send.mock.calls[0][1]).toBe(`feedback-communication/${id}`)
    const expired = await prepare([item(11)])
    await pool.query(`UPDATE feedback_communications SET first_attempt_at = now() - interval '24 hours' WHERE id = $1`, [expired])
    expect((await deliverFeedbackCommunication(pool, expired, { send })).status).toBe('pending')
    // Stop all unsent fixtures so reconciliation cannot contact a real provider.
    await pool.query("UPDATE feedback_communications SET first_attempt_at = now() - interval '24 hours' WHERE status = 'pending'")
    await reconcileFeedbackCommunications(pool)
    expect((await feedbackCommunicationHistory(pool, 11))[0].status).toBe('failed')
    expect(send).toHaveBeenCalledTimes(1)
  })
})
