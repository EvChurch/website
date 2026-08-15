import { expect, type Page } from '@playwright/test'

export const mockedUiEnabled = Boolean(process.env.GIVING_E2E_MOCKED_UI_BASE_URL)
export const productionOriginEnabled = Boolean(process.env.GIVING_E2E_PRODUCTION_BASE_URL && process.env.GIVING_E2E_ADMIN_EMAIL && process.env.GIVING_E2E_ADMIN_STORAGE_STATE)

export async function mockGivingContracts(page: Page, statuses: Array<{state:string;retryAllowed:boolean;kind:'one-off'|'recurring'}>) {
  let statusIndex = 0
  const checkoutBodies: Array<Record<string, unknown>> = []
  await page.route('**/api/giving/drafts', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({resumePath:'/give/resume/mock-draft'})})
    else await route.fulfill({status:204,body:''})
  })
  await page.route('**/api/giving/checkouts', async (route) => {
    checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({gatewayRedirectUri:'https://sandbox.debit.blinkpay.co.nz/gateway/mock'})})
  })
  await page.route('https://sandbox.debit.blinkpay.co.nz/gateway/mock', (route) => route.fulfill({status:200,contentType:'text/html',body:'<h1>Mock hosted gateway</h1>'}))
  await page.route('**/api/giving/checkouts/current/status', (route) => {
    const status = statuses[Math.min(statusIndex, statuses.length - 1)]
    statusIndex += 1
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(status)})
  })
  return { checkoutBodies }
}

export async function openGiving(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as {turnstile:unknown}).turnstile={render:(_element:HTMLElement,options:{callback:(token:string)=>void})=>{queueMicrotask(()=>options.callback('mock-turnstile-token'));return 'mock-widget'},reset:()=>undefined,remove:()=>undefined}
  })
  await page.goto('/')
  await page.getByRole('button',{name:/next step/i}).click()
  await page.getByRole('link',{name:'Give Now'}).click()
  await expect(page.getByRole('heading',{name:/How much would you like to give/i})).toBeVisible()
}

export async function completeGuestIdentity(page:Page) {
  await page.getByRole('textbox',{name:/first name/i}).fill('Ada')
  await page.getByRole('button',{name:'Continue'}).click()
  await page.getByRole('textbox',{name:/last name/i}).fill('Lovelace')
  await page.getByRole('button',{name:'Continue'}).click()
  await page.getByRole('textbox',{name:/email/i}).fill('ada@example.com')
  await page.getByRole('button',{name:'Continue'}).click()
  await expect(page.getByRole('heading',{name:'Review your gift'})).toBeVisible()
}

export async function activateProductionOriginSandbox(page: Page) {
  const baseURL = process.env.GIVING_E2E_PRODUCTION_BASE_URL!
  const runId = `playwright-${Date.now()}`
  const response = await page.request.post('/giving-e2e/start', {
    headers: { origin: new URL(baseURL).origin, 'sec-fetch-site':'same-origin', 'x-ev-giving-e2e-request':'start-v1', 'content-type':'application/json' },
    data: { runId },
  })
  expect(response.status()).toBe(201)
  const body = await response.json() as {csrf:string}
  return {runId,csrf:body.csrf}
}

export async function stopProductionOriginSandbox(page: Page, csrf: string) {
  const baseURL = process.env.GIVING_E2E_PRODUCTION_BASE_URL!
  const response=await page.request.post('/giving-e2e/stop', { headers:{origin:new URL(baseURL).origin,'sec-fetch-site':'same-origin','x-ev-giving-e2e-request':'stop-v1','x-ev-giving-e2e-csrf':csrf} })
  expect(response.ok()).toBe(true)
}
