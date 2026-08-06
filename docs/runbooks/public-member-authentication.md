# Public Member Authentication Runbook

This runbook enables the Rock-backed public member sign-in. It does not grant Payload access and does not add connect-group permissions. Complete every identity and least-privilege gate before enabling production.

## Security boundaries

- Use a dedicated Auth0 Regular Web Application for public members. Never reuse the Payload admin application, its client secret, its session secret, or its cookie.
- Use a dedicated Rock service credential for member identity, profile, and photo reads. Never copy `ROCK_API_KEY` into `MEMBER_ROCK_API_KEY`.
- The website resolves only the case-sensitive OIDC `sub` stored by Rock. Email is a display field, never an identity key or fallback.
- The website does not create or link Rock people. The existing Auth0-to-Rock connection owns that behavior.
- Treat Auth0 subjects, Rock person IDs, cookies, and profile data as private. Do not place them in logs, screenshots, tickets, or deployment evidence.

## Auth0 application

For each environment, configure the dedicated member application with:

- Application type: Regular Web Application
- Allowed callback URL: `<MEMBER_AUTH0_APP_BASE_URL>/member-auth/callback`
- Allowed logout URLs: `<MEMBER_AUTH0_APP_BASE_URL>/` and `<MEMBER_AUTH0_APP_BASE_URL>/member-sign-in/error`
- Allowed web origin: `<MEMBER_AUTH0_APP_BASE_URL>`
- Scopes: `openid profile email`
- No Rock API audience, refresh token, or `offline_access`

Sign-in preserves the current safe public path. Normal logout returns to the fixed site root, while an incomplete sign-in returns to the fixed error page; these fixed destinations keep OIDC post-logout redirect registration exact. Never allow an external origin.

Set these deployment secrets independently for each environment:

| Setting | Purpose |
|---|---|
| `MEMBER_AUTH0_APP_BASE_URL` | Exact website origin, with no path or trailing credentials |
| `MEMBER_AUTH0_DOMAIN` | Auth0 tenant domain without a path |
| `MEMBER_AUTH0_CLIENT_ID` | Dedicated public-member application client ID |
| `MEMBER_AUTH0_CLIENT_SECRET` | Dedicated public-member application client secret |
| `MEMBER_AUTH0_SECRET` | Independent 32-byte session secret encoded as 64 hex characters |
| `MEMBER_ROCK_API_URL` | Rock REST base, such as `https://rock.example.church/api` |
| `MEMBER_ROCK_API_KEY` | Dedicated least-privilege Rock credential |

Generate the member session secret with `openssl rand -hex 32`. Store all secrets in the deployment secret store, restrict operator access, and never print their values. The member application uses separate `ev_member_session` and `ev_member_txn_` cookie namespaces from Payload admin.

## Rock least-privilege access

Create a dedicated Rock service account/API key that can only:

- read `UserLogin` fields required to validate the Auth0 authentication entity, exact `ForeignKey`, `AUTH0_<sub>` username, and linked `PersonId`;
- read the linked `Person` name, email, and `PhotoUrl` fields; and
- fetch that person's `/GetImage.ashx` image.

It must not edit people, user logins, groups, workflows, attributes, or content. Deny unrelated REST controllers. Confirm the key can be revoked and rotated independently from website forms, sync workers, and Payload admin.

The avatar proxy accepts only the session-stored Rock photo reference, the configured Rock origin, and the documented `/GetImage.ashx` path with one `id` or `guid`. It does not accept a URL from the browser, follow redirects, proxy SVG, or reuse the shared `ROCK_API_KEY`.

## Exact-sub deployment gate

Perform this proof in a non-production environment first.

1. Select one controlled Auth0 identity and record only an operator-owned evidence reference, not its raw `sub`.
2. Authenticate through the public-member Auth0 application and inspect the Auth0 event securely to obtain that application's exact case-sensitive OIDC `sub`.
3. In Rock, confirm exactly one Auth0 `UserLogin` has that value in `ForeignKey`, the expected Auth0 authentication entity, username `AUTH0_<sub>`, and one linked person.
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

Member auth is enabled only when every `MEMBER_AUTH0_*` and `MEMBER_ROCK_*` setting validates. With any setting absent, partial, or placeholder:

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
7. Hold valid admin and member sessions at the same time. Member login/logout must not delete or overwrite the admin local or transaction cookies, create a Payload user, or grant `/admin` access.
8. Remove or invalidate one member setting. Anonymous pages remain healthy, member auth returns the private 503, and admin auth still works.

Member logout uses Auth0's supported OIDC logout. It clears only the member application's local cookie, but it can also end the shared Auth0 tenant SSO session. An existing Payload admin local cookie remains separate and usable until its own expiry; the next admin reauthentication may prompt. Confirm this tenant-wide effect is acceptable before production.

## Rollout

1. Deploy the code with member configuration absent so the feature remains disabled.
2. Configure and verify the dedicated Auth0 application and least-privilege Rock credential in non-production.
3. Complete the exact-sub and controlled first-user proofs, then all smoke tests.
4. Add the complete member configuration to production during an owned release window.
5. Repeat the exact-sub proof with one approved real member and repeat the simultaneous admin/member isolation test.
6. Monitor categorized member callback, Rock resolution, completion rejection, and avatar failure logs. Logs must contain reason categories only, never identity values or upstream response bodies.

Any identity ambiguity, unexpected Payload record, cookie collision, repeated callback failure, or unrelated Rock access is a no-go and triggers rollback.

## Rollback

Remove or invalidate the member-only configuration and redeploy. This hides the account controls, makes `/member-auth/*` unavailable, and prevents new member Rock calls without changing Payload admin auth or deleting upstream identities. Existing encrypted member cookies become unusable when the member session secret is removed or changed.

Rollback does not delete Auth0 users, Rock people, or Rock user logins. Investigate and remediate any upstream duplicate through its owning system; do not add a website-side email fallback.

## Secret rotation

- Rotate `MEMBER_AUTH0_CLIENT_SECRET` in Auth0 and the deployment secret store, deploy, then revoke the old value.
- Rotate `MEMBER_AUTH0_SECRET` by generating a new 32-byte hex secret and deploying it. This intentionally invalidates all existing member sessions but not Payload admin sessions.
- Rotate `MEMBER_ROCK_API_KEY` by creating a new least-privilege credential, proving its exact read scope and avatar access, deploying it, then revoking the old credential.

Rotate one boundary at a time and repeat sign-in, profile, avatar, logout, and admin-isolation smoke tests after each change. Record only secret version identifiers and timestamps, never secret values.
