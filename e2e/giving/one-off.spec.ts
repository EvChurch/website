import { expect, test } from '@playwright/test'
import { completeGuestIdentity, mockGivingContracts, mockedUiEnabled, openGiving } from './helpers'

test.describe('giving mocked composed UI contract — not provider proof', () => {
  test.skip(!mockedUiEnabled, 'Set GIVING_E2E_MOCKED_UI_BASE_URL to an eligible local/preview fixture')
  test('one-off configuration submits once to the mocked hosted boundary', async ({page}) => {
    await mockGivingContracts(page,[{state:'verified',retryAllowed:false,kind:'one-off'}])
    await openGiving(page)
    await page.getByLabel('NZD amount').fill('25')
    await page.getByRole('button',{name:'Continue'}).click()
    await page.getByRole('button',{name:/One-off gift/i}).click()
    await completeGuestIdentity(page)
    await page.getByRole('button',{name:/Continue to secure bank authorisation/i}).click()
    await expect(page).toHaveURL('https://sandbox.debit.blinkpay.co.nz/gateway/mock')
  })
})
