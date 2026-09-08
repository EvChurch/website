import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

import { communicationInput } from './communication'
import { deliverFeedbackCommunication, feedbackCommunicationHistory, prepareFeedbackCommunication } from './communication-store'

export const feedbackCommunicationAuth: NonNullable<MCPPluginConfig['overrideAuth']> = async (req, getDefault) => {
  const access = await getDefault()
  // Custom handlers do not receive the MCP user automatically. Keep their authorization
  // independent of any browser login attached to this HTTP request.
  const roles = access.user && 'roles' in access.user ? access.user.roles : undefined
  const feedback = access.feedbackSubmissions as { find?: boolean; update?: boolean } | undefined
  req.context.canCommunicateFeedback = Boolean(
    feedback?.find && feedback?.update &&
    Array.isArray(roles) && roles.some(role => role === 'admin' || role === 'content-lead'),
  )
  return access
}

function requireAccess(req: PayloadRequest) {
  if (req.context.canCommunicateFeedback !== true) throw new Error('Feedback communication access denied.')
}

export const feedbackCommunicationTools: NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']> = [
  {
    name: 'sendFeedbackUpdate',
    description: 'Immediately email the feedback submitter an agent-written received-and-triaged, finished, or closed update. Save feedback status first. Finished requires verified/passed delivery. Only combine outcomes belonging to the same submitter. Recipient is derived from feedback, never supplied. Duplicate lifecycle events return the original send record. Read findFeedbackUpdates before sending. Never include internal notes or another submitter’s information.',
    parameters: communicationInput.shape,
    handler: async (args, req) => {
      requireAccess(req)
      const input = communicationInput.parse(args)
      const id = await prepareFeedbackCommunication(req.payload.db.pool, input, process.env.SITE_FEEDBACK_EMAIL_FROM?.trim() ?? '')
      const result = await deliverFeedbackCommunication(req.payload.db.pool, id)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  },
  {
    name: 'findFeedbackUpdates',
    description: 'Read email communication history for a feedback submission, including combined-message contents, delivery status and provider acceptance ID. Sent means provider accepted, not inbox delivery. This does not send email.',
    parameters: { feedbackId: z.number().int().positive() },
    handler: async (args, req) => {
      requireAccess(req)
      const id = z.number().int().positive().parse(args.feedbackId)
      return { content: [{ type: 'text', text: JSON.stringify(await feedbackCommunicationHistory(req.payload.db.pool, id)) }] }
    },
  },
]
