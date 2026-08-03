# Rock Connection Opportunity Signups

This integration renders a Rock RMS 19.2 Connection Opportunity Signup through
EV Church while keeping Rock as the only submission store. A browser talks only
to EV endpoints. EV verifies Turnstile, validates a short-lived one-use context,
then calls Rock's anonymous Obsidian BlockActions through a narrowly scoped
Cloudflare Access service token.

It is a separate protocol from Workflow Form Builder. Existing Workflow forms
continue to use `RockForm`; Connection Signup has no redirect contract in Rock
19.2. Workflow redirects are accepted only when they are relative, same-origin,
or on the server-only `ROCK_WORKFLOW_REDIRECT_ORIGINS` HTTPS-origin allowlist.

## Rock 19.2 configuration

Create or move the website-facing Connection Opportunity Signup block onto a
dedicated proxy page. Prefer moving the existing block when its business
configuration is correct, because Payload stores the block GUID as its stable
identity. If Rock requires a clone, update the selected GUID, migration, seed,
and tests before activation.

The page and block must meet all of these conditions:

- Block type GUID is `35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f` (Connection
  Opportunity Signup).
- The block belongs directly to one page, not a site or layout.
- The page and block grant anonymous `View` access in Rock. Runtime calls must
  reach Rock as an anonymous person, with no `Authorization-Token` header.
- `Connection Opportunity` is a fixed GUID in block settings. Do not select it
  from an `OpportunityId` page parameter.
- The opportunity and its Connection Type are active.
- `Exclude Non-Public Connection Request Attributes` is `Yes`.
- `Disable Captcha Support` is raw `Yes`, and the anonymous initialization
  response reports effective `disableCaptchaSupport: true`.
- Campus, phone, comment-label, status, source, attribute-category, and Lava
  settings reflect the intended business behavior.
- Every required Connection Request attribute uses a field type supported by
  the EV adapter. Unsupported configuration makes the block ineligible.

Rock's CAPTCHA in 19.2 is not Cloudflare Turnstile. The Rock CAPTCHA must be
disabled for this proxy block because EV Turnstile is verified before EV calls
Rock. That is safe only with the Access boundary below.

## Cloudflare Access boundary

Create a dedicated Access application and service token for the Rock proxy.
Allow the service token on only:

1. The exact dedicated proxy page route.
2. `/api/v2/BlockActions/{pageGuid}/{blockGuid}/RefreshObsidianBlockInitialization`
3. `/api/v2/BlockActions/{pageGuid}/{blockGuid}/Signup`

Do not grant the token to `/api/*`, all BlockActions, another Rock page, or the
Rock admin. Requests without the Access token must be denied at Cloudflare
before they reach Rock. Rock rate limiting is defense in depth; it does not
replace this rule.

EV sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` only to the fixed
HTTPS Rock origin and these fixed action paths. It does not send the Rock API
key on runtime refresh or Signup requests. `ROCK_API_KEY` is used only for
authenticated editor discovery metadata.

After the rule is active, an operator may verify direct denial without personal
data. Replace placeholders locally; do not paste secrets into shell history or
repository files:

```bash
curl --fail-with-body --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"__context":{"pageParameters":{},"sessionGuid":"11111111-1111-4111-8111-111111111111","interactionGuid":"22222222-2222-4222-8222-222222222222"}}' \
  'https://rock.ev.church/api/v2/BlockActions/PAGE_GUID/BLOCK_GUID/RefreshObsidianBlockInitialization'
```

The request must be denied by Access. A denial response must not contain Rock
block initialization. Test the exact Signup path similarly only as a confirmed
Access-denial probe with an empty invalid body; stop if it passes Access. Never
use real visitor data or a valid Signup bag for this probe.

Then use an approved server-side read-only diagnostic to prove the EV service
token can refresh the block and that the response identity and effective
CAPTCHA setting match. Do not expose either Access header to a browser.

## Environment

All values except the Turnstile site key are server-only. Keep them out of
`NEXT_PUBLIC_*`, logs, screenshots, support bundles, and client responses.

| Variable | Purpose |
|---|---|
| `ROCK_API_URL` | Fixed HTTPS Rock API URL ending in `/api`. |
| `ROCK_API_KEY` | Least-privilege Rock credential for authenticated editor discovery only. |
| `ROCK_EDGE_ACCESS_CLIENT_ID` | Cloudflare Access service-token client ID for the exact proxy routes. |
| `ROCK_EDGE_ACCESS_CLIENT_SECRET` | Cloudflare Access service-token secret. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Turnstile widget site key. |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile verification secret. |
| `TURNSTILE_EXPECTED_HOSTNAME` | Exact public hostname expected in Turnstile verification. |
| `ROCK_CONNECTION_CONTEXT_KEYS` | Ordered `kid:base64-secret` key ring. First signs; current plus one previous may verify. Each decoded secret is at least 32 bytes. |
| `ROCK_CONNECTION_RATE_LIMIT_SECRET` | Separate secret of at least 32 bytes used to HMAC trusted client addresses. |
| `ROCK_CONNECTION_TRUST_CF_CONNECTING_IP` | Must be exactly `true` only after the Railway origin is locked to Cloudflare. |
| `ROCK_CONNECTION_START_RATE_LIMIT` | Optional tighter start limit; cannot exceed 10 per trusted address per 10 minutes. |
| `ROCK_CONNECTION_SUBMIT_RATE_LIMIT` | Optional tighter submit limit; cannot exceed 5 per trusted address per 10 minutes. |
| `ROCK_WORKFLOW_REDIRECT_ORIGINS` | Optional comma-separated external HTTPS origins trusted for existing Workflow redirects. Do not include paths, credentials, HTTP origins, or wildcards. |

The production Railway origin must reject direct public traffic and accept the
trusted Cloudflare path before enabling `ROCK_CONNECTION_TRUST_CF_CONNECTING_IP`.
Otherwise a client can forge `CF-Connecting-IP`, so Connection Signup must fail
closed. Do not trust `X-Forwarded-For` supplied by a browser.

## Provisioning and rotation

Provision distinct secrets per environment. Record owners and expiry dates in
the secret manager, not this repository.

- **Context signing keys:** create a new key ID and 32-byte-or-longer random
  secret. Deploy `new:secret,old:secret`, wait longer than the maximum context
  lifetime, then deploy only the new key. Roll back by restoring the previous
  ordered pair while it remains valid. Revoke a compromised key immediately;
  outstanding contexts will fail and visitors must restart.
- **Cloudflare Access token:** create a new token on the same exact-path policy,
  update EV, verify an authenticated refresh and unauthenticated denial, then
  revoke the old token. Keep overlap bounded. Before revoking during rollback,
  restore the old EV credentials and prove refresh.
- **Rock API key:** rotate the least-privilege discovery credential, verify the
  authenticated editor picker, then revoke the old key. Runtime behavior must
  remain anonymous.
- **Turnstile:** coordinate site-key and secret rotation, verify hostname and
  the distinct start/submit actions, then retire the old widget configuration.
- **Rate-limit secret:** rotating it intentionally starts new pseudonymous
  buckets. Do it during a controlled window and monitor request volume; never
  reuse a context-signing or Access secret.

Emergency revocation is safer than bypassing a failed control. A missing
context key, Access credential, nonce database, rate database, trusted-IP
contract, or Turnstile secret must make Connection Signup unavailable.

## Release order

1. Configure the dedicated Rock proxy page and block. Preserve all intended
   business settings and record the final page and block GUIDs.
2. Configure the exact Cloudflare Access paths. Prove direct requests are
   denied and an EV-credentialed anonymous refresh succeeds.
3. Provision environment values and verify the Railway origin is reachable
   only through Cloudflare before trusting `CF-Connecting-IP`.
4. On a verified disposable development database, apply the migration, inspect
   its candidate manifest, and test down/re-up. Stop on an unexpected Newish
   ID, path, order, layout, count, or version.
5. Deploy the code and seed/migration with the final eligible block GUID.
6. Perform read-only browser QA on Newish, Contact, and a complex Workflow form
   at desktop and mobile widths. Confirm browser network traffic stays on EV
   origins. Enter no real personal data and stop before any final submission.
7. In a separately authorized non-production Rock environment, submit one
   clearly synthetic request through the complete EV-to-Rock path, verify the
   resulting Connection Request and supported fields, and clean it up.
8. Record the non-production receipt and approve activation. Production browser
   QA still stops before Signup; never use a production Connection Request as a
   test artifact.

The synthetic non-production request and cleanup are an operator-owned
preactivation gate. Unit tests, a successful build, read-only refresh, or a
production browser preview do not replace it.

## Non-production receipt

Record only:

- environment and timestamp;
- deployed revision;
- EV correlation ID and normalized result class;
- Rock Connection Request ID;
- expected field names and pass/fail outcomes, without values;
- cleanup operator, timestamp, and result;
- direct-denial and EV-refresh pass/fail outcomes.

Do not record names, email addresses, phone numbers, comments, attribute values,
Turnstile tokens, signed contexts, IP addresses, request/response bodies,
headers, API keys, or Access credentials. Keep the receipt in the approved
operations system rather than committing it to this repository.

## Monitoring and failure handling

Monitor counts and latency by normalized operation and failure class only:
discovery unavailable, Turnstile rejected, rate limited, context invalid,
nonce replay/store unavailable, Rock Access denied, Rock response invalid,
definite Rock failure, and dispatch outcome unknown. Correlation IDs may be
logged. Submitted values, raw Rock exception text, raw addresses, tokens,
contexts, and headers must not be logged.

- **Discovery unavailable:** verify the API key and candidate eligibility. Do
  not offer free-form GUID entry.
- **Access denied from EV:** verify the exact application paths and service
  token. Do not add broad bypass rules.
- **Direct request reaches Rock:** deactivate the proxy block or Access policy
  immediately and keep Newish unavailable until the edge boundary is repaired.
- **CAPTCHA mismatch:** confirm both raw `Disable Captcha Support = Yes` and
  effective initialization `true`. Do not attempt to pass an EV Turnstile token
  to Rock CAPTCHA.
- **Nonce or rate store unavailable:** fail closed and repair the application
  database. Do not fall back to process memory in a multi-instance deployment.
- **Outcome unknown after Signup timeout:** the nonce remains consumed. Tell the
  visitor the request may have succeeded and require human confirmation before
  another attempt. Never retry Signup automatically.
- **Workflow redirect rejected:** the Workflow remains submitted and its safe
  completion message is displayed. Add an external origin only after reviewing
  it, using an exact HTTPS origin in `ROCK_WORKFLOW_REDIRECT_ORIGINS`.

## Rollback

Prefer deactivation over destructive rollback: remove the Newish form from
published content or make the Rock configuration ineligible while preserving
data for diagnosis. Revoke the Access token if direct bypass is suspected.

The migration down path deliberately refuses before DDL when any live or page
version row uses `connectionOpportunity` or retains a Connection block GUID.
Do not bypass that guard. A rollback requiring schema removal needs a reviewed
forward data migration that removes or replaces every Connection source without
restoring the obsolete Newish Connect Card workflow. Back up and verify the
target database first. Workflow-only rows retain their workflow GUID across a
permitted down/re-up.

No deployment, production migration, production seed run, or production Rock
Signup is part of repository verification.
