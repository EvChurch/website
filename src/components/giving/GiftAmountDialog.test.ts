import { describe, expect, it } from 'vitest'
import { giftAmountMinor } from './GiftAmountDialog'
import { snapshotCart } from '@/lib/giving/cart'
import { campaignCartCatalog } from '@/lib/giving/cart-preview'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GiftAmountDialog } from './GiftAmountDialog'

describe('gift amount choices', () => {
  it('offers update and removal only when editing an existing gift', () => {
    const props = { title: 'Build', suggestions: [8000,20000,50000], onConfirm: () => {}, onClose: () => {} }
    const adding = renderToStaticMarkup(createElement(GiftAmountDialog, props))
    expect(adding).toContain('Add gift to cart')
    expect(adding).not.toContain('Remove gift')
    const editing = renderToStaticMarkup(createElement(GiftAmountDialog, { ...props, currentAmount: 50000, onRemove: () => {} }))
    expect(editing).toContain('Update Gift')
    expect(editing).not.toContain('Add gift to cart')
    expect(editing).toContain('aria-label="Remove gift"')
    expect(editing).toContain('value="500"')
  })
  it.each([['1',100], ['5',500], ['25',2500], [' 50 ',5000], ['999999',99999900]])('parses whole dollars %s as exact cents', (value, amount) => {
    expect(giftAmountMinor(value)).toBe(amount)
  })
  it.each(['','0','0.99','-5','1.001','1e3','Infinity','1000000','abc','5.5','25.50','50.00','999999.99','1.'])('rejects an invalid amount %s', value => {
    expect(giftAmountMinor(value)).toBeNull()
  })
  it('allows donor-chosen amounts only on products that explicitly support them', () => {
    const cart = { location:'Central', lines:[{ productId:'build',quantity:1,customAmountMinor:2500 }] }
    expect(snapshotCart(cart,campaignCartCatalog(false)).amountMinor).toBe(2500)
    const fixed = campaignCartCatalog(true).map(product => ({ ...product, allowCustomAmount:false }))
    expect(() => snapshotCart(cart,fixed)).toThrow('Custom amounts are not available')
  })
  it('uses the approved $80, $200 and $500 choices in every gift dialog', () => {
    for (const sample of [false,true]) for (const product of campaignCartCatalog(sample)) {
      expect(product.suggestedAmountsMinor).toEqual([8000,20000,50000])
    }
  })
})
