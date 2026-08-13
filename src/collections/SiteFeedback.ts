import type { CollectionConfig } from 'payload'

import { isContentLead } from '@/access/roles'
import {
  MAX_POSTHOG_REPLAY_URL_LENGTH,
  MAX_POSTHOG_SESSION_ID_LENGTH,
  parsePostHogReplayUrl,
} from '@/lib/site-feedback/validation'

type FeedbackSiblingData = {
  classification?: string | null
  resolutionStatus?: string | null
}

function relationshipId(value: unknown): number | string | null {
  if (value && typeof value === 'object' && 'id' in value) {
    const id = value.id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

export function validateDuplicateReference(
  value: unknown,
  {
    id,
    req,
    siblingData,
  }: {
    id?: number | string
    req?: {
      payload?: {
        findByID: (args: {
          collection: 'feedback-submissions'
          depth: 0
          id: number | string
          select: { classification: true; resolutionStatus: true }
        }) => Promise<{ classification?: string | null; resolutionStatus?: string | null }>
      }
    }
    siblingData?: unknown
  },
): Promise<true | string> | true | string {
  const feedback = (siblingData ?? {}) as FeedbackSiblingData
  const hasDuplicateStatus = feedback.resolutionStatus === 'duplicate'
  const hasDuplicateClassification = feedback.classification === 'duplicate'
  const duplicateId = relationshipId(value)

  if (hasDuplicateStatus !== hasDuplicateClassification) {
    return 'Duplicate classification and resolution status must be set together.'
  }
  if (hasDuplicateStatus && duplicateId == null) {
    return 'Choose the canonical feedback submission for this duplicate.'
  }
  if (!hasDuplicateStatus && duplicateId != null) {
    return 'A duplicate reference is only allowed for duplicate feedback.'
  }
  if (id != null && String(duplicateId) === String(id)) {
    return 'Feedback cannot be marked as a duplicate of itself.'
  }
  if (hasDuplicateStatus && duplicateId != null && req?.payload) {
    return req.payload
      .findByID({
        collection: 'feedback-submissions',
        depth: 0,
        id: duplicateId,
        select: { classification: true, resolutionStatus: true },
      })
      .then((canonical) =>
        canonical.resolutionStatus === 'duplicate' || canonical.classification === 'duplicate'
          ? 'Choose a canonical feedback submission, not another duplicate.'
          : true,
      )
  }
  return true
}

export const SiteFeedback: CollectionConfig = {
  slug: 'feedback-submissions',
  admin: {
    useAsTitle: 'comment',
    defaultColumns: [
      'resolutionStatus',
      'comment',
      'email',
      'sourceUrl',
      'postHogReplayUrl',
      'createdAt',
    ],
  },
  access: {
    create: isContentLead,
    read: isContentLead,
    update: isContentLead,
    delete: isContentLead,
  },
  fields: [
    {
      name: 'comment',
      label: 'Comment',
      type: 'textarea',
      required: true,
      maxLength: 4_000,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      name: 'resolutionStatus',
      label: 'Resolution status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Planned', value: 'planned' },
        { label: 'In progress', value: 'in-progress' },
        { label: 'Needs approval', value: 'needs-approval' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Won’t fix', value: 'wont-fix' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'triageSummary',
      label: 'Triage summary',
      type: 'textarea',
      maxLength: 500,
    },
    {
      name: 'classification',
      label: 'Classification',
      type: 'select',
      index: true,
      options: [
        { label: 'Bug', value: 'bug' },
        { label: 'Content change', value: 'content-change' },
        { label: 'Feature request', value: 'feature-request' },
        { label: 'Unclear', value: 'unclear' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Spam', value: 'spam' },
        { label: 'Appreciation', value: 'appreciation' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'risk',
      label: 'Change risk',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'requesterRank',
      label: 'Requester rank',
      type: 'select',
      options: [
        { label: 'High', value: 'high' },
        { label: 'Standard', value: 'standard' },
        { label: 'Low', value: 'low' },
        { label: 'Unmatched', value: 'unmatched' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'areaRelevance',
      label: 'Ministry area relevance',
      type: 'select',
      options: [
        { label: 'Own area', value: 'own-area' },
        { label: 'Adjacent area', value: 'adjacent-area' },
        { label: 'Outside area', value: 'outside-area' },
        { label: 'Unknown', value: 'unknown' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'priority',
      label: 'Work priority',
      type: 'select',
      index: true,
      options: [
        { label: 'Urgent', value: 'urgent' },
        { label: 'High', value: 'high' },
        { label: 'Normal', value: 'normal' },
        { label: 'Low', value: 'low' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'recommendation',
      label: 'Recommendation',
      type: 'select',
      options: [
        { label: 'Work on it', value: 'work-on-it' },
        { label: 'Won’t fix', value: 'wont-fix' },
        { label: 'Needs more information', value: 'needs-more-information' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'recommendationRationale',
      label: 'Recommendation rationale',
      type: 'textarea',
      maxLength: 2_000,
    },
    {
      name: 'requesterTeamMember',
      label: 'Matched team member',
      type: 'relationship',
      relationTo: 'team-members',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'requesterNameSnapshot',
      label: 'Requester name at triage',
      type: 'text',
      maxLength: 256,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'requesterRoleSnapshot',
      label: 'Requester role at triage',
      type: 'text',
      maxLength: 256,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'requesterTeamGroupSnapshot',
      label: 'Requester team group at triage',
      type: 'select',
      options: [
        { label: 'Staff', value: 'staff' },
        { label: 'Leadership', value: 'leadership' },
        { label: 'Apprentices', value: 'apprentices' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'duplicateOf',
      label: 'Duplicate of',
      type: 'relationship',
      relationTo: 'feedback-submissions',
      index: true,
      validate: validateDuplicateReference,
      admin: { position: 'sidebar' },
    },
    {
      name: 'triagedAt',
      label: 'Triaged at',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'triageRunId',
      label: 'Triage run ID',
      type: 'text',
      maxLength: 128,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'triageVersion',
      label: 'Triage version',
      type: 'text',
      maxLength: 64,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'deliveryKind',
      label: 'Delivery kind',
      type: 'select',
      options: [
        { label: 'Content', value: 'content' },
        { label: 'Code', value: 'code' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'deliveryPhase',
      label: 'Delivery phase',
      type: 'select',
      index: true,
      options: [
        { label: 'Content update', value: 'content-update' },
        { label: 'Branch created', value: 'branch-created' },
        { label: 'PR open', value: 'pr-open' },
        { label: 'CI passed', value: 'ci-passed' },
        { label: 'Merged', value: 'merged' },
        { label: 'Deployment started', value: 'deployment-started' },
        { label: 'Deployed', value: 'deployed' },
        { label: 'Verified', value: 'verified' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    ...([
      ['deliveryRunId', 'Delivery run ID', 128],
      ['deliveryBranch', 'Delivery branch', 255],
      ['deliveryPrUrl', 'Delivery PR URL', 2_048],
      ['deliveryMergeCommit', 'Delivery merge commit', 64],
      ['deliveryDeploymentId', 'Railway deployment ID', 128],
    ] as const).map(([name, label, maxLength]) => ({
      name,
      label,
      type: 'text' as const,
      maxLength,
      admin: { position: 'sidebar' as const, readOnly: true },
    })),
    {
      name: 'deliveryVerificationResult',
      label: 'Delivery verification',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Passed', value: 'passed' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'deliveryLastVerifiedAt',
      label: 'Delivery last verified',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'deliveryFailureNote',
      label: 'Delivery failure',
      type: 'textarea',
      maxLength: 500,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'sourceUrl',
      label: 'Page URL',
      type: 'text',
      required: true,
      maxLength: 2_048,
    },
    {
      name: 'postHogSessionId',
      label: 'PostHog session ID',
      type: 'text',
      maxLength: MAX_POSTHOG_SESSION_ID_LENGTH,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'postHogReplayUrl',
      label: 'Session replay',
      type: 'text',
      maxLength: MAX_POSTHOG_REPLAY_URL_LENGTH,
      validate: (value: unknown) =>
        !value || parsePostHogReplayUrl(value)
          ? true
          : 'Enter a valid PostHog session replay URL.',
      admin: {
        readOnly: true,
        components: {
          Field: '@/components/admin/PostHogReplayLink',
        },
      },
    },
    {
      name: 'clientAddressDigest',
      label: 'Client address digest',
      type: 'text',
      required: true,
      maxLength: 128,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'userAgent',
      label: 'User agent',
      type: 'text',
      maxLength: 512,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'notificationStatus',
      label: 'Notification status',
      type: 'select',
      required: true,
      defaultValue: 'disabled',
      index: true,
      options: [
        { label: 'Disabled', value: 'disabled' },
        { label: 'Pending', value: 'pending' },
        { label: 'Sending', value: 'sending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationRecipient',
      label: 'Intended notification recipient',
      type: 'email',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationAttemptCount',
      label: 'Notification attempts',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationWindowStartedAt',
      label: 'Notification recovery window started',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationLastAttemptAt',
      label: 'Last notification attempt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationLeaseToken',
      label: 'Notification lease token',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true, hidden: true },
    },
    {
      name: 'notificationLeaseExpiresAt',
      label: 'Notification lease expiry',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true, hidden: true },
    },
    {
      name: 'notificationSentAt',
      label: 'Notification sent',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationProviderId',
      label: 'Notification provider ID',
      type: 'text',
      maxLength: 256,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationError',
      label: 'Notification failure',
      type: 'textarea',
      maxLength: 200,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
