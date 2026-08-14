---
title: Verify provider request contracts in composed auth flows
date: 2026-08-14
category: integration-issues
module: Member impersonation
problem_type: integration_issue
component: authentication
symptoms:
  - Rock email searches fail only when the query returns populated results
  - A valid impersonation form submission returns a hidden 404
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [auth0, rock-rms, payload-cms, impersonation, integration-testing]
---

# Verify provider request contracts in composed auth flows

## Problem

The admin impersonation flow passed mocked tests but failed against the composed local application. Rock rejected valid-looking OData requests, and Auth0 could not read a request after its multipart form body had already been consumed.

## Symptoms

- A broad email search returned “We could not search Rock right now” only when Rock found people.
- Clicking **Impersonate** submitted the expected POST but returned a 404 instead of redirecting to `/members`.

## What Didn't Work

- Testing an email with no Rock results proved only the first request. It never exercised the follow-up `UserLogins` lookup.
- Mocking `getSession()` as a function that ignored its request hid Auth0's request-cloning behavior.
- Treating syntactically plausible OData as portable across Rock endpoints missed endpoint-specific selectable fields and expression limits.

## Solution

Probe the deployed Rock API with the exact filters and projections used by the application. The member search now uses the supported email expression and limits each `UserLogins` filter to 16 person IDs (`src/auth/rock-member-directory.ts:15`, `src/auth/rock-member-directory.ts:60-95`). All batches must return arrays before their identities are combined, so malformed or rejected batches fail closed.

Read the Auth0 session before consuming the form body. The start route performs trusted-request and Payload-admin checks, calls `auth0.getSession(request)`, and only then calls `request.formData()` (`src/app/(frontend)/member-impersonation/start/route.ts:18-38`). The route test makes the Auth0 mock clone the request so reversed ordering fails (`src/app/(frontend)/member-impersonation/start/route.test.ts:25-30`).

Cover the populated boundary, not only the empty path. The Rock tests exercise a full 20-person page, the 16-plus-4 batching boundary, and malformed or rejected later batches (`src/auth/rock-member-directory.test.ts:91-136`). Finally, submit the real form in a browser and verify the `/members` redirect, impersonation bar, and return control.

## Why This Works

External SDKs and APIs own request constraints that mocks do not reproduce automatically. Exercising the populated second request exposes Rock's real query limits, while cloning the multipart request in the Auth0 mock preserves the SDK invariant that the body must still be readable. The browser check verifies both contracts together with real cookies and routing.

## Prevention

- For multi-step external searches, test zero results, populated results, maximum result pages, and failures in every downstream batch.
- Make auth mocks perform request operations that the real SDK performs, such as cloning before session access.
- Verify provider-specific filters and projections against the deployed provider version before treating a mocked request as compatible.
- Keep one composed browser check for state-changing authentication flows, including the final redirect and visible session state.

## Related Issues

- [PR #95](https://github.com/EvChurch/website/pull/95)
- [Separate Auth0 authentication from Payload authorization](../architecture-patterns/auth0-authentication-payload-authorization.md)
