---
title: Separate Auth0 authentication from Payload authorization
date: 2026-08-06
category: architecture-patterns
module: Payload admin authentication
problem_type: architecture_pattern
component: authentication
severity: high
applies_when:
  - Replacing Payload local login with an external identity provider
  - Supporting future member authentication without granting CMS access
tags:
  - auth0
  - payload-cms
  - authentication
  - authorization
  - least-privilege
---

# Separate Auth0 authentication from Payload authorization

## Context

EV Church needed Auth0 SSO for the Payload admin panel while preserving Payload's existing `admin`, `content-lead`, and `editor` permissions. A successful identity-provider login must not automatically grant CMS access, especially because the same Auth0 tenant may later support member-facing authentication.

## Guidance

Treat Auth0 as proof of identity and Payload as the source of authorization:

- Disable Payload's local login strategy and authenticate admin requests through the Auth0 strategy (`src/collections/Users.ts:13`).
- Provision the local Payload user during the verified Auth0 callback, but omit `roles` from the create data (`src/auth/provision-auth0-user.ts:15`).
- Redirect a newly provisioned roleless user to the pending-access page (`src/auth/auth0-client.ts:60`).
- Return a Payload-authenticated user only when the local record has a recognized Payload admin role (`src/auth/auth0-payload-strategy.ts:27`).
- Allow only Payload administrators to assign roles (`src/collections/Users.ts:84`).

The resulting flow is:

```text
Auth0 login -> local user lookup/provisioning -> Payload role check
                                            -> role present: /admin
                                            -> no role: access-pending page
```

Use a dedicated Auth0 application for admin SSO. The deployment runbook explicitly keeps it separate from Rock and future member clients (`docs/runbooks/auth0-payload-admin-sso.md:5`).

## Why This Matters

Automatically assigning a default editor role would turn possession of any accepted Auth0 account into CMS access. Creating a roleless local record instead preserves identity continuity and gives administrators an auditable place to grant or remove Payload permissions without coupling authorization to Auth0 connection membership.

This boundary also leaves room for future `/members` authentication: member sign-in can share the tenant while using a separate client, callback, session, and authorization policy.

## When to Apply

- Replacing a CMS-native password login with SSO.
- Accepting multiple enterprise or social connections through one identity provider.
- Sharing an identity tenant across staff and public applications.
- Requiring administrators to approve CMS access after first sign-in.

## Examples

Do not assign a role during provisioning:

```ts
await payload.create({
  collection: 'users',
  overrideAccess: true,
  data: {
    name: identity.name,
    email: identity.email,
    auth0IdentityKey: identity.identityKey,
    auth0Issuer: identity.issuer,
    auth0Subject: identity.subject,
  },
})
```

Enforce the role again on every Payload authentication attempt:

```ts
const user = await resolve(payload, identity)
if (!user || !hasPayloadAdminRole(user)) return { user: null }
```

## Related

- [Auth0 Payload admin SSO runbook](../../runbooks/auth0-payload-admin-sso.md)
- [Payload-managed campus pages with Rock-synced identity](payload-managed-campus-pages.md)
