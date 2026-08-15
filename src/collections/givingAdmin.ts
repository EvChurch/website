import type { CollectionConfig, Field } from 'payload'

export function readOnlyGivingFields(fields: Field[]): Field[] {
  return fields.map((field) => 'name' in field && field.type !== 'ui'
    ? {
        ...field,
        ...(field.name === 'synthetic' ? { label: 'TEST DATA', admin: { ...field.admin, description: 'Synthetic sandbox record. Exclude from real giving totals.', readOnly: true } } : { admin: { ...field.admin, readOnly: true } }),
      } as Field
    : field)
}

export function givingAdmin(title: string, defaultColumns: string[], description: string, includeSyntheticInList = false): NonNullable<CollectionConfig['admin']> {
  return {
    group: 'Giving',
    useAsTitle: title,
    defaultColumns,
    description,
    ...(!includeSyntheticInList ? { baseListFilter: ({ req }) => req.query?.includeSynthetic === 'true' ? null : { synthetic: { equals: false } } } : {}),
    components: { beforeListTable: ['@/components/admin/GivingRecordLinks'] },
  }
}
