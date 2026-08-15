import { expect, test } from '@playwright/test'
import { completeGuestIdentity, mockGivingContracts, mockedUiEnabled, openGiving } from './helpers'

test.describe('recurring giving mocked composed UI contract — not provider proof', () => {
  test.skip(!mockedUiEnabled, 'Set GIVING_E2E_MOCKED_UI_BASE_URL to an eligible local/preview fixture')
  test('monthly remains prominent and submits a starting date to the mocked hosted boundary', async ({page}) => {
    const contracts = await mockGivingContracts(page,[{state:'unknown',retryAllowed:false,kind:'recurring'}])
    await openGiving(page)
    await page.getByLabel('NZD amount').fill('50')
    await page.getByRole('button',{name:'Continue'}).click()
    await expect(page.getByRole('button',{name:/Monthly/i})).toBeVisible()
    await expect(page.getByRole('button',{name:/One-off/i})).toBeVisible()
    await page.getByRole('button',{name:/Monthly/i}).click()
    const tomorrow = page.getByRole('button',{name:/Tomorrow/i})
    const expectedDate = (await tomorrow.locator('span').last().textContent())?.trim()
    expect(expectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
    await tomorrow.click()
    await completeGuestIdentity(page)
    await page.getByRole('button',{name:/Continue to secure bank authorisation/i}).click()
    await expect(page).toHaveURL('https://sandbox.debit.blinkpay.co.nz/gateway/mock')
    expect(contracts.checkoutBodies).toHaveLength(1)
    expect(contracts.checkoutBodies[0]).toMatchObject({
      amountMinor: 5_000,
      frequency: 'monthly',
      firstPaymentDate: expectedDate,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      turnstileToken: 'mock-turnstile-token',
    })
    expect(contracts.checkoutBodies[0].fundId).toEqual(expect.any(Number))
    expect(contracts.checkoutBodies[0].submissionKey).toEqual(expect.any(String))
    expect(contracts.checkoutBodies[0]).not.toHaveProperty('startDate')
  })
})
