import { expect, test } from '@playwright/test'
import { completeGuestIdentity, mockGivingContracts, mockedUiEnabled, openGiving } from './helpers'

test.describe('giving mocked composed UI contract — not provider proof', () => {
  test.skip(!mockedUiEnabled, 'Set GIVING_E2E_MOCKED_UI_BASE_URL to an eligible local/preview fixture')
  test('one-off configuration submits once to the mocked hosted boundary', async ({page}) => {
    await mockGivingContracts(page,[{state:'verified',retryAllowed:false,kind:'one-off'}])
    await openGiving(page)
    await page.getByLabel('NZD amount').fill('25')
    await page.getByRole('button',{name:'Continue'}).click()
    await page.getByRole('radio',{name:'General'}).click()
    await page.getByRole('button',{name:/Just this once/i}).click()
    await completeGuestIdentity(page)
    await page.getByRole('button',{name:/Continue to BlinkPay/i}).click()
    await expect(page).toHaveURL('https://sandbox.secure.blinkpay.co.nz/gateway/mock')
  })
})
