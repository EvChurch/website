import { expect, test } from '@playwright/test'
import { activateProductionOriginSandbox, productionOriginEnabled, stopProductionOriginSandbox } from './helpers'

test.describe('manual production-origin BlinkPay sandbox evidence', () => {
  test.skip(!productionOriginEnabled, 'Explicit production base URL, exact-admin credentials and authenticated storage state are required')
  test('protected session is visibly synthetic and tears down', async ({page}) => {
    const session = await activateProductionOriginSandbox(page)
    try {
      await page.goto('/')
      await page.getByRole('button',{name:/Open next steps/i}).click()
      await page.getByRole('link',{name:'Give Now'}).click()
      await expect(page.getByText(/TEST DATA · BlinkPay sandbox/i)).toBeVisible()
    } finally {
      await stopProductionOriginSandbox(page,session.csrf)
    }
  })

  test('one-off reaches the real BlinkPay sandbox Gateway without bank authorisation', async ({page}) => {
    test.info().annotations.push(
      {type:'prerequisite',description:'The authenticated browser must be in the launcher-giving-pilot PostHog test cohort.'},
      {type:'prerequisite',description:'The storage state must represent the exact Payload admin and the configured E2E Rock alias.'},
      {type:'manual',description:'Complete any interaction-only Turnstile prompt; stop after the hosted sandbox Gateway loads.'},
    )
    const session=await activateProductionOriginSandbox(page)
    try{
      await page.goto('/')
      await page.getByRole('button',{name:/Open next steps/i}).click()
      await page.getByRole('link',{name:'Give Now'}).click()
      const amountHeading=page.getByRole('heading',{name:/How much would you like to give/i})
      if(!await amountHeading.isVisible({timeout:15_000}))throw new Error('Giving did not open. Confirm the browser is in the approved PostHog test cohort and the protected admin session is valid.')
      await expect(page.getByText(/TEST DATA · BlinkPay sandbox/i)).toBeVisible()
      await page.getByLabel('NZD amount').fill('1.00')
      await page.getByRole('button',{name:'Continue'}).click()
      await page.getByRole('button',{name:/One-off gift/i}).click()
      if(await page.getByRole('heading',{name:/first name/i}).isVisible()){
        await page.getByRole('textbox',{name:/first name/i}).fill('EV')
        await page.getByRole('button',{name:'Continue'}).click()
        await page.getByRole('textbox',{name:/last name/i}).fill('Sandbox')
        await page.getByRole('button',{name:'Continue'}).click()
        await page.getByRole('textbox',{name:/email/i}).fill(process.env.GIVING_E2E_ADMIN_EMAIL!)
        await page.getByRole('button',{name:'Continue'}).click()
      }
      await expect(page.getByRole('heading',{name:'Review your gift'})).toBeVisible()
      await expect(page.getByText(/TEST DATA · BlinkPay sandbox/i)).toBeVisible()
      const submit=page.getByRole('button',{name:/Continue to secure bank authorisation/i})
      try{await expect(submit).toBeEnabled({timeout:60_000})}catch{throw new Error('Turnstile did not complete. Run this manual headed project and complete the interaction-only security prompt before its timeout.')}
      await submit.click()
      await page.waitForURL((url)=>url.origin==='https://sandbox.debit.blinkpay.co.nz',{timeout:30_000})
      expect(new URL(page.url()).origin).toBe('https://sandbox.debit.blinkpay.co.nz')
    }finally{await stopProductionOriginSandbox(page,session.csrf)}
  })
})
