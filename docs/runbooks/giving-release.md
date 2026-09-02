# Giving release controls

BlinkPay acquisition is controlled by the website's authenticated giving eligibility. During the initial production test period, the website offers BlinkPay only after member chrome resolves a real signed-in profile whose email is an exact `@ev.church` or `@evchurch.nz` address. Signed-out visitors and non-matching signed-in profiles remain on the direct bank-transfer path.

`BLINKPAY_DEFAULT_ENVIRONMENT` selects the server-owned BlinkPay environment and defaults to `sandbox`. Keep Sandbox credentials in the `BLINKPAY_SANDBOX_*` variables. Change the selector to `production` only after the production evidence below is complete; never place Sandbox credentials in the production variables.

## Evidence boundaries

- Vitest and PostgreSQL tests prove local contracts, failure handling, idempotency and concurrency without provider writes.
- BlinkPay sandbox evidence must be labelled provider-backed. A signature-valid mocked failed webhook is acceptable only where the sandbox cannot produce that lifecycle.
- Only controlled real-money tests can prove production credentials and settlement.

## Operational verification

These checks are operational guidance rather than runtime blockers:

- BlinkPay production certification and Going Live review.
- Exact production OAuth scopes for payments, enduring consents, fixed recurring payments and registered webhooks.
- Merchant-supported recovery or deduplication for ambiguous enduring-consent and fixed-schedule creation.
- Tenant-proven production hosted Gateway origin.
- Registered callback aliases and webhook subscription delivery proof.
- Isolated production credentials and webhook secrets, with named owners and rotation evidence.
- Controlled real-money one-off settlement test.
- Controlled real-money recurring setup, scheduled execution and cancellation test.
- Verified Ev reconciliation, alerting and operator response evidence.
- Acquisition shutdown and lifecycle-sustainment rehearsal.

The server accepts BlinkPay checkouts when the selected environment configuration is valid. The authenticated `@ev.church` and `@evchurch.nz` cohort is a short production test frontend gate, not an API authorization boundary.

## Required evidence sequence

1. Complete focused tests, guarded PostgreSQL migrations, generated types and production build.
2. Complete BlinkPay sandbox one-off, enduring-consent, fixed-schedule, return, cancellation and scheduled-completion evidence. Record which failures are provider-backed versus mocked.
3. Confirm production endpoint/credential pairing, callback origin, Gateway origin, issued scopes and webhook keyring. Inspect the client bundle for secrets.
4. Register or allow the production webhook callback URL `https://www.ev.church/api/webhooks/blinkpay/production` in BlinkPay before creating the subscription. This is separate from the hosted Gateway return URL `https://www.ev.church/give/return`.
5. Register the production Fixed Recurring Payment webhook subscription through BlinkPay's API for `https://www.ev.church/api/webhooks/blinkpay/production`, and retain the returned subscription ID. Store the returned `whsec_...` signing secret immediately; BlinkPay returns it only when the subscription is created.
6. Configure monitoring for settlement, consent state, schedule state, webhook exceptions, unknown age and flow completion.
7. Execute approved low-value real-money one-off and recurring setup/cancellation tests, reconcile all records, and confirm operator ownership.
8. Expand the authenticated giving eligibility as evidence and operator confidence increase.

## Credential rotation

BlinkPay OAuth credentials, BlinkPay webhook secrets and the shared Rock credential each require a named owner, new-secret provisioning, overlapping verification where supported, deployment, authoritative read/health checks, old-secret revocation and post-rotation monitoring. Never place secret values in this runbook, tickets, screenshots or test artifacts. If overlap is unsupported, schedule a controlled change window and preserve the last verified application release for rollback.

## Rollback and incidents

Rollback has two independent planes:

- **Website acquisition shutdown:** disable the authenticated BlinkPay eligibility to send new gifts through the direct bank-transfer path instead of BlinkPay. Existing same-origin request controls, Turnstile and rate limits remain the public API protections.
- **Lifecycle sustainment:** keep compatible webhook ingestion, scheduled reconciliation, Payload financial administration and schedule cancellation deployed while any real recurring obligation exists.

Do not roll back the giving schema after financial or audit writes. Unknown provider mutations remain blocked from retry until authoritative reconciliation. Use [giving operations](./giving-operations.md) for everyday tracing and exceptions.

## Release record

Before expanding the authenticated BlinkPay audience, record owner, timestamp, commit and deployment, target cohort, monitoring owner, acquisition-disable action and lifecycle-sustainment version.
