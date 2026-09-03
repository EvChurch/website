import type { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

import { givingBankTransferDetails } from './bank-transfer'
import { createGivingBankAcknowledgementUrl } from './email-links'

export type GivingEmailKind = 'bank-transfer-details' | 'bank-transfer-thanks' | 'blinkpay-thanks'

export interface GivingEmailSource {
  id: number
  checkoutId: number
  kind: GivingEmailKind
  email: string
  name: string
  bankReference: string
  bankCode: string
  fundCode: string
  fundName: string
  amountMinor: number
  transactionFeeMinor: number
  frequency: 'one-off' | 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'annual'
  firstPaymentDate: string | null
  leaseToken: string
}

export interface GivingEmailMessage { to: string; subject: string; text: string; html: string }
export interface GivingEmailTransport { send(message: GivingEmailMessage, idempotencyKey: string): Promise<{ providerId: string }> }
export interface GivingEmailBuildOptions { acknowledgementUrl?: string }
type ClaimResult = { status: 'claimed'; delivery: GivingEmailSource } | { status: 'skipped' }

const LEASE_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 6
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const STEVE_MULLINS_AVATAR_URL = 'https://www.ev.church/api/media/file/steve-mullins-1.jpg'
const EXECUTIVE_COMMITTEE_URL = 'https://www.ev.church/give#executive-committee'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[character] ?? character)
}

function giftSummary(source: GivingEmailSource) {
  const formatter = new Intl.NumberFormat('en-NZ', { style:'currency', currency:'NZD' })
  const amount = formatter.format(source.amountMinor / 100)
  const amountWithFee = source.transactionFeeMinor > 0
    ? `${amount} plus a ${formatter.format(source.transactionFeeMinor / 100)} transaction fee`
    : amount
  if (source.frequency === 'one-off') return `${amountWithFee} to ${source.fundName}, just this once`
  const frequency = ({ daily:'each day',weekly:'each week',fortnightly:'every two weeks',monthly:'each month',annual:'each year' } as const)[source.frequency]
  return `${amountWithFee} to ${source.fundName} ${frequency}${source.firstPaymentDate ? `, starting ${source.firstPaymentDate}` : ''}`
}

function partnershipMessage(source: GivingEmailSource) {
  const heading = source.frequency === 'one-off'
    ? 'Thank you for your partnership in the gospel.'
    : 'Thank you for your faithful partnership in the gospel.'
  const gratitude = source.frequency === 'one-off'
    ? 'We thank God for you and for the generosity you’ve shown.'
    : 'We thank God for you and for your regular commitment to gospel ministry through Ev.'
  const impact = 'Together with others across our church family, you’re helping sustain gospel ministry so people across Auckland can hear about Jesus, grow in him, and be equipped to serve.'
  const verse = '“I thank my God every time I remember you… because of your partnership in the gospel from the first day until now.” — Philippians 1:3–5'
  const closing = 'We’re genuinely grateful to be partnering with you in this work.'

  return {
    text: [heading, gratitude, '', impact, '', verse, '', closing].join('\n'),
    html: `<p><strong>${escapeHtml(heading)}</strong></p><p>${escapeHtml(gratitude)}</p><p>${escapeHtml(impact)}</p><blockquote style="border-left:4px solid #E22A30;margin:24px 0;padding:8px 18px">${escapeHtml(verse)}</blockquote><p>${escapeHtml(closing)}</p>`,
  }
}

function executiveCommitteeSignOff() {
  return {
    text: ['God bless,', '', 'Steve Mullins', `On behalf of the Executive Committee of Ev Church: ${EXECUTIVE_COMMITTEE_URL}`].join('\n'),
    html: `<p style="margin-bottom:24px">God bless,</p><table role="presentation" style="border-collapse:collapse"><tbody><tr><td style="padding:0 14px 0 0;vertical-align:middle"><div style="border-radius:999px;height:64px;overflow:hidden;width:64px"><img src="${STEVE_MULLINS_AVATAR_URL}" alt="Steve Mullins" width="107" height="160" style="display:block;height:160px;margin-left:-22px;margin-top:-8px;max-width:none;width:107px"></div></td><td style="padding:0;vertical-align:middle"><strong>Steve Mullins</strong><br>On behalf of the <a href="${EXECUTIVE_COMMITTEE_URL}" style="color:#E22A30;text-decoration:underline">Executive Committee of Ev Church</a></td></tr></tbody></table>`,
  }
}

export function buildGivingEmail(source: GivingEmailSource, now = new Date(), options: GivingEmailBuildOptions = {}): GivingEmailMessage {
  const firstName = source.name.trim().split(/\s+/u)[0] || 'there'
  const summary = giftSummary(source)
  if (source.kind === 'bank-transfer-details') {
    const details = givingBankTransferDetails(source.fundCode, source.bankCode, source.bankReference)
    const acknowledgementUrl = options.acknowledgementUrl ?? createGivingBankAcknowledgementUrl(source.checkoutId, now)
    const text = [
      `Hi ${firstName},`, '', 'Here are the bank details for the gift you prepared at ev.church.', '',
      `Gift: ${summary}`, `Account name: ${details.accountName}`, `Account number: ${details.accountNumber}`,
      `Particulars: ${details.particulars}`, `Code: ${details.code}`, `Reference: ${details.reference}`, '',
      `Once you have set this up in your banking app, confirm it here: ${acknowledgementUrl}`, '',
      'Ev cannot verify a manual bank transfer from the website. This link records that you have set it up.',
    ].join('\n')
    return {
      to: source.email,
      subject: 'Your giving details from Ev Church',
      text,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p>Here are the bank details for the gift you prepared at ev.church.</p><p><strong>Gift:</strong> ${escapeHtml(summary)}</p><table role="presentation" style="border-collapse:collapse"><tbody><tr><td><strong>Account name</strong></td><td>${escapeHtml(details.accountName)}</td></tr><tr><td><strong>Account number</strong></td><td>${escapeHtml(details.accountNumber)}</td></tr><tr><td><strong>Particulars</strong></td><td>${escapeHtml(details.particulars)}</td></tr><tr><td><strong>Code</strong></td><td>${escapeHtml(details.code)}</td></tr><tr><td><strong>Reference</strong></td><td>${escapeHtml(details.reference)}</td></tr></tbody></table><p><a href="${escapeHtml(acknowledgementUrl)}" style="display:inline-block;border-radius:999px;background:#E22A30;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700">I’ve set this up</a></p><p><small>Ev cannot verify a manual bank transfer from the website. This link records that you have set it up.</small></p>`,
    }
  }
  const confirmation = source.kind === 'bank-transfer-thanks'
    ? 'We’ve recorded that you’ve set up your bank transfer. Your bank will make the transfer; Ev hasn’t verified a payment yet.'
    : source.frequency === 'one-off'
      ? 'Your gift is confirmed.'
      : 'Your recurring gift is confirmed and its schedule is active.'
  const detailLabel = source.kind === 'bank-transfer-thanks' ? 'Gift setup' : 'Confirmed gift'
  const partnership = partnershipMessage(source)
  const signOff = executiveCommitteeSignOff()
  const subject = source.kind === 'bank-transfer-thanks'
    ? source.frequency === 'one-off'
      ? 'Thank you for setting up your gift to Ev Church'
      : 'Thank you for setting up regular giving to Ev Church'
    : source.frequency === 'one-off'
      ? 'Thank you for your gift to Ev Church'
      : 'Thank you for your regular giving to Ev Church'
  return {
    to: source.email,
    subject,
    text: [`Hi ${firstName},`, '', confirmation, '', `${detailLabel}: ${summary}`, '', partnership.text, '', signOff.text].join('\n'),
    html: `<p>Hi ${escapeHtml(firstName)},</p><p><strong>${escapeHtml(confirmation)}</strong></p><p><strong>${escapeHtml(detailLabel)}:</strong> ${escapeHtml(summary)}</p>${partnership.html}${signOff.html}`,
  }
}

export function createGivingEmailStore(pool: Pool) {
  return {
    async claim(id: number, now = new Date()): Promise<ClaimResult> {
      const leaseToken = randomUUID()
      const leaseExpires = new Date(now.getTime() + LEASE_MS)
      const result = await pool.query(`UPDATE giving_email_deliveries delivery SET
          status='sending',attempt_count=attempt_count+1,lease_token=$2,lease_expires_at=$3,last_attempt_at=$4,updated_at=now()
        FROM giving_checkouts checkout JOIN giving_givers giver ON giver.id=checkout.giver_id
        WHERE delivery.id=$1 AND checkout.id=delivery.checkout_id AND delivery.attempt_count<$5
          AND checkout.environment='production' AND checkout.synthetic=false
          AND (delivery.status='pending' OR delivery.status='sending' AND delivery.lease_expires_at<$4)
          AND (delivery.kind<>'bank-transfer-details' OR checkout.bank_details_prepared_at IS NOT NULL)
          AND (delivery.kind<>'bank-transfer-thanks' OR checkout.bank_setup_acknowledged_at IS NOT NULL)
          AND (delivery.kind<>'blinkpay-thanks' OR checkout.status='completed' AND checkout.result_code='verified')
        RETURNING delivery.id,delivery.checkout_id,delivery.kind,giver.email,giver.name,giver.bank_reference,
          checkout.bank_code,checkout.fund_code,checkout.fund_name,checkout.amount_minor,checkout.transaction_fee_minor,checkout.frequency,checkout.first_payment_date`,
      [id, leaseToken, leaseExpires, now, MAX_ATTEMPTS])
      const row = result.rows[0] as Record<string, unknown> | undefined
      if (!row) return { status:'skipped' }
      return { status:'claimed', delivery: {
        id:Number(row.id),checkoutId:Number(row.checkout_id),kind:String(row.kind) as GivingEmailKind,
        email:String(row.email),name:String(row.name),bankReference:String(row.bank_reference),bankCode:String(row.bank_code),
        fundCode:String(row.fund_code),fundName:String(row.fund_name),amountMinor:Number(row.amount_minor),transactionFeeMinor:Number(row.transaction_fee_minor),
        frequency:String(row.frequency) as GivingEmailSource['frequency'],firstPaymentDate:row.first_payment_date ? String(row.first_payment_date).slice(0,10) : null,leaseToken,
      } }
    },
    async markSent(id: number, leaseToken: string, providerId: string, now = new Date()) {
      const result = await pool.query(`UPDATE giving_email_deliveries SET status='sent',sent_at=$3,provider_id=$4,error_code=NULL,
        lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND status='sending' AND lease_token=$2`, [id,leaseToken,now,providerId])
      if (result.rowCount !== 1) throw new Error('Giving email delivery lease was lost')
    },
    async release(id: number, leaseToken: string) {
      const result = await pool.query(`UPDATE giving_email_deliveries SET status=CASE WHEN attempt_count>=$3 THEN 'failed' ELSE 'pending' END,
        error_code='delivery-failed',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND status='sending' AND lease_token=$2`, [id,leaseToken,MAX_ATTEMPTS])
      if (result.rowCount !== 1) throw new Error('Giving email delivery lease was lost')
    },
    async recoverable(now = new Date()) {
      const result = await pool.query<{id:number}>(`SELECT delivery.id FROM giving_email_deliveries delivery
        JOIN giving_checkouts checkout ON checkout.id=delivery.checkout_id
        WHERE delivery.attempt_count<$2 AND checkout.environment='production' AND checkout.synthetic=false
          AND (delivery.status='pending' OR delivery.status='sending' AND delivery.lease_expires_at<$1)
        ORDER BY delivery.created_at ASC LIMIT 100`, [now,MAX_ATTEMPTS])
      return result.rows.map(({id}) => Number(id))
    },
  }
}

export function createResendGivingEmailTransport(fetchImplementation: typeof fetch = globalThis.fetch): GivingEmailTransport {
  return { async send(message, idempotencyKey) {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = process.env.GIVING_EMAIL_FROM?.trim() || process.env.SITE_FEEDBACK_EMAIL_FROM?.trim()
    if (!apiKey || !from) throw new Error('Giving email provider is not configured')
    const response = await fetchImplementation(RESEND_EMAILS_URL,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text,html:message.html}),signal:AbortSignal.timeout(10_000)})
    let value: unknown = null
    try { value = await response.json() } catch { /* handled below */ }
    const providerId = value && typeof value === 'object' && !Array.isArray(value) && typeof (value as {id?:unknown}).id === 'string' ? (value as {id:string}).id : null
    if (!response.ok || !providerId) throw new Error('Giving email provider rejected the request')
    return { providerId }
  } }
}

export async function deliverGivingEmail(input: { id:number; pool:Pool; transport:GivingEmailTransport; now?:Date }) {
  const store = createGivingEmailStore(input.pool)
  const claim = await store.claim(input.id, input.now)
  if (claim.status === 'skipped') return { sent: false }

  let providerId: string
  try {
    const result = await input.transport.send(
      buildGivingEmail(claim.delivery, input.now),
      `giving/${claim.delivery.checkoutId}/${claim.delivery.kind}`,
    )
    providerId = result.providerId
  } catch {
    await store.release(claim.delivery.id, claim.delivery.leaseToken)
    throw new Error('Giving email delivery failed')
  }

  try {
    await store.markSent(claim.delivery.id, claim.delivery.leaseToken, providerId, input.now)
  } catch {
    throw new Error('Giving email state update failed')
  }
  return { sent: true }
}
