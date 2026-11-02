# Giving operations

This runbook covers everyday tracing, reconciliation, cancellation and exceptions for the giving pilot. It is not a production-release checklist; complete the separate certification and controlled real-money checks before enabling BlinkPay for visitors in PostHog.

Release evidence and activation gates are tracked separately in [Giving release gates](./giving-release.md).

Only a Payload user with the exact `admin` role may view giving records, manage funds or cancel a schedule. Never copy credentials, capability values, raw webhook bodies or personal details into chat, tickets or logs.

## Real records and TEST DATA

Every giving list shows the `TEST DATA` (`synthetic`) column. A checked row belongs to the sandbox and must be excluded from real giving totals, reconciliation and financial reporting. Its linked giver, checkout, consent, gift, schedule, operation and webhook records must all remain in the same sandbox context. Do not edit provenance fields.

## Trace a gift or giver

1. Open **Giving** in Payload admin.
2. Search **Givers** by EV bank reference (`EV` plus Rock person alias), Rock person alias, name or email.
3. Search **Gifts**, **Consents** or **Schedules** with the BlinkPay payment, consent or schedule ID.
4. Follow only local `/admin/collections/...` record links. Confirm the environment and `TEST DATA` marker match on every related record.
5. Use the checkout correlation key and provider operation request ID when BlinkPay support needs a reference. Do not send raw provider bodies or secrets.

## Reconcile an exception

Start with the authoritative provider read; a browser return or webhook delivery alone is not proof.

- Failed gift: inspect its provider operation and latest verified payment status.
- Unknown checkout or schedule: inspect the unresolved provider operation. Do not repeat a financial mutation while it is `prepared`, `submitted` or `unknown`.
- Revoked or expired consent: record it as a consent lifecycle outcome. Do not describe schedule cancellation as consent revocation.
- Webhook `quarantined`: compare environment, provider event ID, reference type and digest metadata. An unmatched or conflicting delivery needs investigation; never edit the stored body.
- Webhook `retry` or `dead`: inspect attempt count, last error and provider availability. Use the normal reconciliation job path; do not fabricate or replay a webhook.

If the authoritative read still fails, leave the record unknown, retain the correlation and request IDs, and escalate to BlinkPay support. A second blind create, charge or DELETE is prohibited.

## Cancel an active recurring schedule

1. Open the active schedule in **Giving → Giving Schedules** and verify the giver, amount, environment and `TEST DATA` marker.
2. Enter a short operational reason and choose **Prepare cancellation**.
3. Read the confirmation: cancellation stops future scheduled payments; the enduring consent remains authorised unless BlinkPay separately reports a consent lifecycle change.
4. Choose **Confirm cancellation** once. The confirmation is short-lived, single-use and bound to you, this schedule and the reason.
5. If the result is cancelled, verify the schedule is `cancelled`, the operation is `succeeded`, and the consent was not changed.
6. If the result is unknown, do not press cancel again. Reconcile the schedule with BlinkPay and retain the unknown operation audit.
7. If BlinkPay definitively did not apply the cancellation, the schedule returns to a recoverable active state and the failed attempt remains audited. Recheck current state before preparing a new attempt.

## Funds

Exact admins may create, order, activate and deactivate public funds. There must always be exactly one active default. To replace the default, mark the new active fund as default; the swap is serialized in PostgreSQL. A referenced historical fund cannot be deleted, and deactivation never changes a historical gift’s fund snapshot.

## Acquisition incidents

If new giving acquisition must stop, disable the approved PostHog acquisition audience and keep compatible webhook ingestion, reconciliation, Payload administration and cancellation running for existing schedules. Production credentials, subscription registration, rotation, rollout and real-money smoke procedures belong in the release runbook, not here.

## Stripe card giving

Card giving is independently gated by `STRIPE_GIVING_ENABLED` (default `false`). It uses the shared `BLINKPAY_DEFAULT_ENVIRONMENT` record context, but does not require working BlinkPay credentials. Disabling acquisition does not disable verification, cancellation or reconciliation of existing arrangements.

Before enabling a Stripe environment:

- Supply its `STRIPE_SANDBOX_*` or `STRIPE_PRODUCTION_*` secret key, publishable key and webhook secret. Test and live keys are checked separately; never put keys in tracked configuration.
- Confirm Ev's NZ Stripe account is enabled for card charges and payouts. Set the actual contracted fixed fee and percentage in **Giving Settings**; defaults are not evidence of the account's rates. Include relevant Billing costs when choosing the single donor-facing recovery rate. Ev absorbs differences between the configured recovery charge and actual provider fees.
- Create a **Subscription payment fails** automation filtered to customer metadata **ev_giving = v1**. Apply a custom retry policy of **1 day, then 3 days, then 5 days after the previous attempt** (days **1, 4 and 9** from the initial failure), followed by **Cancel subscription** after the policy ends. Do not change the account-wide retry settings or disable emails globally: existing Stripe subscriptions retain their existing handling. Verify the scoped policy with test clocks before live enablement. The application marks only its new customers with this metadata and sends the corresponding failure, action-required and stopped emails.
- Register the site domain for Apple Pay and Google Pay. Restrict this integration to card payment methods; wallet presentation must use card rails. Keep automatic currency conversion disabled for these NZD gifts.
- Configure `/api/webhooks/stripe/sandbox` or `/api/webhooks/stripe/production` with its matching signing secret. Subscribe to Checkout Session completion/expiration, subscription and subscription-schedule lifecycle events, invoice payment/failure/action-required events, charge disputes, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, and payout events. Use the same API version as the installed Stripe SDK. Events are signed, environment-checked, persisted before acknowledgement, and processed by `reconcileStripeGiving` on the giving lifecycle queue.
- Preserve existing account-wide Stripe email settings. The scoped giving recovery automation must not add Stripe failure or cancellation email actions that duplicate Ev messages. Verify the account’s receipt and reminder settings do not duplicate the new giving emails before activation; do not disable emails used by existing subscriptions. Enable Stripe dispute notifications to the authorised staff who handle disputes. Ensure Resend and the existing giving email recovery job are configured.
- Verify one-off, future-start recurring, Today recurring both before and after 15:00 Auckland, January 31 → February 28 → March 31, leap years, daylight saving, authentication-required recovery, card update, cancellation, retry exhaustion and out-of-order webhook delivery in sandbox. A setup confirmation is not a paid gift; payment success is not a bank payout.

For recurring card gifts starting Today, embedded Checkout takes the first full payment immediately and saves the card for future use. After verifying that payment, the app creates an afternoon Auckland calendar anchor with a first period credited as already paid. The first phase has a 100% discount; the second explicitly removes that discount without resetting the original billing anchor. Stripe then releases the ongoing subscription. This prevents duplicate initial collections and retains month-end dates. No once-only coupon consumption is assumed. For future starts, Checkout authorises the card without charging it and creates an undiscounted schedule on the selected NZ date. Afternoon anchors keep UTC and NZ calendar dates aligned across daylight saving; no UTC time or Today cutoff is shown to donors. Existing BlinkPay schedules and their authorised fee snapshots are retained. Gift changes remain cancel-and-replace. Card updates use a member-owned secure Stripe setup page and do not restart a cancelled arrangement. If a future-start authorisation misses its scheduled start before a schedule can be created, the checkout expires and the donor is notified to restart. An already-paid Today gift is not charged again; delayed provisioning beyond the next intended payment boundary requires reconciliation rather than creating arrears.

Provider request idempotency supplements durable local checkout keys. An ambiguous financial result is never retried under a new key or switched to another gateway. Unknown schedule creation older than the provider idempotency window requires reconciliation; inspect the Stripe customer and checkout metadata before taking action.

Use **Finance CSV (this month)** in the giving administration shortcuts, or `/api/admin/giving/export?from=YYYY-MM-DD&to=YYYY-MM-DD`. It requires an exact website administrator role, excludes synthetic data, uses Auckland date bounds, and quotes donor-controlled cells safely for spreadsheets. Blank processing/payout fields are unknown, not zero. Compare provider reports with bank deposits. Refund tools and annual tax receipts are outside this feature.

For operational exceptions, inspect `giving_stripe_events` pending/quarantined records and the giving lifecycle job's failure count using authorised database operations. Conflicting duplicate event payloads are quarantined. Failures retry with backoff; no raw provider errors or credentials are emitted to donor responses. Payout associations are retained independently of gift creation so out-of-order events remain reconcilable.


Refund observations preserve the original charge and store each Stripe refund ID, amount and status in `giving_stripe_refunds`. Successful and pending totals are separate on the gift. A periodic sweep also checks completed one-off gifts, so missed refund webhooks are recoverable. These are observations only; issue refunds through authorised Stripe operations. Compare original payment and refund records with provider reports and bank movements.

Card-update links are versioned when requested and applied under a schedule lock. Only the newest request can apply; repeated events do not apply it again. The financial-control migration supersedes pre-existing card-update links because their request order was not recorded. Donors can choose **Update card** again. The migration preserves payment history; existing refund fields remain unknown until observed. BlinkPay payments last verified through a webhook are rechecked by the stricter recurring reconciliation path. Previously completed one-off BlinkPay gifts require a separate historical audit if there is evidence of incorrect provider amounts.
