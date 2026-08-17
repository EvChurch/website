# Giving release controls

PostHog controls which visitors are offered BlinkPay. `BLINKPAY_PRODUCTION_ENABLED` remains the server-side emergency switch; there are no additional hardcoded readiness diagnostics.

## Evidence boundaries

- Vitest and PostgreSQL tests prove local contracts, failure handling, idempotency and concurrency without provider writes.
- PNZ sandbox evidence must be labelled provider-backed. A signature-valid mocked failed webhook is acceptable only where PNZ cannot produce that lifecycle.
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
- Verified EV reconciliation, alerting and operator response evidence.
- Acquisition shutdown and lifecycle-sustainment rehearsal.

The server accepts production BlinkPay checkouts when `BLINKPAY_PRODUCTION_ENABLED=true` and the production configuration is valid. PostHog controls audience rollout.

## Required evidence sequence

1. Complete focused tests, guarded PostgreSQL migrations, generated types and production build.
2. Complete PNZ one-off, enduring-consent, fixed-schedule, return, cancellation and scheduled-completion evidence. Record which failures are provider-backed versus mocked.
3. Confirm production endpoint/credential pairing, callback origin, Gateway origin, issued scopes and webhook keyring. Inspect the client bundle for secrets.
4. Register webhooks through controlled merchant onboarding and retain delivery proof; the application does not manage subscriptions.
5. Configure monitoring for settlement, consent state, schedule state, webhook exceptions, unknown age and flow completion.
6. Execute approved low-value real-money one-off and recurring setup/cancellation tests, reconcile all records, and confirm operator ownership.
7. Expand the PostHog audience as evidence and operator confidence increase.

## Credential rotation

BlinkPay OAuth credentials, BlinkPay webhook secrets and the Rock giving credential each require a named owner, new-secret provisioning, overlapping verification where supported, deployment, authoritative read/health checks, old-secret revocation and post-rotation monitoring. Never place secret values in this runbook, tickets, screenshots or test artifacts. If overlap is unsupported, schedule a controlled change window and preserve the last verified application release for rollback.

## Rollback and incidents

Rollback has two independent planes:

- **Acquisition shutdown:** disable the targeted PostHog audience and keep the server production gate closed to stop new checkouts.
- **Lifecycle sustainment:** keep compatible webhook ingestion, scheduled reconciliation, Payload financial administration and schedule cancellation deployed while any real recurring obligation exists.

Do not roll back the giving schema after financial or audit writes. Unknown provider mutations remain blocked from retry until authoritative reconciliation. Use [giving operations](./giving-operations.md) for everyday tracing and exceptions.

## Release record

Before expanding the PostHog audience, record owner, timestamp, commit and deployment, target cohort, monitoring owner, acquisition-disable action and lifecycle-sustainment version.
