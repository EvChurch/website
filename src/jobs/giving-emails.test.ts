import { describe,expect,it } from 'vitest'

import { givingEmailJobConfigs, RECONCILE_GIVING_EMAILS_TASK, SEND_GIVING_EMAIL_TASK } from './giving-emails'

describe('giving email job registration',()=>{
  it('runs sends and minute reconciliation on the existing notifications queue',()=>{
    expect(givingEmailJobConfigs.map(({slug})=>slug)).toEqual([SEND_GIVING_EMAIL_TASK,RECONCILE_GIVING_EMAILS_TASK])
    expect(givingEmailJobConfigs[1]?.schedule).toEqual([{cron:'* * * * *',queue:'notifications'}])
  })
})
