import { expect, test } from '@playwright/test'
import { completeGuestIdentity, mockGivingContracts, mockedUiEnabled, openGiving } from './helpers'

test.describe('recurring giving mocked composed UI contract — not provider proof', () => {
  test.skip(!mockedUiEnabled, 'Set GIVING_E2E_MOCKED_UI_BASE_URL to an eligible local/preview fixture')
  test('monthly remains prominent and submits a starting date to the mocked hosted boundary', async ({page}) => {
    await mockGivingContracts(page,[{state:'unknown',retryAllowed:false,kind:'recurring'}])
    await openGiving(page)
    await page.getByLabel('NZD amount').fill('50')
    await page.getByRole('button',{name:'Continue'}).click()
    await expect(page.getByRole('button',{name:/Monthly/i})).toBeVisible()
    await expect(page.getByRole('button',{name:/One-off/i})).toBeVisible()
    await page.getByRole('button',{name:/Monthly/i}).click()
    await page.getByRole('button',{name:/Tomorrow/i}).click()
    await completeGuestIdentity(page)
    await page.getByRole('button',{name:/Continue to secure bank authorisation/i}).click()
    await expect(page).toHaveURL('https://sandbox.debit.blinkpay.co.nz/gateway/mock')
  })
})
