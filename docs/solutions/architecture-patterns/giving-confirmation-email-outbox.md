---
title: Keep giving confirmation email behind authoritative payment state
date: 2026-08-22
category: architecture-patterns
module: Giving
problem_type: reliability
component: payments
symptoms:
  - A payment completion screen and email can disagree
  - Retried workers can send duplicate giving email
root_cause: missing_outbox_boundary
resolution_type: architecture_pattern
severity: high
tags: [giving, payments, email, resend, outbox, idempotency]
---

# Keep giving confirmation email behind authoritative payment state

## When to apply

Use this pattern when a payment or manual handoff must trigger email without making the provider request depend on email availability.

## Pattern

Write one uniquely keyed delivery row in the same database transaction as the authoritative state change. For BlinkPay, only verified completion creates the thank-you delivery. For manual transfer, preparing the bank details creates the details delivery and the visitor's explicit acknowledgement creates a distinct thank-you delivery; neither claims that Ev received payment.

Workers claim deliveries with a lease, send with a stable provider idempotency key, and record the provider ID. A periodic reconciler recovers pending and expired leases. Claims and reconciliation must exclude sandbox and synthetic checkouts. Keep a lease after the provider accepted a message but the database update failed, because immediate release can duplicate an accepted send.

Email links must be signed, expiring capabilities. A GET displays the confirmation page without mutation; an explicit same-origin POST records acknowledgement.

## Verification

- Test the completion-state predicates, unique delivery kinds, lease recovery, provider failure, and accepted-send/database-failure boundary.
- Run the giving migrations against disposable PostgreSQL and exercise both manual and verified BlinkPay completion.
- In production, verify migration, worker registration, sender configuration, safe invalid-link behavior, and deployed UI without creating a real gift.
