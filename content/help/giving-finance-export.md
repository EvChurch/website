## Download giving records

Website administrators can open **Giving → Gifts** in the [administration area](/admin) and choose **Finance CSV (this month)** in the giving record shortcuts.

The export contains production payment records from both online gateways. Sandbox test data and unverified manual-transfer acknowledgements are excluded.

For another period, use the [finance export](/api/admin/giving/export) with `from` and `to` dates, such as `?from=2026-10-01&to=2026-10-31`. Dates include the selected days in New Zealand time. Choose at most one year and 25,000 gifts per download.

## Read the columns

Gift amounts, donor-paid fees, processing fees and net amounts are in **NZD cents**. Fund codes and accounting keys identify the gift allocation. Checkout, payment and charge references help locate the source records.

A successful payment is separate from payout to Ev’s bank account. Payout references are recorded when available from Stripe; an empty field means no payout reference has been recorded. It does not establish that a payment failed. Compare the export with provider reports and bank deposits.

The original charge is retained after a refund. `refunded_cents` shows successful refunds, `refund_pending_cents` shows refunds still being processed, and `retained_charge_cents` is the original charge less successful refunds. Refund amounts include any returned donor-paid fee; they do not allocate a partial refund between gift and fee. Blank refund fields mean they have not yet been verified. `refunds_verified_at` records the latest check. Processor fees and processor net describe the original charge and exclude refund adjustments. Refund changes appear on the original payment’s row, so re-export that payment’s date range after a later refund.

Dispute status identifies card payments requiring review. Handle disputes and staff notifications in Stripe. This feature does not provide refund tools or generate annual charitable tax receipts. Donor-paid fees are separate and are not automatically classified as tax-receiptable donations.

The CSV contains donor information. Keep it within authorised finance workflows.
