import type { Block, DateField } from 'payload'

const timezone: DateField['timezone'] = {
  defaultTimezone: 'Pacific/Auckland',
  supportedTimezones: [{ label: 'Auckland / Wellington', value: 'Pacific/Auckland' }],
  override: ({ baseField }) => ({ ...baseField, enumName: 'block_visibility_timezone' }),
}

/** Keep the same scheduling controls on every page block. */
export function withVisibility(block: Block): Block {
  return {
    ...block,
    fields: [
      ...block.fields,
      {
        type: 'collapsible',
        label: 'Visibility schedule',
        admin: { initCollapsed: true },
        fields: [{
          name: 'visibility',
          type: 'group',
          label: false,
          fields: [
            {
              name: 'from', type: 'date', label: 'Show from',
              timezone,
              admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Optional. Hidden before this time. Defaults to Auckland time.' },
            },
            {
              name: 'until', type: 'date', label: 'Hide from',
              timezone,
              admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Optional. Hidden at and after this time. Leave both dates empty to always show the block.' },
              validate: (value, { siblingData }) => {
                const from = (siblingData as { from?: string | null } | undefined)?.from
                return !value || !from || new Date(value).getTime() > Date.parse(from) || 'Hide from must be later than Show from.'
              },
            },
          ],
        }],
      },
    ],
  }
}
