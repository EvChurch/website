# Public Member Authentication Runbook

This runbook enables the Rock-backed public member sign-in. It does not grant Payload access and does not add connect-group permissions. Complete every identity and least-privilege gate before enabling production.

## Security boundaries

- Use the website's single Auth0 application for both public-member and Payload-admin sign-in. Do not create a member-specific application.
- Use the website's existing Rock API configuration for member identity, profile, and photo reads.
- Giving uses a separate least-privilege Rock credential (`GIVING_ROCK_API_URL` and `GIVING_ROCK_API_KEY`) for its bounded person/login reads and final person creation. Do not reuse the broader website `ROCK_API_KEY` for giving or grant giving access to unrelated Rock entities.
- The website resolves only the case-sensitive OIDC `sub` stored by Rock in the Auth0 `UserLogin` username as `AUTH0_<sub>`. Email is a display field, never an identity key or fallback.
- The website does not create or link Rock people. The existing Auth0-to-Rock connection owns that behavior.
- Treat Auth0 subjects, Rock person IDs, cookies, and profile data as private. Do not place them in logs, screenshots, tickets, or deployment evidence.

## Single website Auth0 application

Use the existing Rock-connected Auth0 application as the replacement website's only Auth0 application. Add both the public-member and Payload-admin URLs to that application's allowlists:

- Application type: Regular Web Application
- Allowed callback URL: `<APP_BASE_URL>/auth/callback` (existing)
- Allowed logout URLs: `<APP_BASE_URL>/` and `<APP_BASE_URL>/member-sign-in/error`
- Allowed web origin: `<APP_BASE_URL>`
- Scopes: `openid profile email`
- No Rock API audience, refresh token, or `offline_access`

Sign-in preserves the current safe public path. Normal logout returns to the fixed site root, while an incomplete sign-in returns to the fixed error page; these fixed destinations keep OIDC post-logout redirect registration exact. Never allow an external origin.

Both application flows use the same Auth0 settings:

| Setting | Purpose |
|---|---|
| `APP_BASE_URL` | Exact website origin, with no path or trailing credentials |
| `AUTH0_DOMAIN` | Existing Auth0 tenant/custom domain without a path |
| `AUTH0_SECRET` | Existing 32-byte website session secret encoded as 64 hex characters |
| `AUTH0_CLIENT_ID` | Client ID of the single Rock-connected website application |
| `AUTH0_CLIENT_SECRET` | Client secret of the single Rock-connected website application |
| `ROCK_API_URL` | Existing Rock REST base, such as `https://rock.example.church/api` |
| `ROCK_API_KEY` | Existing website Rock API credential |

Giving configuration is deliberately separate from public-member authentication:

| Setting | Purpose |
|---|---|
| `GIVING_ROCK_API_URL` | Exact HTTPS Rock REST base ending in `/api`; requests reject redirects |
| `GIVING_ROCK_API_KEY` | Dedicated credential limited to the giving identity reads and person creation contract |
| `GIVING_ROCK_E2E_PERSON_ALIAS_ID` | Positive alias of the dedicated synthetic test person; protected E2E must use only this alias and must never create a Rock person |
| `GIVING_IDENTITY_FINGERPRINT_SECRET` | Dedicated server-only HMAC secret used to serialize identity resolution without storing email in the operation key or logs |

Keep the synthetic alias non-production in purpose and clearly marked in Rock. Changing it requires a read-only alias-resolution proof before the next protected E2E run. Never place the alias, credential, fingerprint, raw identity, or Rock response in public test evidence.

Store secrets in the deployment secret store, restrict operator access, and never print their values. Public-member and Payload-admin sign-in use the existing `/auth/*` routes and encrypted Auth0 session. Payload roles remain the sole admin authorization gate; a member session without a recognized Payload role cannot access `/admin`.

## Rock access

Confirm the existing website Rock API credential can:

- read `UserLogin` fields required to validate the Auth0 authentication entity, exact `AUTH0_<sub>` username, and linked `PersonId`;
- read the linked `Person` name, email, and `PhotoUrl` fields; and
- fetch that person's `/GetImage.ashx` image.

Do not expand the existing credential beyond what these reads require. Because the credential is shared with other website integrations, test those integrations whenever it is changed or rotated.

The avatar proxy accepts only the session-stored Rock photo reference, the configured Rock origin, and the documented `/GetImage.ashx` path with one `id` or `guid`. It does not accept a URL from the browser, follow redirects, proxy SVG, or reuse the shared `ROCK_API_KEY`.

## Exact-sub deployment gate

Perform this proof in a non-production environment first.

1. Select one controlled Auth0 identity and record only an operator-owned evidence reference, not its raw `sub`.
2. Authenticate through the existing public Auth0 application and inspect the Auth0 event securely to obtain its exact case-sensitive OIDC `sub`.
3. In Rock, confirm exactly one `UserLogin` has username `AUTH0_<sub>`, the expected Auth0 authentication entity, and one linked person. Rock may leave `ForeignKey` empty; it is not an identity key for this integration.
4. Sign in through the website. Confirm the displayed name, email, and photo/fallback belong to that same person.
5. Change the person's email in the controlled environment and sign in again. Confirm the same person resolves, proving email is not used for matching.

Stop if there are zero or multiple matching logins, a different subject representation, a missing person link, or any need for email matching. Keep member auth disabled and update the adapter contract deliberately before proceeding.

## Controlled first-user connection proof

Use a controlled identity with no pre-existing Rock association to verify the existing Auth0-to-Rock connection:

1. Confirm no Rock `UserLogin` already carries the controlled identity's `sub`.
2. Complete authentication through the configured connection once.
3. Confirm the connection creates or links exactly one Rock person and exactly one expected Auth0 `UserLogin` within the website callback budget.
4. Confirm the website resolves that association and creates no Payload user or role.
5. Repeat sign-in and confirm it resolves the same Rock person without creating another person or login.

Duplicate creation, delayed linking beyond the callback budget, or a mismatched subject is a stop condition. The website must not compensate by creating a person or searching by email.

## Disabled configuration behavior

Member auth is enabled only when the existing Auth0 and Rock settings validate. With any required setting absent, partial, or placeholder:

- public pages continue anonymously without member account controls;
- public pages do not attempt to read a member session;
- `/member-auth/*` fails privately with HTTP 503;
- Payload admin authentication remains available through its separate `/auth/*` routes; and
- no Rock request is made by the member feature.

Use this fail-closed state for initial deployment and emergency rollback.

## Smoke tests

After configuring a non-production environment, record pass/fail and timestamp for each check without capturing secrets, cookies, subjects, or raw Rock responses.

1. A signed-out desktop page shows the person icon next to Give. Mobile shows it beside the menu and in the drawer.
2. Cancelled/invalid authentication returns to a generic retry state and exposes no profile.
3. The exact-sub test member signs in and sees the correct name, email, and photo. A missing, invalid, denied, oversized, or timed-out photo falls back to initials without ending the member session.
4. Reload and a nested public-page navigation retain the resolved member session.
5. Keyboard and touch open and close the popover; Escape closes it and restores focus.
6. Log out from a nested public page. The browser returns to the site root, all account controls return to signed-out state, and replaying the prior member cookie does not restore the profile.
7. Confirm a normal member session creates no Payload user and cannot access `/admin`. Confirm an authorized staff identity still reaches `/admin` through the same Auth0 session and the Payload role check.
8. Remove or invalidate one shared Rock setting. Anonymous pages remain healthy and member auth returns the private 503. Invalidating a shared setting also affects the website's other Rock integrations.

Member logout uses the website's existing Auth0 OIDC logout and clears the shared website session. An administrator who logs out from the public account menu must authenticate again before returning to `/admin`.

## Rollout

1. Deploy the code with member configuration absent so the feature remains disabled.
2. Confirm the existing Auth0 callback and the existing Auth0 and Rock website credentials in non-production. No callback URL change is required.
3. Complete the exact-sub and controlled first-user proofs, then all smoke tests.
4. Add the complete member configuration to production during an owned release window.
5. Repeat the exact-sub proof with one approved real member and repeat the simultaneous admin/member isolation test.
6. Monitor categorized member callback, Rock resolution, completion rejection, and avatar failure logs. Logs must contain reason categories only, never identity values or upstream response bodies.

Any identity ambiguity, unexpected Payload record, cookie collision, repeated callback failure, or unrelated Rock access is a no-go and triggers rollback.

## Rollback

Disable the member account controls in code and redeploy. Do not remove shared Auth0 or Rock settings as a member-only rollback because the rest of the website also uses them.

Rollback does not delete Auth0 users, Rock people, or Rock user logins. Investigate and remediate any upstream duplicate through its owning system; do not add a website-side email fallback.

## Secret rotation

- Rotate `AUTH0_CLIENT_SECRET` on the single website Auth0 application and in the deployment secret store, deploy, then revoke the old value. Coordinate this across both sign-in flows.
- Rotate `AUTH0_SECRET` during a coordinated session reset; rotation invalidates the shared website session.
- Rotate `ROCK_API_KEY` through the website's existing Rock credential procedure and retest all Rock-backed features, including member profile and avatar reads.
- Rotate `GIVING_ROCK_API_KEY` independently, then prove exact Auth0-login lookup, bounded active-email lookup, GUID recovery, alias retrieval, and one controlled non-production person creation. Rotation must not change `ROCK_API_KEY` or the configured synthetic test alias.

Rotate one boundary at a time and repeat sign-in, profile, avatar, logout, and admin-isolation smoke tests after each change. Record only secret version identifiers and timestamps, never secret values.
