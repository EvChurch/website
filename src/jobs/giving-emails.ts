import type { Payload, TaskConfig } from 'payload'

import { createGivingEmailStore, createResendGivingEmailTransport, deliverGivingEmail } from '@/lib/giving/email'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { SITE_FEEDBACK_NOTIFICATION_QUEUE } from '@/jobs/site-feedback-notification'

export const SEND_GIVING_EMAIL_TASK = 'sendGivingEmail'
export const RECONCILE_GIVING_EMAILS_TASK = 'reconcileGivingEmails'

async function queueRecoverable(payload: Payload) {
  const ids = await createGivingEmailStore(requireGivingPostgresPool(payload)).recoverable()
  await Promise.all(ids.map((id) => payload.jobs.queue({ task:SEND_GIVING_EMAIL_TASK,input:{id},queue:SITE_FEEDBACK_NOTIFICATION_QUEUE })))
  return { queued:ids.length }
}

const sendGivingEmailTask: TaskConfig<{input:{id:number};output:{sent:boolean}}> = {
    slug:SEND_GIVING_EMAIL_TASK,retries:0,
    inputSchema:[{name:'id',type:'number',required:true}],outputSchema:[{name:'sent',type:'checkbox',required:true}],
    handler:async({input,req})=>({output:await deliverGivingEmail({id:input.id,pool:requireGivingPostgresPool(req.payload),transport:createResendGivingEmailTransport()})}),
}
const reconcileGivingEmailsTask: TaskConfig<{input:Record<string,never>;output:{queued:number}}> = {
    slug:RECONCILE_GIVING_EMAILS_TASK,retries:1,
    inputSchema:[],outputSchema:[{name:'queued',type:'number',required:true}],schedule:[{cron:'* * * * *',queue:SITE_FEEDBACK_NOTIFICATION_QUEUE}],
    handler:async({req})=>({output:await queueRecoverable(req.payload)}),
}

export const givingEmailJobConfigs = [sendGivingEmailTask,reconcileGivingEmailsTask]
