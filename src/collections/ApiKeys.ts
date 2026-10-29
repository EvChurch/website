import { randomUUID } from 'node:crypto'
import { APIError, type Access, type CollectionConfig } from 'payload'
import { hasExactPayloadAdminRole } from '@/access/roles'
import { createKeySchema, scopes } from '@/lib/api/contract'
import { resolveKeyPerson, generateSecret, ApiError } from '@/lib/api/keys'
import { apiPool } from '@/lib/api/database'
import { isSameOriginRequest } from '@/lib/request-origin'

export const apiAdminOnly: Access = ({ req }) => req.user?.collection === 'users' && hasExactPayloadAdminRole(req.user)
const privateField = { read: () => false, create: () => false, update: () => false }
const serverField = { create: () => false, update: () => false }

export const ApiKeys: CollectionConfig = {
  slug: 'api-keys',
  labels: { singular: 'API key', plural: 'API keys' },
  admin: {
    group: 'API', useAsTitle: 'name', defaultColumns: ['name', 'personName', 'scopes', 'expiresAt', 'revoked', 'lastUsedAt'],
    hidden: ({ user }) => user?.collection !== 'users' || !(Array.isArray(user?.roles) && user.roles.includes('admin')),
    description: 'Keys for Ev Church APIs. Permissions also require the named person’s current access.',
  },
  access: { create: apiAdminOnly, read: apiAdminOnly, update: apiAdminOnly, delete: () => false },
  endpoints: [{ path: '/:id/generate', method: 'post', handler: async req => {
    if (!await apiAdminOnly({ req }) || !isSameOriginRequest({headers:req.headers, nextUrl:new URL(req.url ?? 'http://localhost')})) return Response.json({error: 'Payload administrator access and same-origin request required.'}, {status:403})
    try {
      const result = await generateSecret(await apiPool(), String(req.routeParams?.id ?? ''), Number(req.user!.id))
      return Response.json(result, {headers:{'Cache-Control':'private, no-store', Vary:'Cookie'}})
    } catch (error) {
      return Response.json({error: error instanceof ApiError ? error.message : 'Unable to generate the API key.'}, {status:error instanceof ApiError ? error.status : 503, headers:{'Cache-Control':'no-store'}})
    }
  }}],
  hooks: {
    beforeChange: [async ({ data, originalDoc, operation }) => {
      if (operation === 'update' && data.personId !== undefined && data.personId !== originalDoc.personId) throw new APIError('Create a new key to change its person.',400)
      if (originalDoc?.revoked && data.revoked === false) throw new APIError('Revoked keys cannot be reactivated.',400)
      const input = createKeySchema.omit({expiresAt:true}).safeParse({name:data.name ?? originalDoc?.name, personId:data.personId ?? originalDoc?.personId, scopes:data.scopes ?? originalDoc?.scopes})
      if (!input.success) throw new APIError(input.error.issues.map(issue => issue.message).join(' '),400)
      const noExpiry = data.noExpiry ?? originalDoc?.noExpiry ?? false
      const expiresAt = noExpiry ? null : data.expiresAt ?? originalDoc?.expiresAt ?? new Date(Date.now()+365*86400000).toISOString()
      if (!noExpiry && (operation === 'create' || expiresAt !== originalDoc.expiresAt) && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) throw new APIError('Choose a future expiry date or No expiry.',400)
      const person = operation === 'create' ? await resolveKeyPerson(input.data.personId) : {name:originalDoc.personName, email:originalDoc.personEmail}
      for (const field of ['id','secretHash','generatedAt','lastUsedAt','rateWindow','rateCount','revokedAt','personName','personEmail']) delete data[field]
      return {...data, ...input.data, ...(operation === 'create' ? {id:randomUUID(), secretHash:null, generatedAt:null, lastUsedAt:null, rateWindow:new Date().toISOString(), rateCount:0} : {}), personName:person.name, personEmail:person.email,
        expiresAt,
        ...(data.revoked && !originalDoc?.revokedAt ? {revokedAt:new Date().toISOString()} : {}),
      }
    }],
    afterChange: [async ({doc, operation, req}) => {
      await req.payload.create({collection:'api-audit', req, overrideAccess:true, data:{keyId:doc.id, adminId:Number(req.user?.id) || null,
        action: operation === 'create' ? 'key.created' : doc.revoked ? 'key.revoked' : 'key.updated', status:operation === 'create' ? 201 : 200,
        details:{name:doc.name, personId:doc.personId, scopes:doc.scopes, expiresAt:doc.expiresAt ?? null}}})
      return doc
    }],
  },
  fields: [
    { name:'id', type:'text', required:true, defaultValue:randomUUID, admin:{hidden:true}, access:serverField },
    { name:'name', type:'text', required:true, maxLength:120 },
    { name:'personId', label:'Rock person ID', type:'number', required:true, min:1, admin:{description:'The person whose current permissions this key uses. Create a new key to change the person.'} },
    { name:'personName', type:'text', admin:{readOnly:true}, access:serverField },
    { name:'personEmail', type:'email', admin:{readOnly:true}, access:serverField },
    { name:'scopes', label:'Permissions', type:'json', required:true, admin:{components:{Field:'@/components/admin/ApiKeyPermissions#ApiKeyPermissions'}, description:'Choose the APIs and actions this key can access.'}, validate: value => Array.isArray(value) && value.length > 0 && value.every(scope => scopes.includes(scope)) || 'Choose at least one valid permission.' },
    { name:'noExpiry', label:'No expiry', type:'checkbox', defaultValue:false },
    { name:'expiresAt', type:'date', defaultValue:() => new Date(Date.now()+365*86400000).toISOString(), admin:{condition:data => !data.noExpiry, date:{pickerAppearance:'dayAndTime'}} },
    { name:'revoked', label:'Revoke key', type:'checkbox', defaultValue:false, admin:{description:'Revocation takes effect immediately and cannot be undone.'} },
    ...['revokedAt','generatedAt','lastUsedAt'].map(name => ({name,type:'date' as const,admin:{readOnly:true},access:serverField})),
    { name:'credential', type:'ui', admin:{components:{Field:'@/components/admin/ApiKeyCredential#ApiKeyCredential'}} },
    { name:'secretHash', type:'text', unique:true, admin:{hidden:true}, access:privateField },
    { name:'rateWindow', type:'date', admin:{hidden:true}, access:privateField },
    { name:'rateCount', type:'number', defaultValue:0, admin:{hidden:true}, access:privateField },
  ],
}

export const ApiAudit: CollectionConfig = {
  slug:'api-audit', dbName:'api_audit', labels:{singular:'API audit event',plural:'API audit'},
  admin:{group:'API', useAsTitle:'action', defaultColumns:['createdAt','keyId','action','status'], hidden:({user}) => user?.collection !== 'users' || !(Array.isArray(user?.roles) && user.roles.includes('admin'))},
  access:{read:apiAdminOnly, create:()=>false, update:()=>false, delete:()=>false},
  fields:[{name:'keyId',type:'text'}, {name:'adminId',type:'number'}, {name:'action',type:'text',required:true}, {name:'status',type:'number',required:true}, {name:'details',type:'json'}],
}
