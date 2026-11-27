import type Stripe from 'stripe'
import { z } from 'zod'

// Checkout owns money and line identity; gift-specific accounting stays on each line.
// A future product catalog can use the same snapshot without becoming a giving fund.
export interface CartProduct {
  id: string
  title: string
  fixedAmountMinor: number | null
  allowCustomAmount?: boolean
  suggestedAmountsMinor?: readonly number[]
  allocation: { reference: string; glCode: string; glName: string; project: string }
}
export interface CartLine extends CartProduct {
  fixedAmountMinor: number
  quantity: number
  amountMinor: number
}
export interface CartSnapshot {
  currency: 'nzd'
  location: string
  lines: CartLine[]
  amountMinor: number
}

const submission = z.object({
  location: z.string().trim().min(1).max(100).optional(),
  lines: z.array(z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(100), customAmountMinor: z.number().int().min(100).max(99_999_900).multipleOf(100).optional() }).strict()).min(1).max(50),
}).strict()

export function snapshotCart(value: unknown, catalog: readonly CartProduct[]): CartSnapshot {
  const input = submission.parse(value)
  const seen = new Set<string>()
  const lines = input.lines.map(({ productId, quantity, customAmountMinor }) => {
    const product = catalog.find(item => item.id === productId)
    if (!product || seen.has(productId)) throw new Error('Invalid cart item')
    seen.add(productId)
    if (customAmountMinor !== undefined && !product.allowCustomAmount) throw new Error('Custom amounts are not available for this item')
    const price = customAmountMinor ?? product.fixedAmountMinor
    if (price === null || !Number.isSafeInteger(price) || price < 100) throw new Error('Fixed gift amounts need confirmation')
    const amountMinor = price * quantity
    if (!Number.isSafeInteger(amountMinor)) throw new Error('Invalid cart total')
    return { ...product, allocation: { ...product.allocation }, fixedAmountMinor: price, quantity, amountMinor }
  })
  const amountMinor = lines.reduce((total, line) => total + line.amountMinor, 0)
  if (!Number.isSafeInteger(amountMinor) || amountMinor > 99_999_999) throw new Error('Invalid cart total')
  // An empty reporting location means unresolved; never infer a campus from the selected fund.
  return { currency: 'nzd', location: input.location ?? '', lines, amountMinor }
}

// Matches the site's existing one-off Stripe Checkout contract. No SDK client or credentials here.
export function stripeCartRequest(cart: CartSnapshot): Stripe.Checkout.SessionCreateParams {
  return {
    ui_mode: 'elements', mode: 'payment', currency: 'nzd', allowed_payment_method_types: ['card'],
    automatic_tax: { enabled: false }, adaptive_pricing: { enabled: false },
    line_items: cart.lines.map(line => ({
      quantity: line.quantity,
      price_data: { currency: cart.currency, unit_amount: line.fixedAmountMinor, product_data: { name: line.title, metadata: { reference: line.allocation.reference } } },
    })),
  }
}

export interface CartReportRow {
  paymentId: string
  reference: string
  glCode: string
  glName: string
  project: string
  location: string
  amountMinor: number
  synthetic: true
}
