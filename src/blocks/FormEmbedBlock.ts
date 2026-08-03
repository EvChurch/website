import type { Block } from 'payload'
import { listEligibleRockConnectionSignups } from '@/lib/rock-connection-signups/server'
import { isGuid } from '@/lib/rock-forms/constants'

type FormEmbedSiblingData = { sourceType?: unknown }

function isConnectionSource(siblingData: FormEmbedSiblingData): boolean {
  return siblingData.sourceType === 'connectionOpportunity'
}

export function validateRockWorkflowGuid(
  value: unknown,
  siblingData: FormEmbedSiblingData,
): true | string {
  if (isConnectionSource(siblingData)) return true
  return typeof value === 'string' && isGuid(value)
    ? true
    : 'Choose a public Rock Form Builder workflow.'
}

export function validateRockConnectionBlockGuid(
  value: unknown,
  siblingData: FormEmbedSiblingData,
): true | string {
  if (!isConnectionSource(siblingData)) return true
  return typeof value === 'string' && isGuid(value)
    ? true
    : 'Choose an eligible Rock Connection Signup configuration.'
}

export async function validateEligibleRockConnectionBlockGuid(
  value: unknown,
  siblingData: FormEmbedSiblingData,
  listEligible = listEligibleRockConnectionSignups,
): Promise<true | string> {
  const structural = validateRockConnectionBlockGuid(value, siblingData)
  if (structural !== true || !isConnectionSource(siblingData)) return structural
  try {
    const normalized = String(value).toLowerCase()
    const eligible = await listEligible()
    return eligible.some(({ blockGuid }) => blockGuid.toLowerCase() === normalized)
      ? true
      : 'This Rock Connection Signup is no longer eligible. Choose a replacement before publishing.'
  } catch {
    return 'Unable to verify this Rock Connection Signup. Try publishing again after Rock discovery recovers.'
  }
}

export const FormEmbedBlock: Block = {
  slug: 'formEmbed',
  interfaceName: 'FormEmbedBlock',
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
    },
    {
      name: 'heading',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'sourceType',
      type: 'select',
      required: true,
      defaultValue: 'workflow',
      options: [
        { label: 'Rock Form Builder workflow', value: 'workflow' },
        {
          label: 'Rock Connection Opportunity Signup',
          value: 'connectionOpportunity',
        },
      ],
      admin: {
        description: 'Choose the Rock protocol this section uses.',
      },
    },
    {
      name: 'rockWorkflowGuid',
      type: 'text',
      validate: (
        value: unknown,
        { siblingData }: { siblingData: FormEmbedSiblingData },
      ) =>
        validateRockWorkflowGuid(value, siblingData),
      admin: {
        condition: (_, siblingData) =>
          siblingData?.sourceType !== 'connectionOpportunity',
        description:
          'The active public Rock Form Builder workflow rendered and submitted directly to Rock.',
        components: {
          Field: '@/components/admin/RockWorkflowPicker#RockWorkflowPicker',
        },
      },
    },
    {
      name: 'rockConnectionBlockGuid',
      type: 'text',
      validate: async (
        value: unknown,
        { siblingData }: { siblingData: FormEmbedSiblingData },
      ) =>
        validateEligibleRockConnectionBlockGuid(value, siblingData),
      admin: {
        condition: (_, siblingData) =>
          siblingData?.sourceType === 'connectionOpportunity',
        description:
          'An active public Connection Opportunity Signup configuration that is safe for EV Church.',
        components: {
          Field:
            '@/components/admin/RockConnectionSignupPicker#RockConnectionSignupPicker',
        },
      },
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'centered',
      options: [
        { label: 'Full width', value: 'full' },
        { label: 'Centered', value: 'centered' },
      ],
    },
  ],
}
