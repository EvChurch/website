import type { NextRequest } from 'next/server'
import { givingCheckoutRouteDefaults, handleGivingCheckoutPost } from '../checkouts/route'
import { configuredGivingEnvironment } from '@/lib/giving/availability'
import { stripeGivingAvailable } from '@/lib/giving/stripe/config'
import { startStripeGiving } from '@/lib/giving/stripe/service'
import { getGivingCardFees } from '@/lib/giving/settings'
import { cardTransactionFeeMinor } from '@/lib/giving/fees'
import { getPayloadClient } from '@/lib/payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { createGivingRockClient } from '@/lib/giving/rock-client'
import { createGivingIdentityRepository, resolveGivingIdentity } from '@/lib/giving/rock-identity'
import { givingIdentityForMemberSubmission, resolveCurrentGivingMemberIdentity } from '@/auth/giving-member-identity'

export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  return handleGivingCheckoutPost(request, {
    ...givingCheckoutRouteDefaults,
    async authority() {
      const environment = configuredGivingEnvironment()
      return environment && stripeGivingAvailable(environment) ? { contextKey:environment,environment,synthetic:environment==='sandbox' } : null
    },
    async transactionFeeMinor(_request, submission) {
      if (!submission) throw new Error('Missing gift')
      return cardTransactionFeeMinor(submission.amountMinor, await getGivingCardFees())
    },
    async startCheckout(authority,submission) {
      const pool = requireGivingPostgresPool(await getPayloadClient())
      const rock = createGivingRockClient()
      const member = await resolveCurrentGivingMemberIdentity({rockClient:rock})
      return startStripeGiving({...authority,submission},{pool,
        resolveIdentity(input) {
          return resolveGivingIdentity({...input,identity:member.signedIn ? givingIdentityForMemberSubmission(member,submission) : input.identity},{rockClient:rock,repository:createGivingIdentityRepository(pool),fingerprintSecret:process.env.GIVING_CHECKOUT_DIGEST_SECRET??''})
        },
      })
    },
  })
}
