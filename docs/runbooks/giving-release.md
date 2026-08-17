# Giving release gates

Status: **blocked — do not enable production giving or a public PostHog audience.** This document records the controlled path to readiness; it is not evidence that any gate has passed.

## Evidence boundaries

- Vitest and PostgreSQL tests prove local contracts, failure handling, idempotency and concurrency without provider writes.
- PNZ sandbox evidence must be labelled provider-backed. A signature-valid mocked failed webhook is acceptable only where PNZ cannot produce that lifecycle.
- Only controlled real-money tests can prove production credentials and settlement.

## Current blockers

All remain unresolved:

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

The server production gate remains closed while any readiness diagnostic is blocking, even if PostHog is enabled.

## Required evidence sequence

1. Complete focused tests, guarded PostgreSQL migrations, generated types and production build.
2. Complete PNZ one-off, enduring-consent, fixed-schedule, return, cancellation and scheduled-completion evidence. Record which failures are provider-backed versus mocked.
3. Confirm production endpoint/credential pairing, callback origin, Gateway origin, issued scopes and webhook keyring. Inspect the client bundle for secrets.
4. Register webhooks through controlled merchant onboarding and retain delivery proof; the application does not manage subscriptions.
5. Configure monitoring for settlement, consent state, schedule state, webhook exceptions, unknown age and flow completion.
6. Execute approved low-value real-money one-off and recurring setup/cancellation tests, reconcile all records, and confirm operator ownership.
7. Enable a narrowly targeted PostHog audience only after every gate above has linked evidence and approval.

## Credential rotation

BlinkPay OAuth credentials, BlinkPay webhook secrets and the Rock giving credential each require a named owner, new-secret provisioning, overlapping verification where supported, deployment, authoritative read/health checks, old-secret revocation and post-rotation monitoring. Never place secret values in this runbook, tickets, screenshots or test artifacts. If overlap is unsupported, schedule a controlled change window and preserve the last verified application release for rollback.

## Rollback and incidents

Rollback has two independent planes:

- **Acquisition shutdown:** disable the targeted PostHog audience and keep the server production gate closed to stop new checkouts.
- **Lifecycle sustainment:** keep compatible webhook ingestion, scheduled reconciliation, Payload financial administration and schedule cancellation deployed while any real recurring obligation exists.

Do not roll back the giving schema after financial or audit writes. Unknown provider mutations remain blocked from retry until authoritative reconciliation. Use [giving operations](./giving-operations.md) for everyday tracing and exceptions.

## Release record

Before any activation, record owner, approver, timestamp, commit and deployment, evidence links for every blocker, target PostHog cohort, monitoring owner, acquisition-disable action and lifecycle-sustainment version. Until that record is complete, readiness is **blocked**.
