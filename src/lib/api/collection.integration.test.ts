import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildConfig, getPayload, createLocalReq, type Payload } from 'payload'
import type { User } from '@/payload-types'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { ApiKeys, ApiAudit } from '@/collections/ApiKeys'
import { API_UP_SQL } from '@/migrations/20261029_020000_api'
import { authenticate, generateSecret } from './keys'
const rock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rock-api', () => ({rockFetch:rock}))
vi.mock('./database', async original => ({...await original<typeof import('./database')>(), apiPool:async () => pool}))
const url = process.env.REIMBURSEMENT_TEST_DATABASE_URL
const schema = `api_test_${randomUUID().replaceAll('-', '')}`
let pool: Pool, payload: Payload
const admin: User = {id:99, collection:'users', roles:['admin'], name:'Sample admin', email:'admin@example.com', auth0IdentityKey:'test|99', auth0Issuer:'https://example.com', auth0Subject:'test|99', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()}

describe.skipIf(!url)('Payload-managed API credentials', () => {
  beforeAll(async () => {
    const target = new URL(url!)
    if (!target.pathname.startsWith('/evchurch_dev_wt_') || !['','localhost','127.0.0.1'].includes(target.hostname)) throw new Error('Use a local worktree database')
    pool = new Pool({connectionString:url, options:`-c search_path=${schema}`})
    await pool.query(`CREATE SCHEMA ${schema}`)
    await pool.query(API_UP_SQL)
    await pool.query(`CREATE TABLE payload_locked_documents (id serial PRIMARY KEY,global_slug varchar,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY,"order" integer,parent_id integer NOT NULL,path varchar NOT NULL,users_id integer,api_keys_id varchar,api_audit_id integer);`)
    rock.mockImplementation(async ({endpoint}: {endpoint:string}) => ({Id:Number(endpoint.split('/')[1]),NickName:'Sample',LastName:'Person',Email:'sample@example.com'}))
    payload = await getPayload({key:schema, config:buildConfig({secret:'test-only-credential-collection-secret', db:postgresAdapter({pool:{connectionString:url,options:`-c search_path=${schema}`},schemaName:schema,push:false}), collections:[{slug:'users',auth:true,fields:[]},ApiKeys,ApiAudit]})})
  },30000)
  afterAll(async () => {await payload?.destroy(); if(pool){await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end()}})
  it('uses normal collection CRUD, issues the credential once, preserves it across edits, and revokes immediately', async () => {
    const key = await payload.create({collection:'api-keys',overrideAccess:false,user:admin,data:{name:'Sample integration',personId:3,scopes:['reimbursements:reports:read'],noExpiry:true}})
    expect(key.expiresAt).toBeNull();expect(key.personName).toBe('Sample Person');expect(key).not.toHaveProperty('secretHash')
    const {secret} = await generateSecret(pool,key.id,99)
    expect((await authenticate(pool,`Bearer ${secret}`)).key.id).toBe(key.id)
    await expect(generateSecret(pool,key.id,99)).rejects.toThrow('already generated')
    const updated = await payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{name:'Updated integration',scopes:['reimbursements:reports:read','reimbursements:payments:confirm']}})
    expect(updated).not.toHaveProperty('secretHash')
    expect((await authenticate(pool,`Bearer ${secret}`)).key.scopes).toContain('reimbursements:payments:confirm')
    await payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{revoked:true}})
    await expect(authenticate(pool,`Bearer ${secret}`)).rejects.toThrow('revoked')
    await expect(payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{revoked:false}})).rejects.toThrow('reactivated')
    await expect(payload.delete({collection:'api-keys',id:key.id,overrideAccess:false,user:admin})).rejects.toThrow()
    const events = await payload.find({collection:'api-audit',overrideAccess:false,user:admin,depth:0})
    expect(events.docs.map(event => event.action)).toEqual(expect.arrayContaining(['key.created','key.generated','key.updated','key.revoked']))
    expect(JSON.stringify(events)).not.toContain(secret)
    await expect(payload.update({collection:'api-audit',id:events.docs[0].id,overrideAccess:false,user:admin,data:{action:'tampered'}})).rejects.toThrow()
  })
  it('protects the collection generate action with admin access and same-origin checks', async () => {
    const handler = (ApiKeys.endpoints || []).find(endpoint => endpoint.path === '/:id/generate')?.handler
    if (!handler) throw new Error('Missing generate endpoint')
    const key = await payload.create({collection:'api-keys',overrideAccess:false,user:admin,data:{name:'Endpoint test',personId:3,scopes:['reimbursements:reports:read'],noExpiry:true}})
    const request = async (origin:string, user:User|null = admin) => {
      const req = await createLocalReq({user:user ?? undefined,req:{url:'https://example.com/api/api-keys/'+key.id+'/generate',headers:new Headers({Origin:origin}),routeParams:{id:key.id}}},payload)
      return handler(req)
    }
    expect((await request('https://other.example')).status).toBe(403)
    expect((await request('https://example.com',null)).status).toBe(403)
    const response = await request('https://example.com')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    const {secret} = await response.json()
    expect((await authenticate(pool,`Bearer ${secret}`)).key.id).toBe(key.id)
    expect((await request('https://example.com')).status).toBe(409)
    const document = await payload.findByID({collection:'api-keys',id:key.id,overrideAccess:false,user:admin})
    expect(JSON.stringify(document)).not.toContain(secret)
    expect(document).not.toHaveProperty('secretHash')
  })
  it('restricts collection access to exact Payload user admins and protects system fields', async () => {
    for(const user of [null,{...admin,roles:['editor']},{...admin,collection:'payload-mcp-api-keys'}]) {
      await expect(payload.find({collection:'api-keys',overrideAccess:false,user})).rejects.toThrow()
      await expect(payload.create({collection:'api-keys',overrideAccess:false,user,data:{name:'Denied',personId:3,scopes:['reimbursements:reports:read']}})).rejects.toThrow()
    }
    const key = await payload.create({collection:'api-keys',overrideAccess:false,user:admin,data:{name:'Default expiry',personId:3,scopes:['reimbursements:reports:read']}})
    expect(Date.parse(key.expiresAt!)-Date.now()).toBeGreaterThan(364*86400000)
    await expect(payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{personId:4}})).rejects.toThrow('change its person')
    await expect(payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{scopes:['unknown:action']}})).rejects.toThrow()
    await payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{secretHash:'injected',generatedAt:new Date().toISOString(),revokedAt:new Date().toISOString()}})
    const stored=(await pool.query('SELECT * FROM api_keys WHERE id=$1',[key.id])).rows[0]
    expect(stored.secret_hash).toBeNull();expect(stored.generated_at).toBeNull();expect(stored.revoked_at).toBeNull()
    await pool.query("UPDATE api_keys SET expires_at=now()-interval '1 day' WHERE id=$1",[key.id])
    await payload.update({collection:'api-keys',id:key.id,overrideAccess:false,user:admin,data:{revoked:true}})
  })
})
