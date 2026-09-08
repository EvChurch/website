import { randomUUID } from 'node:crypto'
import { APIError, type CollectionBeforeValidateHook } from 'payload'

/** Imported identifiers and URLs remain unchanged; new content is authored locally. */
export const authorSermonMetadata: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  collection,
  context,
  req,
}) => {
  if (!data) return data
  if (!data.slug && !originalDoc?.slug) {
    const title = String(data.title || data.name || 'sermon')
    const base = title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    data.slug = `${base || 'sermon'}-${randomUUID().slice(0, 8)}`
  }
  if (collection.slug === 'sermons') {
    const merged = { ...originalDoc, ...data }
    // Pipeline jobs may update their own fields on legacy sermons without reauthoring them.
    const editorial = [
      'title',
      'publishedAt',
      'audioSpeaker',
      'audioCampus',
      'passageReference',
      'series',
      'topics',
      'audio',
      'isPublished',
    ]
    if (
      merged.isPublished &&
      (!originalDoc ||
        editorial.some(
          (key) =>
            key in data &&
            JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key]),
        ))
    ) {
      for (const key of [
        'title',
        'publishedAt',
        'audioSpeaker',
        'audioCampus',
        'passageReference',
        'series',
        'audio',
      ]) {
        const value: unknown = merged[key]
        if (
          value == null ||
          value === '' ||
          (typeof value === 'string' && !value.trim()) ||
          (Array.isArray(value) && !value.length)
        ) {
          throw new APIError(`Complete ${key} before publishing.`, 400)
        }
      }
      if (
        (!originalDoc?.isPublished ||
          ('audio' in data && data.audio !== originalDoc?.audio)) &&
        !context.sermonPublication
      ) {
        throw new APIError(
          'Preview and publish audio from the Sermon Manager dashboard.',
          400,
        )
      }
    }
    if (
      context.reindexSermon ||
      !originalDoc ||
      [
        'title',
        'passageReference',
        'audioSpeaker',
        'series',
        'topics',
        'scriptures',
      ].some(
        (key) =>
          key in data &&
          JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key]),
      )
    ) {
      const names: string[] = [merged.title, merged.passageReference].filter(
        Boolean,
      )
      const related = [
        ['speakers', merged.audioSpeaker ? [merged.audioSpeaker] : []],
        ['sermon-series', merged.series || []],
        ['topics', merged.topics || []],
        ['scriptures', merged.scriptures || []],
      ] as const
      for (const [slug, values] of related) {
        for (const value of values) {
          const doc = await req.payload.findByID({
            collection: slug,
            id: typeof value === 'object' ? value.id : value,
            depth: 0,
            req,
          })
          names.push('name' in doc ? doc.name : doc.title)
        }
      }
      data.searchText = names.join(' ')
    }
  }
  return data
}
