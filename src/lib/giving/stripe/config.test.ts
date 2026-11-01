import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {loadStripeGivingConfig,stripeGivingAvailable} from './config'
describe('Stripe giving configuration boundary',()=>{
  beforeEach(()=>{
    vi.stubEnv('APP_BASE_URL','https://www.ev.church')
    vi.stubEnv('STRIPE_GIVING_ENABLED','false')
    vi.stubEnv('STRIPE_SANDBOX_SECRET_KEY','sk_test_example')
    vi.stubEnv('STRIPE_SANDBOX_PUBLISHABLE_KEY','pk_test_example')
    vi.stubEnv('STRIPE_SANDBOX_WEBHOOK_SECRET','whsec_example')
    vi.stubEnv('STRIPE_PRODUCTION_SECRET_KEY','')
    vi.stubEnv('STRIPE_PRODUCTION_PUBLISHABLE_KEY','')
    vi.stubEnv('STRIPE_PRODUCTION_WEBHOOK_SECRET','')
  })
  afterEach(()=>vi.unstubAllEnvs())
  it('keeps acquisition off until explicitly enabled and does not require BlinkPay credentials',()=>{
    expect(stripeGivingAvailable('sandbox')).toBe(false)
    vi.stubEnv('STRIPE_GIVING_ENABLED','true')
    expect(stripeGivingAvailable('sandbox')).toBe(true)
    expect(loadStripeGivingConfig('sandbox').environment).toBe('sandbox')
  })
  it('fails closed on mixed test/live credentials and missing production webhook verification',()=>{
    vi.stubEnv('STRIPE_GIVING_ENABLED','true')
    vi.stubEnv('STRIPE_SANDBOX_SECRET_KEY','sk_live_example')
    expect(stripeGivingAvailable('sandbox')).toBe(false)
    vi.stubEnv('STRIPE_PRODUCTION_SECRET_KEY','sk_live_example')
    vi.stubEnv('STRIPE_PRODUCTION_PUBLISHABLE_KEY','pk_live_example')
    expect(stripeGivingAvailable('production')).toBe(false)
    expect(stripeGivingAvailable(null)).toBe(false)
  })
})
