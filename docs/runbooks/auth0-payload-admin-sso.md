# Auth0 Payload Admin SSO Runbook

This runbook configures Payload admin access through EV Church's single website Auth0 application, removes disposable local-login users, and promotes the first trusted Auth0 identity. Never run the database steps until the target is confirmed disposable or an approved snapshot exists.

## Auth0 application

Use the existing Rock-connected Regular Web Application for the replacement website. Do not create a separate Payload-admin or public-member application.

- Allowed callback URL: `<APP_BASE_URL>/auth/callback`
- Allowed logout URL: `<APP_BASE_URL>/`
- Allowed web origin: `<APP_BASE_URL>`
- Scopes: `openid profile email`
- Do not request a Rock audience, refresh token, or `offline_access`.
- Enable the connections needed by the public website. Require MFA or the tenant's equivalent strong assurance for privileged staff, plus brute-force and breached-credential protections. Payload roles—not Auth0 connection membership—remain the admin authorization gate.

Store `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, and `PAYLOAD_SECRET` as distinct per-environment secrets in the deployment secret store. `AUTH0_SECRET` is 32 random bytes encoded as 64 hexadecimal characters. Limit secret access to deployment operators. Rotating it invalidates the shared website Auth0 session.

Before database work, deploy the application configuration and confirm `/admin` fails closed when any required value is missing. Do not print secret values in logs or deployment evidence.

## Confirm the database target

Record the operator, timestamp, environment, expected hostname, and expected database. Run these read-only queries and compare every value with the deployment configuration:

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SELECT count(*) AS users FROM users;
SELECT count(*) AS role_rows FROM users_roles;
SELECT count(*) AS local_sessions FROM users_sessions;
SELECT count(*) AS preference_links FROM payload_preferences_rels WHERE users_id IS NOT NULL;
SELECT count(*) AS lock_links FROM payload_locked_documents_rels WHERE users_id IS NOT NULL;
```

Stop if the target differs, if any record must be retained, or if application writes cannot be paused. Take an approved snapshot or record the explicit disposable-environment attestation before continuing.

## Railway release sequence

Railway currently runs `npx payload migrate` before the seed command and application start. Do not trigger the release while the existing service can still write: a rolling overlap would reopen the cleanup-to-migration race.

1. The deployment operator enables the maintenance window, scales the web service to zero, and confirms there are no active replicas, one-off jobs, or local processes using this database.
2. Record the database fingerprint above and take the approved pre-cutover snapshot. Record its identifier and restore instructions.
3. Run the disposable-user cleanup below and commit only after its five postconditions are zero.
4. Trigger exactly one Railway deployment. Do not manually run the same migration in parallel. The startup migration must complete before the seed command or web server begins.
5. In Railway logs, require the Auth0 migration to complete once, the seed command to complete, and the application health check to become healthy. A migration error, retry loop, or old replica still serving traffic is a **stop** condition.
6. Before inviting any Auth0 sign-in, run the post-migration gate below. Keep the service unavailable if any assertion fails.

### Mandatory post-migration gate

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
  AND column_name IN (
    'auth0_identity_key', 'auth0_issuer', 'auth0_subject',
    'reset_password_token', 'reset_password_expiration',
    'salt', 'hash', 'login_attempts', 'lock_until'
  )
ORDER BY column_name;

SELECT to_regclass('public.users_sessions') AS users_sessions;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('users_auth0_identity_key_idx', 'users_roles_parent_value_unique')
ORDER BY indexname;

SELECT count(*) AS users_after_migration FROM users;
SELECT count(*) AS roles_after_migration FROM users_roles;
```

The columns query must return only `auth0_identity_key`, `auth0_issuer`, and `auth0_subject`; `users_sessions` must be null; both named indexes must be present; and both counts must be zero. Save the results with the deployment evidence. Any mismatch is **NO-GO** and the service stays unavailable.

## Remove disposable development users

This is a one-time operation before the Auth0 schema migration. It is intentionally separate from the durable migration.

```sql
BEGIN;
LOCK TABLE users, users_roles, users_sessions IN SHARE ROW EXCLUSIVE MODE;

SELECT id, email, name, created_at FROM users ORDER BY id;
DELETE FROM users;

SELECT count(*) AS users_after FROM users;
SELECT count(*) AS roles_after FROM users_roles;
SELECT count(*) AS sessions_after FROM users_sessions;
SELECT count(*) AS preference_links_after FROM payload_preferences_rels WHERE users_id IS NOT NULL;
SELECT count(*) AS lock_links_after FROM payload_locked_documents_rels WHERE users_id IS NOT NULL;
```

Stop and review the results. All five post-delete counts must be zero. If they are, run `COMMIT;` as a separate approved step. If any count is nonzero, run `ROLLBACK;` and investigate the unexpected relationship. After cleanup, run the registered Auth0 admin SSO migration while writes remain paused, then deploy the Auth0-enabled application.

## Create and promote the first administrator

1. Have the trusted first administrator visit `/admin` and complete Auth0 sign-in.
2. Confirm they see the waiting-for-access page.
3. Copy the immutable `auth0_identity_key` from the single new roleless row. Use email and name only as secondary human checks.
4. In `psql`, set the key and run the transaction below. It inserts nothing if the target is ambiguous, already has a role, or any administrator already exists.

```sql
\set auth0_identity_key 'REPLACE_WITH_REVIEWED_IDENTITY_KEY'

BEGIN;
LOCK TABLE users, users_roles IN SHARE ROW EXCLUSIVE MODE;

SELECT id, auth0_identity_key, auth0_issuer, auth0_subject, email, name
FROM users
WHERE auth0_identity_key = :'auth0_identity_key';

SELECT count(*) AS target_roles
FROM users_roles r
JOIN users u ON u.id = r.parent_id
WHERE u.auth0_identity_key = :'auth0_identity_key';

SELECT count(*) AS existing_admins
FROM users_roles
WHERE value = 'admin';

INSERT INTO users_roles ("order", parent_id, value)
SELECT 1, u.id, 'admin'
FROM users u
WHERE u.auth0_identity_key = :'auth0_identity_key'
  AND NOT EXISTS (SELECT 1 FROM users_roles r WHERE r.parent_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM users_roles r WHERE r.value = 'admin')
RETURNING id, parent_id, value;

SELECT u.id, u.email, r.id AS role_row_id, r.value
FROM users u
JOIN users_roles r ON r.parent_id = u.id
WHERE u.auth0_identity_key = :'auth0_identity_key';
```

Stop and review the results. The identity query must return exactly one row, both counts must be zero before insertion, the insert must return exactly one row, and the final query must show exactly that `admin` role. Record the returned role-row ID in the audit evidence. If every assertion matches, run `COMMIT;` as a separate approved step. If any assertion differs, run `ROLLBACK;`; do not adapt the SQL in place.

The administrator can now choose **Check access again** without signing in again. Verify the Payload panel opens and that later role assignment happens only inside Payload.

### Bootstrap rollback window

Before any ordinary role administration occurs, rollback may remove only the captured bootstrap role row:

```sql
BEGIN;
DELETE FROM users_roles
WHERE id = REPLACE_WITH_CAPTURED_ROLE_ROW_ID
  AND value = 'admin'
RETURNING id, parent_id, value;
COMMIT;
```

Do not use this after normal role management begins. Never delete the user or all role rows as a rollback shortcut.

### Application and schema rollback

Before the first Auth0 callback creates a user, the deployment operator may keep the service at zero, run `npx payload migrate:down`, verify that the local credential columns and `users_sessions` were restored, deploy the previous commit, and then restore service.

After any Auth0 user exists, the down migration intentionally refuses because local credentials cannot be reconstructed. A code-only rollback is not valid. Prefer a forward fix. If an emergency requires full rollback, keep the service at zero, restore the recorded pre-cutover database snapshot, deploy the previous commit, verify the database fingerprint and local-login schema, and only then restore service. Record that all writes after the snapshot are discarded; if that loss is unacceptable, the rollback is **NO-GO** and a forward fix is required.

## Offboarding and emergency recovery

Offboarding is a coordinated action: remove every Payload role first so the next admin page or API request is denied, then disable the Auth0 identity. Auth0 disablement alone does not revoke an already-issued encrypted application cookie before its eight-hour absolute limit. Record both actions.

The application prevents ordinary deletion or demotion of the final administrator. If an unexpected lockout nevertheless leaves zero administrators, a trusted deployment operator may repeat the promotion transaction above for one verified roleless identity. Record it as emergency recovery, not bootstrap, and retain the same target, identity, and one-row evidence.

## Stale roleless records

Roleless records contain staff PII but no authorization. Review candidates before deletion:

```sql
SELECT u.id, u.email, u.name, u.created_at
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM users_roles r WHERE r.parent_id = u.id)
ORDER BY u.created_at;
```

Delete only explicitly rejected or stale IDs through Payload admin when an administrator is available. Direct SQL cleanup is reserved for a verified recovery window and must capture the same target and row-count evidence. This is an operational cleanup, not a member-account lifecycle policy.

## Acceptance evidence

Record results for signed-out redirect, first roleless login, waiting message, check-again after role grant, nested admin return, role removal on the next page and API request, cancelled/invalid callback, hostile return URL, logout followed by replay of the prior cookie, mobile layout, and keyboard/screen-reader status behavior. Never record cookies, tokens, subjects, or secret values in screenshots or logs.

## First-day monitoring

The named deployment operator owns checks at +5 minutes, +1 hour, +4 hours, and +24 hours. Record each result and incident link. After bootstrap, the administrator count must remain exactly one or greater, duplicate identity/role counts must stay zero, and unexplained callback-failure logs must stay below five in any 15-minute window. Any zero-admin result, duplicate, repeated migration, or sustained failure threshold pages the deployment operator and keeps further role assignment paused.

```sql
SELECT count(DISTINCT parent_id) AS administrators
FROM users_roles WHERE value = 'admin';

SELECT auth0_identity_key, count(*)
FROM users GROUP BY auth0_identity_key HAVING count(*) > 1;

SELECT parent_id, value, count(*)
FROM users_roles GROUP BY parent_id, value HAVING count(*) > 1;

SELECT count(*) AS roleless_users
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM users_roles r WHERE r.parent_id = u.id);
```

The first three queries are hard invariants. Track the roleless count against the reviewed sign-in attempts; an unexpected increase pauses onboarding and triggers investigation. In Railway logs, monitor `auth0_admin_callback_failed` by `reason` without recording claims or tokens.
