import { randomUUID } from 'node:crypto'
import type { Block, Field } from 'payload'

const responseFields: Field[] = [
  { name: 'prompt', type: 'textarea', required: true },
  { name: 'guidance', type: 'textarea' },
  { name: 'visibility', type: 'select', options: ['personal', 'shared'], required: true, defaultValue: 'personal' },
  { name: 'responseMode', type: 'select', options: [{ label: 'One group answer', value: 'group' }, { label: 'Individual answers', value: 'individual' }], defaultValue: 'group', admin: { condition: (_, sibling) => sibling.visibility === 'shared' } },
  { name: 'required', type: 'checkbox', defaultValue: false },
]

export const courseQuestionBlock: Block = {
  slug: 'courseQuestion', interfaceName: 'CourseQuestionBlock',
  fields: [
    ...responseFields,
    { name: 'inputType', type: 'select', options: ['text', 'number', 'choice', 'checklist'], required: true, defaultValue: 'text' },
    { name: 'choices', type: 'array', admin: { condition: (_, sibling) => ['choice', 'checklist'].includes(sibling.inputType) }, validate: (value, { siblingData }) => !['choice', 'checklist'].includes((siblingData as { inputType: string }).inputType) || Array.isArray(value) && value.length > 0 || 'Add at least one choice.', fields: [
      { name: 'choiceId', type: 'text', required: true, defaultValue: () => randomUUID(), admin: { readOnly: true } },
      { name: 'label', type: 'text', required: true },
    ] },
  ],
}
export const coursePromptBlock: Block = {
  slug: 'coursePrompt', interfaceName: 'CoursePromptBlock',
  fields: [{ name: 'prompt', type: 'textarea', required: true }, { name: 'guidance', type: 'textarea' }],
}
