# Reimbursements API v1

Interactive Swagger documentation: `/api/v1/docs`. Select **API v1**, expand **Reimbursements**, choose
**Authorize**, and enter the key without the `Bearer` prefix. **Try it out** sends
real requests; approval and payment actions change reports. Authorization is
cleared on reload.

API v1 base URL: `https://www.ev.church/api/v1`

Reimbursements namespace: `/reimbursements`. The paths below are relative to the
API v1 base URL; future namespaces share this API version.

Download the machine-readable OpenAPI 3.1.1 specification from
`/api/v1/openapi.json`. It defines every request, response, and error.
No key is needed to download the specification. All report and action endpoints
require `Authorization: Bearer YOUR_KEY`. Cookies do not authenticate this API.
Do not put keys in URLs or commit them to scripts.

## Access and keys

A Payload administrator creates a named key at **API → API keys**, choosing
its linked Rock person, permissions, and expiry. The default expiry is one year;
**No expiry** is available. Save the record, then choose **Generate API key**. The secret appears once.
The server stores its SHA-256 hash, not the secret. Admins can update a key's name,
permissions, and expiry, or revoke it immediately. A revoked key cannot be restored.
Replace a key by creating another, updating the script, and revoking the old key.

Permissions are independent:

| Permission | Access |
|---|---|
| `reimbursements:reports:read` | Structured reports, expenses, history, and current action permissions |
| `reimbursements:receipts:read` | Receipt downloads and report PDFs |
| `reimbursements:bank:read` | Include bank details in report responses and PDFs, where the person may see them |
| `reimbursements:reports:review` | Approve and reject reports |
| `reimbursements:payments:confirm` | Record completed external payments |

Bank access also needs `reimbursements:reports:read` or `reimbursements:receipts:read` to retrieve the relevant
response. Every operation is limited to the linked person's current permissions;
keys never confer Payload administrator authority. Finance membership and purpose
assignments must be current in the Rock sync. The person is verified against Rock
on every request; an unavailable identity service returns 503. Report visibility,
self-approval restrictions, distinct approvers, and full-report approval before
payment are the same as on the website. API use does not require personal payout
settings to be entered in the website.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/reimbursements/reports` | `reimbursements:reports:read` |
| GET | `/reimbursements/reports/{reportId}` | `reimbursements:reports:read` |
| GET | `/reimbursements/reports/{reportId}/receipts/{expenseId}` | `reimbursements:receipts:read` |
| GET | `/reimbursements/reports/{reportId}/pdf` | `reimbursements:receipts:read` |
| POST | `/reimbursements/reports/{reportId}/approve` | `reimbursements:reports:review` |
| POST | `/reimbursements/reports/{reportId}/reject` | `reimbursements:reports:review` |
| POST | `/reimbursements/payments/confirm` | `reimbursements:payments:confirm` |

Use UUID `id` values for reports and expenses, not the human report number.
Amounts are integer NZD cents. `bankAccount`, `receiptUrl`, and `pdfUrl` are null
when the required permission is absent. History omits internal submission snapshots
and receipt storage hashes. Files can contain bank details printed on an uploaded
receipt; only grant receipt access to people who may view its full contents.

## Polling

`GET /reimbursements/reports` accepts `status`, `updatedSince` (an ISO 8601 timestamp), `limit`
(default 50, maximum 100), and an opaque `cursor`. Unknown, repeated, or invalid
parameters return 400. Reports are ordered by update timestamp and ID.

Read every page using `nextCursor`, keeping the filters unchanged. The poll's upper
bound is preserved across pages. When `nextCursor` is null, save `syncUntil` and
use an overlapping lookback from it as `updatedSince` in the next poll (for example,
five minutes earlier). The lower bound is inclusive: deduplicate reports by ID and
version. This is current report state, not an immutable event stream. Transactions
that commit late and changes to the person's visibility can escape an incremental
filter. Run a periodic full refresh if maintaining a complete mirror. For approval
and payment work queues, polling all pages in the relevant status without an
`updatedSince` filter is the simplest reliable approach.

GET JSON responses include an ETag. Send it as `If-None-Match` to receive 304 when
that representation is unchanged. The list's `syncUntil` changes between polls,
so prefer `updatedSince` for incremental polling. Authorization and rate limits
still apply to conditional requests. Keep credentials out of shared caches.

```bash
# Export REIMBURSEMENTS_API_KEY securely in your environment first.
API_BASE='https://www.ev.church/api/v1'
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $REIMBURSEMENTS_API_KEY" \
  "$API_BASE/reimbursements/reports?status=finance-approval&limit=50"
```

## Decisions and safe retries

Every POST requires `Content-Type: application/json`, a JSON body of at most 64 KB,
and an `Idempotency-Key` header. Use a fresh operation ID (1–128 letters, digits,
underscores, or hyphens) for each intended action. Keep that ID and the exact
request when retrying a lost response. Successful operations are retained for the
key's lifetime. Reusing an ID for a different request returns 409. Failed operations
roll back and do not consume the ID.

Provide the report's latest `version`. A changed report returns 409; fetch it again
and review the changes before issuing a new operation. An identical retry of a
successful operation returns its original result even if the report has moved on,
provided the key still has the permission and the person retains relevant access.
Concurrent identical retries produce one action, one history event, and the usual
notification deliveries. Replays after revocation, expiry, scope removal, or loss
of the relevant access are denied.

```bash
# Set REPORT_ID and REPORT_VERSION from a report you have reviewed.
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $REIMBURSEMENTS_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: approve-20261029-example-1' \
  --data "{\"version\":$REPORT_VERSION}" \
  "$API_BASE/reimbursements/reports/$REPORT_ID/approve"
```

Reject with `{"version":4,"reason":"Explain which event this supported","rejectedLineIds":["EXPENSE_UUID"]}`.
`rejectedLineIds` may be omitted or empty. Rejection returns the entire report;
the claimant may edit any part and resubmit through the full approval process.

Confirm payment with
`{"reports":[{"id":"REPORT_UUID","version":6}]}`. Include up to 100 unique
reports for a batch. Every report must be approved, awaiting payment, and at its
expected version. One invalid report rolls back the whole batch. This records
payments already made outside the website; it does not transfer funds. No bank
reference or payment-date field is required.

API actions produce the normal emails and report history. History and report PDFs
also identify the API key by its ID and name. The admin audit lists key changes and
requests without recording request bodies, keys, bank numbers, or receipt contents.

## Errors and limits

Errors use `{"error":{"code":"conflict","message":"…"}}`.

- 400: invalid input; check the specification.
- 401: invalid, expired, or revoked key.
- 403: missing key permission or current person authority.
- 404: missing endpoint/report/receipt, or report not visible to this person.
- 409: changed report, ineligible payment, or reused operation ID with different input.
- 413 / 415: body too large / expected JSON content type.
- 429: more than 120 requests per minute for this key; wait `Retry-After` seconds.
- 503: temporary service or identity-verification failure.

Use restrained polling, retry transient failures with backoff, and reuse the same
operation ID for uncertain writes. Never blindly approve a refreshed report after
409. There are no claim creation, editing, submission, settings, or webhook
endpoints in v1.

## More request examples

Reject a reviewed report (set `EXPENSE_ID` to the line that needs changes):

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $REIMBURSEMENTS_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: reject-20261029-example-1' \
  --data "{\"version\":$REPORT_VERSION,\"reason\":\"Please explain which event this supported\",\"rejectedLineIds\":[\"$EXPENSE_ID\"]}" \
  "$API_BASE/reimbursements/reports/$REPORT_ID/reject"
```

After paying an approved report outside the website, confirm it:

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $REIMBURSEMENTS_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payment-20261029-example-1' \
  --data "{\"reports\":[{\"id\":\"$REPORT_ID\",\"version\":$REPORT_VERSION}]}" \
  "$API_BASE/reimbursements/payments/confirm"
```

For batches, add more `{ "id": "…", "version": … }` objects to `reports`. Use a new
operation ID for a new intended payment confirmation. Download a report PDF with:

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $REIMBURSEMENTS_API_KEY" \
  --output report.pdf "$API_BASE/reimbursements/reports/$REPORT_ID/pdf"
```

Keys are general Ev Church API credentials, managed through the Payload `api-keys` collection. Reimbursements is the first API area; permission names are namespaced by area. Save the record, then choose **Generate API key** and copy the one-time secret. Create a replacement record when rotating a key, then revoke the old record.
