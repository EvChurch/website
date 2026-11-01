import type { TaskConfig } from 'payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { reconcileStripeGiving } from '@/lib/giving/stripe/lifecycle'
import { GIVING_LIFECYCLE_QUEUE } from './giving'

export const stripeGivingTask:TaskConfig<{input:Record<string,never>;output:{processed:number;failures:number}}>={
  slug:'reconcileStripeGiving',retries:1,inputSchema:[],outputSchema:[{name:'processed',type:'number',required:true},{name:'failures',type:'number',required:true}],
  schedule:[{cron:'* * * * *',queue:GIVING_LIFECYCLE_QUEUE}],
  handler:async({req})=>({output:await reconcileStripeGiving(requireGivingPostgresPool(req.payload))}),
}
