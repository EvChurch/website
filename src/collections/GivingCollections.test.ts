import { describe, expect, it } from 'vitest'
import type { CollectionConfig } from 'payload'
import { GivingGivers } from './GivingGivers'
import { GivingGifts } from './GivingGifts'
import { GivingConsents } from './GivingConsents'
import { GivingSchedules } from './GivingSchedules'
import { GivingProviderOperations } from './GivingProviderOperations'
import { GivingE2ERuns } from './GivingE2ERuns'
import { BlinkPayWebhookEvents } from './BlinkPayWebhookEvents'
import { GivingCheckouts } from './GivingCheckouts'
import { GivingDrafts } from './GivingDrafts'

const privateCollections: CollectionConfig[] = [GivingGivers,GivingCheckouts,GivingGifts,GivingConsents,GivingSchedules,GivingProviderOperations,GivingE2ERuns,BlinkPayWebhookEvents]

function field(collection: CollectionConfig, name: string) {
  return collection.fields.find((candidate) => 'name' in candidate && candidate.name === name)
}
describe('private giving collection access', () => {
  it('permits exact-admin reads and denies request mutations for every private collection', () => {
    for (const collection of privateCollections) {
      expect(collection.access?.read?.({ req: { user: { roles: ['admin'] } } } as never)).toBe(true)
      expect(collection.access?.read?.({ req: { user: { roles: ['content-lead'] } } } as never)).toBe(false)
      expect(collection.access?.read?.({ req: { user: null } } as never)).toBe(false)
      expect(collection.access?.create?.({ req: { user: { roles: ['admin'] } } } as never)).toBe(false)
      expect(collection.access?.update?.({ req: { user: { roles: ['admin'] } } } as never)).toBe(false)
      expect(collection.access?.delete?.({ req: { user: { roles: ['admin'] } } } as never)).toBe(false)
    }
  })

  it('keeps draft capabilities completely service-only', () => {
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      expect(GivingDrafts.access?.[operation]?.({ req: { user: { roles: ['admin'] } } } as never)).toBe(false)
    }
    expect(GivingDrafts.admin).toMatchObject({ hidden: true })
  })

  it('uses the reviewed checkout, schedule and webhook lifecycle enums', () => {
    expect(field(GivingCheckouts, 'frequency')).toMatchObject({ options: ['one-off','daily','weekly','fortnightly','monthly','annual'] })
    expect(field(GivingCheckouts, 'status')).toMatchObject({ options: ['draft','authorising','verifying','unknown','completed','failed'] })
    expect(field(GivingSchedules, 'status')).toMatchObject({ options: ['pending','active','unknown','cancel_pending','cancelled','failed'] })
    expect(field(BlinkPayWebhookEvents, 'status')).toMatchObject({ options: ['pending','processing','retry','processed','quarantined','dead'] })
  })

  it('marks provider, lifecycle, provenance and correlation fields read-only in admin', () => {
    for (const [collection, names] of [
      [GivingCheckouts, ['environment','synthetic','correlationKey','status']],
      [GivingGifts, ['environment','synthetic','providerPaymentId','status']],
      [GivingConsents, ['environment','synthetic','providerConsentId','status']],
      [GivingSchedules, ['environment','synthetic','providerScheduleId','status']],
      [GivingProviderOperations, ['environment','synthetic','correlationKey','providerId','status']],
      [BlinkPayWebhookEvents, ['environment','synthetic','providerEventId','status','leaseToken']],
    ] as const) {
      for (const name of names) expect(field(collection, name)).toMatchObject({ admin: { readOnly: true } })
    }
  })

  it('groups giving records and makes every service-owned data field read-only', () => {
    for (const collection of privateCollections) {
      expect(collection.admin?.group).toBe('Giving')
      expect(collection.admin?.defaultColumns).toContain('synthetic')
      if (collection.slug !== 'giving-e2e-runs') {
        expect(collection.admin?.baseListFilter?.({req:{query:{}}} as never)).toEqual({synthetic:{equals:false}})
        expect(collection.admin?.baseListFilter?.({req:{query:{includeSynthetic:'true'}}} as never)).toBeNull()
      }
      for (const candidate of collection.fields) {
        if ('name' in candidate && candidate.type !== 'ui') expect(candidate.admin?.readOnly, `${collection.slug}.${candidate.name}`).toBe(true)
      }
    }
    const synthetic = field(GivingSchedules,'synthetic')
    expect(synthetic).toMatchObject({ label:'TEST DATA',admin:{readOnly:true} })
    expect(field(GivingSchedules,'cancelAction')).toMatchObject({type:'ui',admin:{components:{Field:'@/components/admin/GivingScheduleCancelAction'}}})
    expect(field(GivingSchedules,'providerSource')).toMatchObject({options:['return','webhook','reconciliation','cancellation']})
    expect(field(GivingE2ERuns,'tokenDigest')).toMatchObject({admin:{hidden:true,readOnly:true}})
    expect(field(GivingE2ERuns,'csrfDigest')).toMatchObject({admin:{hidden:true,readOnly:true}})
  })
})
