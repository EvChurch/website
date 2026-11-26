import { createHash, randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { Auth0Identity } from '@/auth/auth0-identity'
import { getPayloadClient } from '@/lib/payload'
import { createResendSiteFeedbackTransport, type SiteFeedbackNotificationTransport } from '@/lib/site-feedback/notification'
import { coursePostgresPool } from './postgres'
import { findPublishedCourse, latestCourseEdition } from './service'
import { completedLessonIds, readCourseSnapshot } from './model'

export interface CourseGroupRow { id: number; name: string; edition_id: number; facilitator_key: string; status: 'active' | 'closed' }
export interface GroupMemberRow { id: number; account_key: string; display_name: string | null; membership_status: 'active' | 'left' | 'removed'; completed_lesson_ids: unknown; completed_at: string | null }
export interface InvitationRow { id: number; group_id: number; email: string; expires_at: Date | string; status: 'pending' | 'accepted' | 'revoked'; delivery_status: string }

export function invitationTokenHash(token: string) {
  return createHash('sha256').update(`course-invitation-v1:${token}`).digest('hex')
}
export function normalizeInvitationEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  return email
}
function validId(id: number) { if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Group not found.') }
async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await coursePostgresPool(await getPayloadClient()).connect()
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
export async function lockCourseGroup(client: Pick<PoolClient, 'query'>, groupId: number): Promise<CourseGroupRow> {
  validId(groupId)
  const result = await client.query<CourseGroupRow>('SELECT * FROM course_groups WHERE id=$1 FOR UPDATE', [groupId])
  if (!result.rows[0]) throw new Error('Group not found.')
  return result.rows[0]
}
export async function requireGroupMember(client: Pick<PoolClient, 'query'>, identity: Auth0Identity, groupId: number) {
  const result = await client.query<GroupMemberRow>('SELECT * FROM course_attempts WHERE group_id=$1 AND account_key=$2 AND membership_status=\'active\'', [groupId, identity.identityKey])
  if (!result.rows[0]) throw new Error('Group not found.')
  return result.rows[0]
}
function requireFacilitator(group: CourseGroupRow, identity: Auth0Identity, active = true) {
  if (group.facilitator_key !== identity.identityKey || active && group.status !== 'active') throw new Error('Group management is unavailable.')
}

async function requireOpenCourse(client: Pick<PoolClient, 'query'>, editionId: number) {
  const open = await client.query(`SELECT c.id FROM course_editions e JOIN courses c ON c.id=e.course_id WHERE e.id=$1 AND c._status='published' AND c.enrolment_open=true FOR SHARE OF c`, [editionId])
  if (!open.rowCount) throw new Error('Invitation is unavailable.')
}

export async function startCourseGroup(identity: Auth0Identity, slug: string, inputName: string) {
  const name = inputName.trim() || 'My course group'
  if (name.length > 80) throw new Error('Use a shorter group name.')
  const course = await findPublishedCourse(slug)
  if (!course || !course.enrolmentOpen || course.allowGroup === false) throw new Error('Group enrolment is closed.')
  const edition = await latestCourseEdition(course.id)
  if (!edition) throw new Error('Course not available.')
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`course-start:${identity.identityKey}`])
    const starts = await client.query<{ count: string }>("SELECT count(*) FROM course_groups WHERE facilitator_key=$1 AND created_at>now()-interval '1 hour'", [identity.identityKey])
    if (Number(starts.rows[0].count) >= 10) throw new Error('Too many groups. Try again later.')
    // A course may close while the start page is open.
    const available = await client.query('SELECT id FROM courses WHERE id=$1 AND _status=\'published\' AND enrolment_open=true AND allow_group=true FOR SHARE', [course.id])
    if (!available.rowCount) throw new Error('Group enrolment is closed.')
    const created = await client.query<CourseGroupRow>(`INSERT INTO course_groups (name,edition_id,facilitator_key,status,created_at,updated_at) VALUES ($1,$2,$3,'active',now(),now()) RETURNING *`, [name, edition.id, identity.identityKey])
    const group = created.rows[0]
    await client.query(`INSERT INTO course_attempts (account_key,edition_id,mode,group_id,membership_status,display_name,completed_lesson_ids,created_at,updated_at) VALUES ($1,$2,'group',$3,'active',$4,'[]'::jsonb,now(),now())`, [identity.identityKey, edition.id, group.id, identity.name])
    return group.id
  })
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!) }
export function buildCourseInvitation(email: string, groupName: string, courseTitle: string, url: string) {
  return { to: email, subject: `Join ${courseTitle}`, text: `You're invited to ${groupName}.\n\nJoin ${courseTitle}: ${url}\n\nSign in with this email address. This invitation expires in seven days. Shared answers are visible to group members, including people who join later.`, html: `<div style="background:#FEFAF4;padding:24px;font-family:Arial,sans-serif;color:#0F0004"><div style="max-width:560px;margin:auto;background:white;padding:28px;border-top:4px solid #E22A30"><h1 style="font-size:24px">${escapeHtml(courseTitle)}</h1><p>You're invited to ${escapeHtml(groupName)}.</p><p><a style="display:inline-block;background:#E22A30;color:white;padding:12px 20px;text-decoration:none;border-radius:6px" href="${escapeHtml(url)}">Join course</a></p><p style="font-size:14px">Sign in with this email address. Expires in seven days.</p><p style="font-size:14px">Shared answers are visible to group members, including people who join later.</p><p>Ev Church</p></div></div>` }
}

/** One send per new invite. Unknown delivery is never silently retried with a new token. */
export async function inviteToCourseGroup(identity: Auth0Identity, groupId: number, inputEmail: string, transport: SiteFeedbackNotificationTransport = createResendSiteFeedbackTransport()) {
  const email = normalizeInvitationEmail(inputEmail)
  if (email === identity.email) throw new Error('You are already in this group.')
  const token = randomBytes(32).toString('base64url')
  const prepared = await transaction(async client => {
    const group = await lockCourseGroup(client, groupId)
    await requireGroupMember(client, identity, groupId); requireFacilitator(group, identity)
    await requireOpenCourse(client, group.edition_id)
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`course-inviter:${identity.identityKey}`])
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`course-recipient:${email}`])
    const limits = await client.query<{ sender: string; recipient: string }>(`SELECT count(*) FILTER (WHERE inviter_key=$1) AS sender, count(*) FILTER (WHERE email=$2) AS recipient FROM course_invitations WHERE created_at > now()-interval '1 hour'`, [identity.identityKey, email])
    if (Number(limits.rows[0].sender) >= 30 || Number(limits.rows[0].recipient) >= 5) throw new Error('Too many invitations. Try again later.')
    await client.query(`UPDATE course_invitations SET status='revoked',updated_at=now() WHERE group_id=$1 AND email=$2 AND status='pending'`, [groupId, email])
    const result = await client.query<{ id: number }>(`INSERT INTO course_invitations (group_id,email,inviter_key,token_hash,expires_at,status,delivery_status,created_at,updated_at) VALUES ($1,$2,$3,$4,now()+interval '7 days','pending','sending',now(),now()) RETURNING id`, [groupId, email, identity.identityKey, invitationTokenHash(token)])
    const edition = await client.query<{ snapshot: unknown }>('SELECT snapshot FROM course_editions WHERE id=$1', [group.edition_id])
    return { id: result.rows[0].id, group, title: readCourseSnapshot(edition.rows[0].snapshot).title }
  })
  const origin = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (!origin) throw new Error('Invitation delivery is unavailable.')
  const url = new URL(`/members/courses/invitations/${token}`, origin).toString()
  const pool = coursePostgresPool(await getPayloadClient())
  try {
    const sent = await transport.send(buildCourseInvitation(email, prepared.group.name, prepared.title, url), `course-invitation-${prepared.id}-${invitationTokenHash(token).slice(0,24)}`)
    await pool.query(`UPDATE course_invitations SET delivery_status='sent',provider_id=$2,updated_at=now() WHERE id=$1`, [prepared.id, sent.providerId])
    return { delivered: true }
  } catch {
    await pool.query(`UPDATE course_invitations SET delivery_status='unknown',updated_at=now() WHERE id=$1`, [prepared.id])
    return { delivered: false }
  }
}

export async function getCourseInvitation(identity: Auth0Identity, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const pool = coursePostgresPool(await getPayloadClient())
  const result = await pool.query<{ group_name: string; snapshot: unknown }>(`SELECT i.*,g.name AS group_name,g.edition_id,g.status AS group_status,e.snapshot FROM course_invitations i JOIN course_groups g ON g.id=i.group_id JOIN course_editions e ON e.id=g.edition_id JOIN courses c ON c.id=e.course_id WHERE i.token_hash=$1 AND i.email=$2 AND i.status='pending' AND i.expires_at>now() AND g.status='active' AND c._status='published' AND c.enrolment_open=true`, [invitationTokenHash(token), identity.email])
  const invitation = result.rows[0]
  return invitation ? { groupName: invitation.group_name, title: readCourseSnapshot(invitation.snapshot).title } : null
}
export async function acceptCourseInvitation(identity: Auth0Identity, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invitation is unavailable.')
  const tokenHash = invitationTokenHash(token)
  const pool = coursePostgresPool(await getPayloadClient())
  const lookup = await pool.query<{ group_id: number }>('SELECT group_id FROM course_invitations WHERE token_hash=$1 AND email=$2', [tokenHash, identity.email])
  if (!lookup.rows[0]) throw new Error('Invitation is unavailable.')
  return transaction(async client => {
    const group = await lockCourseGroup(client, lookup.rows[0].group_id)
    if (group.status !== 'active') throw new Error('Invitation is unavailable.')
    await requireOpenCourse(client, group.edition_id)
    const invite = await client.query<InvitationRow>('SELECT * FROM course_invitations WHERE token_hash=$1 AND email=$2 FOR UPDATE', [tokenHash, identity.email])
    const invitation = invite.rows[0]
    if (!invitation || invitation.status !== 'pending' || new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error('Invitation is unavailable.')
    await client.query(`INSERT INTO course_attempts (account_key,edition_id,mode,group_id,membership_status,display_name,completed_lesson_ids,created_at,updated_at) VALUES ($1,$2,'group',$3,'active',$4,'[]'::jsonb,now(),now()) ON CONFLICT (group_id,account_key) DO UPDATE SET membership_status='active',display_name=EXCLUDED.display_name,updated_at=now()`, [identity.identityKey, group.edition_id, group.id, identity.name])
    await client.query(`UPDATE course_invitations SET status='accepted',updated_at=now() WHERE id=$1`, [invitation.id])
    return group.id
  })
}

export async function getCourseGroup(identity: Auth0Identity, groupId: number) {
  validId(groupId)
  const pool = coursePostgresPool(await getPayloadClient())
  await requireGroupMember(pool, identity, groupId)
  const group = (await pool.query<CourseGroupRow>('SELECT * FROM course_groups WHERE id=$1', [groupId])).rows[0]
  if (!group) throw new Error('Group not found.')
  const members = await pool.query<GroupMemberRow>('SELECT * FROM course_attempts WHERE group_id=$1 AND membership_status=\'active\' ORDER BY id', [groupId])
  const facilitator = group.facilitator_key === identity.identityKey
  const invites = facilitator ? await pool.query<InvitationRow>(`SELECT id,email,status,delivery_status,expires_at FROM course_invitations WHERE group_id=$1 AND status='pending' ORDER BY id DESC`, [groupId]) : null
  const edition = await pool.query<{ snapshot: unknown }>('SELECT snapshot FROM course_editions WHERE id=$1', [group.edition_id])
  const snapshot = readCourseSnapshot(edition.rows[0].snapshot)
  const course = await pool.query<{ enrolment_open: boolean; _status: string }>('SELECT c.enrolment_open,c._status FROM course_editions e JOIN courses c ON c.id=e.course_id WHERE e.id=$1', [group.edition_id])
  return { id: group.id, name: group.name, status: group.status, facilitator, snapshot, enrolmentOpen: course.rows[0]?.enrolment_open && course.rows[0]._status === 'published',
    members: members.rows.map(member => ({ attemptId: member.id, name: member.display_name || 'Participant', own: member.account_key === identity.identityKey, completed: facilitator || member.account_key === identity.identityKey ? completedLessonIds(member.completed_lesson_ids) : null, finished: facilitator || member.account_key === identity.identityKey ? !!member.completed_at : null })),
    invitations: invites?.rows.map(invite => ({ id: invite.id, email: invite.email, deliveryStatus: invite.delivery_status })) ?? [] }
}

export async function manageCourseGroup(identity: Auth0Identity, groupId: number, action: 'leave' | 'remove' | 'transfer' | 'close' | 'delete-workbook' | 'revoke', targetId?: number) {
  return transaction(async client => {
    const group = await lockCourseGroup(client, groupId)
    const self = await requireGroupMember(client, identity, groupId)
    if (action === 'leave') {
      if (group.status === 'active' && group.facilitator_key === identity.identityKey) throw new Error('Transfer facilitation or close the group before leaving.')
      await client.query(`UPDATE course_attempts SET membership_status='left',updated_at=now() WHERE id=$1`, [self.id]); return
    }
    requireFacilitator(group, identity, action !== 'delete-workbook')
    if (action === 'close') { await client.query(`UPDATE course_groups SET status='closed',updated_at=now() WHERE id=$1`, [groupId]); await client.query(`UPDATE course_invitations SET status='revoked',updated_at=now() WHERE group_id=$1 AND status='pending'`, [groupId]); return }
    if (action === 'delete-workbook') {
      // Tombstones retain revision history so an old tab cannot silently resurrect deleted work.
      await client.query(`UPDATE course_answers SET value='null'::jsonb,revision=revision+1,updated_at=now() WHERE attempt_id IN (SELECT id FROM course_attempts WHERE group_id=$1) AND scope='group'`, [groupId]); return
    }
    if (action === 'revoke') { await client.query(`UPDATE course_invitations SET status='revoked',updated_at=now() WHERE id=$1 AND group_id=$2 AND status='pending'`, [targetId, groupId]); return }
    const target = await client.query<GroupMemberRow>(`SELECT * FROM course_attempts WHERE id=$1 AND group_id=$2 AND membership_status='active'`, [targetId, groupId])
    const person = target.rows[0]
    if (!person || person.id === self.id) throw new Error('Choose another participant.')
    if (action === 'transfer') await client.query('UPDATE course_groups SET facilitator_key=$2,updated_at=now() WHERE id=$1', [groupId, person.account_key])
    if (action === 'remove') await client.query(`UPDATE course_attempts SET membership_status='removed',updated_at=now() WHERE id=$1`, [person.id])
  })
}

export async function withCourseGroupWrite<T>(identity: Auth0Identity, groupId: number, fn: (client: PoolClient) => Promise<T>) {
  return transaction(async client => {
    const group = await lockCourseGroup(client, groupId)
    await requireGroupMember(client, identity, groupId)
    if (group.status !== 'active') throw new Error('This group is closed.')
    return fn(client)
  })
}
