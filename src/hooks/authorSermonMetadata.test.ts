import { expect, it, vi } from 'vitest'
import type { CollectionBeforeValidateHook } from 'payload'
import { authorSermonMetadata } from './authorSermonMetadata'

type Arguments = Parameters<CollectionBeforeValidateHook>[0]
function args(overrides: Partial<Arguments> = {}): Arguments {
  return {
    data: { title: 'Imported sermon', slug: 'imported', resourceId: 'upstream-id', publishedAt: '2026-10-11T07:48:00Z', audio: 1, audioSpeaker: 1, series: [1], passageReference: 'Luke 9', isPublished: true },
    collection: { slug: 'sermons' },
    operation: 'create',
    context: { churchResourcesImport: true },
    req: { payload: { findByID: vi.fn().mockResolvedValue({ name: 'Luke' }) } },
    ...overrides,
  } as Arguments
}

it('allows trusted imports of already published upstream audio without a campus', async () => {
  await expect(authorSermonMetadata(args())).resolves.toMatchObject({ isPublished: true, resourceId: 'upstream-id' })
})

it('continues requiring complete metadata for ordinary publishing', async () => {
  await expect(authorSermonMetadata(args({ context: {} }))).rejects.toThrow('Complete audioCampus')
})

it('does not bypass publication validation for edits or authenticated requests', async () => {
  const existing = args().data!
  await expect(authorSermonMetadata(args({ operation: 'update', originalDoc: { ...existing, title: 'Old title' } }))).rejects.toThrow('Complete audioCampus')
  await expect(authorSermonMetadata(args({ req: { ...args().req, user: { id: 1 } } as Arguments['req'] }))).rejects.toThrow('Complete audioCampus')
})

it('does not apply the import exception to content without an upstream identifier', async () => {
  const input = args()
  delete input.data!.resourceId
  await expect(authorSermonMetadata(input)).rejects.toThrow('Complete audioCampus')
})

it('recognizes Payload creates even when originalDoc is an empty object', async () => {
  await expect(authorSermonMetadata(args({ originalDoc: {} }))).resolves.toMatchObject({ isPublished: true })
})
