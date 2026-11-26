import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'
import { hash, randomUUID } from 'node:crypto'
import type { Auth0Identity } from '@/auth/auth0-identity'
const { state } = vi.hoisted(() => ({ state: { pool: undefined as unknown } }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn(async () => ({ db: { pool: state.pool } })) }))
import { acceptCourseInvitation, getCourseGroup, getCourseInvitation, invitationTokenHash, inviteToCourseGroup, manageCourseGroup } from './groups'
import { getCourseAnswerContext, readCourseAnswer, readOtherCourseAnswers, saveCourseAnswer, requiredCourseAnswersComplete } from './answers'
const connectionString = process.env.COURSE_GROUP_TEST_DATABASE_URL
const suite = describe.skipIf(!connectionString)

suite('course groups against isolated PostgreSQL', () => {
  let pool: Pool, courseId: number, editionId: number, groupId: number, attemptA: number, attemptB: number
  const prefix = randomUUID()
  const identity = (name: string): Auth0Identity => ({ identityKey: hash('sha256', prefix+name), issuer:'https://example.test/', subject:name, email:`${prefix}-${name.toLowerCase()}@example.test`, name })
  const a=identity('Alice'), b=identity('Bob'), c=identity('Cara')
  const snapshot = { title:'Group test',slug:'group-test',summary:'Test',allowSolo:true,allowGroup:true,lessons:[{lessonId:'lesson',title:'Lesson',required:true,blocks:[
    {id:'private',blockType:'courseQuestion',prompt:'Private',inputType:'text',visibility:'personal',responseMode:'group',required:false},
    {id:'together',blockType:'courseQuestion',prompt:'Together',inputType:'text',visibility:'shared',responseMode:'group',required:true},
    {id:'individual',blockType:'courseQuestion',prompt:'Individual',inputType:'text',visibility:'shared',responseMode:'individual',required:false},
  ]}] }
  beforeAll(async () => {
    const url = new URL(connectionString!)
    if (url.pathname !== '/ev_courses_groups' || !['','localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Local test database required')
    pool=new Pool({connectionString});state.pool=pool
    const course=(await pool.query<{id:number}>("INSERT INTO courses(title,slug,summary,enrolment_open,allow_solo,allow_group,_status,created_at,updated_at) VALUES('Group test',$1,'Test',true,true,true,'published',now(),now()) RETURNING id",['test-'+prefix])).rows[0]
    courseId=course.id
    editionId=(await pool.query<{id:number}>(`INSERT INTO course_editions(course_id,structure_key,snapshot,published_at,created_at,updated_at) VALUES($1,$2,$3,now(),now(),now()) RETURNING id`,[course.id,prefix,JSON.stringify(snapshot)])).rows[0].id
    groupId=(await pool.query<{id:number}>(`INSERT INTO course_groups(name,edition_id,facilitator_key,status,created_at,updated_at) VALUES('Group test',$1,$2,'active',now(),now()) RETURNING id`,[editionId,a.identityKey])).rows[0].id
    attemptA=(await pool.query<{id:number}>(`INSERT INTO course_attempts(account_key,edition_id,mode,group_id,membership_status,display_name,completed_lesson_ids,created_at,updated_at) VALUES($1,$2,'group',$3,'active','Alice','[]',now(),now()) RETURNING id`,[a.identityKey,editionId,groupId])).rows[0].id
    // getOwnedCourseAttempt uses the Local API for typed documents; emulate that read with real rows.
    const payload = await import('@/lib/payload')
    vi.mocked(payload.getPayloadClient).mockImplementation(async () => ({ db:{pool}, find:async ({where}: {where:{and:Array<{id?:{equals:number};accountKey?:{equals:string}}>}}) => { const id=where.and.find(x=>x.id)?.id?.equals,key=where.and.find(x=>x.accountKey)?.accountKey?.equals;const rows=await pool.query('SELECT * FROM course_attempts WHERE id=$1 AND account_key=$2',[id,key]);return {docs:rows.rows.map(r=>({id:r.id,edition:r.edition_id,group:r.group_id,mode:r.mode,membershipStatus:r.membership_status,completedLessonIds:r.completed_lesson_ids}))}},findByID:async()=>({id:editionId,snapshot}) }) as never)
  })
  afterAll(async()=>{ if(!pool)return;await pool.query('DELETE FROM course_answers WHERE edition_id=$1',[editionId]);await pool.query('DELETE FROM course_invitations WHERE group_id=$1',[groupId]);await pool.query('DELETE FROM course_attempts WHERE group_id=$1',[groupId]);await pool.query('DELETE FROM course_groups WHERE id=$1',[groupId]);await pool.query('DELETE FROM course_editions WHERE id=$1',[editionId]);await pool.query('DELETE FROM courses WHERE id=$1',[courseId]);await pool.end() })
  it('binds invitation acceptance to verified email and pins the group edition',async()=>{
    let link=''
    const transport={send:vi.fn(async(message:{text:string},key:string)=>{link=message.text.match(/http[^\s]+/)![0];expect(key).toMatch(/^course-invitation-/);return {providerId:'fake-local'}})}
    process.env.APP_BASE_URL='http://localhost:3101'
    await expect(inviteToCourseGroup(a,groupId,b.email,transport)).resolves.toEqual({delivered:true})
    const token=link.split('/').at(-1)!
    expect(await getCourseInvitation(c,token)).toBeNull()
    await expect(acceptCourseInvitation(c,token)).rejects.toThrow('unavailable')
    expect(await acceptCourseInvitation(b,token)).toBe(groupId)
    await expect(acceptCourseInvitation(b,token)).rejects.toThrow('unavailable')
    const row=(await pool.query('SELECT id,edition_id FROM course_attempts WHERE group_id=$1 AND account_key=$2',[groupId,b.identityKey])).rows[0]
    attemptB=row.id;expect(row.edition_id).toBe(editionId)
    expect((await pool.query('SELECT token_hash FROM course_invitations WHERE group_id=$1',[groupId])).rows[0].token_hash).toBe(invitationTokenHash(token))
  })
  it('shares one answer but protects personal answers and individual authorship',async()=>{
    const togetherA=await getCourseAnswerContext(a,attemptA,'lesson','together'),togetherB=await getCourseAnswerContext(b,attemptB,'lesson','together')
    expect(togetherA.responseKey).toBe(togetherB.responseKey)
    expect((await getCourseAnswerContext(a,attemptA,'lesson','private')).responseKey).not.toBe((await getCourseAnswerContext(b,attemptB,'lesson','private')).responseKey)
    await saveCourseAnswer(a,attemptA,'lesson','private',0,'Private Alice')
    await expect(readCourseAnswer(b,attemptA,'lesson','private')).rejects.toThrow()
    await saveCourseAnswer(a,attemptA,'lesson','together',0,'Shared group')
    expect((await readCourseAnswer(b,attemptB,'lesson','together')).value).toBe('Shared group')
    expect(await requiredCourseAnswersComplete(b,attemptB,'lesson')).toBe(true)
    await saveCourseAnswer(a,attemptA,'lesson','individual',0,'Alice visible')
    expect(await readOtherCourseAnswers(b,attemptB,'lesson','individual')).toEqual([{name:'Alice',value:'Alice visible'}])
    expect(await readOtherCourseAnswers(b,attemptB,'lesson','private')).toEqual([])
  })
  it('rejects stale group saves atomically',async()=>{
    const revision=(await readCourseAnswer(a,attemptA,'lesson','together')).revision
    const saves=await Promise.all([saveCourseAnswer(a,attemptA,'lesson','together',revision,'A'),saveCourseAnswer(b,attemptB,'lesson','together',revision,'B')])
    expect(saves.map(x=>x.status).sort()).toEqual(['conflict','saved'])
  })
  it('revokes shared access after removal while preserving own personal answers',async()=>{
    await saveCourseAnswer(b,attemptB,'lesson','private',0,'Private Bob')
    await expect(manageCourseGroup(b,groupId,'remove',attemptA)).rejects.toThrow()
    await manageCourseGroup(a,groupId,'remove',attemptB)
    await expect(readCourseAnswer(b,attemptB,'lesson','together')).rejects.toThrow()
    expect((await readCourseAnswer(b,attemptB,'lesson','private')).value).toBe('Private Bob')
    await expect(getCourseGroup(b,groupId)).rejects.toThrow()
  })
  it('rejects expired invitations and non-facilitator invitations',async()=>{
    let link=''
    const transport={send:async(message:{text:string})=>{link=message.text.match(/http[^\s]+/)![0];return {providerId:'fake-expiry'}}}
    await expect(inviteToCourseGroup(b,groupId,c.email,transport)).rejects.toThrow()
    await inviteToCourseGroup(a,groupId,c.email,transport)
    const token=link.split('/').at(-1)!
    await pool.query("UPDATE course_invitations SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[invitationTokenHash(token)])
    expect(await getCourseInvitation(c,token)).toBeNull()
    await expect(acceptCourseInvitation(c,token)).rejects.toThrow('unavailable')
  })
  it('stops new invite creation and acceptance when course enrolment closes',async()=>{
    let token=''
    await inviteToCourseGroup(a,groupId,c.email,{send:async message=>{token=message.text.match(/http[^\s]+/)![0].split('/').at(-1)!;return {providerId:'fake-closed-course'}}})
    await pool.query('UPDATE courses SET enrolment_open=false WHERE id=$1',[courseId])
    expect(await getCourseInvitation(c,token)).toBeNull()
    await expect(acceptCourseInvitation(c,token)).rejects.toThrow('unavailable')
    await expect(inviteToCourseGroup(a,groupId,c.email,{send:async()=>({providerId:'never'})})).rejects.toThrow('unavailable')
    expect((await readCourseAnswer(a,attemptA,'lesson','together')).value).not.toBeNull()
    await pool.query('UPDATE courses SET enrolment_open=true WHERE id=$1',[courseId])
  })
  it('transfers facilitation without granting private response access',async()=>{
    await pool.query("UPDATE course_attempts SET membership_status='active' WHERE id=$1",[attemptB])
    await manageCourseGroup(a,groupId,'transfer',attemptB)
    expect((await getCourseGroup(b,groupId)).facilitator).toBe(true)
    await expect(readCourseAnswer(b,attemptA,'lesson','private')).rejects.toThrow()
    await expect(manageCourseGroup(a,groupId,'remove',attemptB)).rejects.toThrow()
    await manageCourseGroup(b,groupId,'transfer',attemptA)
    await manageCourseGroup(a,groupId,'remove',attemptB)
  })
  it('serializes acceptance with closure so no participant joins an already closed group',async()=>{
    const raceId=(await pool.query<{id:number}>("INSERT INTO course_groups(name,edition_id,facilitator_key,status,created_at,updated_at) VALUES('Race',$1,$2,'active',now(),now()) RETURNING id",[editionId,a.identityKey])).rows[0].id
    try {
      await pool.query("INSERT INTO course_attempts(account_key,edition_id,mode,group_id,membership_status,display_name,completed_lesson_ids,created_at,updated_at) VALUES($1,$2,'group',$3,'active','Alice','[]',now(),now())",[a.identityKey,editionId,raceId])
      let token=''
      await inviteToCourseGroup(a,raceId,c.email,{send:async message=>{token=message.text.match(/http[^\s]+/)![0].split('/').at(-1)!;return {providerId:'fake-race'}}})
      const results=await Promise.allSettled([acceptCourseInvitation(c,token),manageCourseGroup(a,raceId,'close')])
      expect(results[1].status).toBe('fulfilled')
      expect((await pool.query('SELECT status FROM course_groups WHERE id=$1',[raceId])).rows[0].status).toBe('closed')
      await expect(acceptCourseInvitation(c,token)).rejects.toThrow()
      const joined=await pool.query('SELECT id FROM course_attempts WHERE group_id=$1 AND account_key=$2',[raceId,c.identityKey])
      expect(joined.rowCount).toBe(results[0].status==='fulfilled'?1:0)
    } finally {
      await pool.query('DELETE FROM course_invitations WHERE group_id=$1',[raceId])
      await pool.query('DELETE FROM course_attempts WHERE group_id=$1',[raceId])
      await pool.query('DELETE FROM course_groups WHERE id=$1',[raceId])
    }
  })
  it('requires transfer or closure before facilitator leave and makes closed workbooks read-only',async()=>{
    await expect(manageCourseGroup(a,groupId,'leave')).rejects.toThrow('Transfer')
    await manageCourseGroup(a,groupId,'close')
    expect((await readCourseAnswer(a,attemptA,'lesson','together')).readOnly).toBe(true)
    await expect(saveCourseAnswer(a,attemptA,'lesson','together',2,'After closure')).rejects.toThrow('closed')
    await expect(inviteToCourseGroup(a,groupId,c.email,{send:async()=>({providerId:'never'})})).rejects.toThrow()
    await manageCourseGroup(a,groupId,'delete-workbook')
    expect((await readCourseAnswer(a,attemptA,'lesson','together')).value).toBeNull()
    await manageCourseGroup(a,groupId,'leave')
  })
})
