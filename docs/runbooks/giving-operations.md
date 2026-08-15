# Giving operations

This runbook covers everyday tracing, reconciliation, cancellation and exceptions for the giving pilot. It is not a production-release checklist. Production giving remains blocked until the separate certification and controlled real-money gates are complete.

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

If new giving acquisition must stop, disable the approved PostHog acquisition audience and keep compatible webhook ingestion, reconciliation, Payload administration and cancellation running for existing schedules. Production activation, credentials, subscription registration, rotation, rollout and real-money smoke procedures belong in the future release runbook, not here.
