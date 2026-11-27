import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GivingOpportunityStep, GUIDED_OPPORTUNITIES } from './GivingOpportunityStep'

const actions = { onContinue: () => {}, onSkip: () => {}, onBack: () => {}, onGreatestNeed: () => {} }
describe('guided giving opportunities', () => {
  it.each(GUIDED_OPPORTUNITIES)('shows %s with its own goal, optional amount and Greatest Need alternative', id => {
    const html = renderToStaticMarkup(<GivingOpportunityStep id={id} locked={false} editing={false} {...actions} />)
    expect(html).not.toContain('Giving steps')
    const index=GUIDED_OPPORTUNITIES.indexOf(id)+1
    expect(html).toContain(`aria-label="Opportunity ${index} of 4"`)
    expect(html.replace(/<!--.*?-->/g,'')).toContain(`${index}/4`)
    expect(html).toContain('$1,000')
    expect(html).toContain('$5,000')
    expect(html).toContain('How much would you like to give?')
    expect(html).toContain('Skip this opportunity')
    expect(html).toContain('Give to greatest need')
    expect(html).not.toContain('Any gifts you’ve already chosen will be kept.')
    expect(html).toContain('role="progressbar"')
    expect(html).not.toContain('Your gift cart')
  })
  it('presents Greatest Need as one separate gift with no goal or proportional allocation copy', () => {
    const html = renderToStaticMarkup(<GivingOpportunityStep id="greatest-need" locked={false} editing={false} {...actions} />)
    expect(html).toContain('Continue to payment')
    expect(html).not.toContain('Review your gifts')
    expect(html).not.toContain('Skip this opportunity')
    expect(html).not.toContain('>Goal<')
    expect(html).not.toContain('progressbar')
    expect(html).not.toContain('proportional')
    expect(html).not.toContain('Giving steps')
    expect(html).not.toContain('of 4')
  })
  it('restores an amount for review editing and provides save and remove actions', () => {
    const html = renderToStaticMarkup(<GivingOpportunityStep id="plant" amount={20_000} locked={false} editing {...actions} />)
    expect(html).toContain('value="200"')
    expect(html.replace(/<!--.*?-->/g,'')).toContain('1. Plant')
    expect(html).toContain('The Next Church Beyond Auckland')
    expect(html).toContain('mt-1 block text-base')
    expect(html).toContain('Save changes')
    expect(html).toContain('Remove this gift')
  })
})
