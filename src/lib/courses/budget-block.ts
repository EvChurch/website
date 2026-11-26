import { randomUUID } from 'node:crypto'
import type { Block } from 'payload'

export const courseBudgetBlock: Block = {
  slug: 'courseBudget',
  interfaceName: 'CourseBudgetBlock',
  fields: [
    { name: 'title', type: 'text', required: true, defaultValue: 'Your weekly budget' },
    { name: 'instructions', type: 'textarea' },
    { name: 'visibility', type: 'select', options: ['personal', 'shared'], required: true, defaultValue: 'personal' },
    { name: 'responseMode', type: 'select', options: [{ label: 'One group answer', value: 'group' }, { label: 'Individual answers', value: 'individual' }], defaultValue: 'group', admin: { condition: (_, sibling) => sibling.visibility === 'shared' } },
    { name: 'required', type: 'checkbox', defaultValue: false },
    {
      name: 'categories', type: 'array', required: true, minRows: 1, maxRows: 10,
      defaultValue: [
        { categoryId: 'giving', label: 'Giving', startingLines: 'Church\nOther giving' },
        { categoryId: 'living', label: 'Living costs', startingLines: 'Housing\nGroceries\nTransport' },
        { categoryId: 'saving', label: 'Debt and savings', startingLines: 'Debt repayments\nSavings' },
        { categoryId: 'planned', label: 'Planned costs', startingLines: 'Annual costs' },
        { categoryId: 'spending', label: 'Spending', startingLines: 'Eating out\nPersonal spending' },
      ],
      fields: [
        { name: 'categoryId', type: 'text', required: true, maxLength: 80, defaultValue: () => randomUUID(), validate: (value: unknown) => typeof value === 'string' && /^[\w-]{1,80}$/.test(value) || 'Use a valid category ID.', admin: { readOnly: true } },
        { name: 'label', type: 'text', required: true, maxLength: 80 },
        { name: 'startingLines', type: 'textarea', maxLength: 1000, admin: { description: 'One starting row name per line, up to 10.' }, validate: (value: unknown) => typeof value !== 'string' || value.split('\n').filter(line => line.trim()).length <= 10 && value.split('\n').every(line => line.trim().length <= 120) || 'Use up to 10 starting rows, with names under 120 characters.' },
      ],
    },
  ],
}
