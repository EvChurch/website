---
title: Keep public Rock form capabilities confidential and recoverable
date: 2026-08-04
last_updated: 2026-08-06
category: security-issues
module: Rock RMS website forms
problem_type: security_issue
component: authentication
symptoms:
  - Browser-readable form contexts exposed Rock file-upload grants
  - Public multipart and person-search endpoints lacked complete abuse bounds
  - Spent or expired Connection Signup contexts could not recover without a reload
root_cause: missing_validation
resolution_type: code_fix
severity: high
tags: [rock-rms, form-security, capability-token, rate-limiting, replay-prevention]
---

# Keep public Rock form capabilities confidential and recoverable

## Problem

The website must proxy public Rock forms without exposing privileged Rock state or allowing a visitor to reuse a spent submission capability. A signed context protects integrity, but it does not hide bearer credentials embedded in its payload.

## Symptoms

- Workflow form schemas and signed contexts contained Rock `SecurityGrantToken` values.
- The workflow multipart route parsed the complete body before Turnstile verification and only checked individual recognized files afterward.
- The person picker accepted a reusable workflow context without a strict production Origin check or rate limit.
- Expired, replayed, configuration-changed, and definitively rejected Connection Signup contexts returned the visitor to an editor that still held the unusable context.

## What Didn't Work

- HMAC-signing a base64url JSON context prevented tampering but did not provide confidentiality.
- Per-file limits did not bound aggregate multipart parsing cost.
- Resetting only Turnstile after a one-use nonce was consumed did not make the old signup context reusable.

## Solution

Use authenticated encryption for workflow contexts. `src/lib/rock-forms/context-token.ts` derives an AES-256-GCM key from the server-only form secret and emits a versioned envelope containing the IV, ciphertext, and authentication tag. Public schemas in `src/lib/rock-forms/server.ts` strip both field-level grant properties; the encrypted context retains the grant only for the server-side upload proxy.

Bound multipart input before calling `formData()`. `src/app/api/rock-forms/[workflowTypeGuid]/route.ts` reads the request stream with a 17 MiB ceiling, reconstructs a bounded request, and then caps total entries and files before Turnstile or Rock calls.

Apply the existing PostgreSQL-backed trusted-address limiter to person search. The route class `personSearch` has a maximum of 30 requests per ten-minute window and uses the same fail-closed Cloudflare address contract as Connection Signup requests.

Validate production browser origins against the deployment's public hostname, not `request.nextUrl`. Cloudflare terminates the public request before Railway forwards it to Next.js, so `request.nextUrl` can contain Railway's internal `0.0.0.0:3000` origin. `src/lib/request-origin.ts` derives the exact HTTPS origin from `RAILWAY_PUBLIC_DOMAIN`, and both Turnstile-protected form routes use the same variable as their expected token hostname. A missing or malformed production value fails the Origin check before request processing.

Treat Rock's interactive-action `url` as a workflow permalink, not a post-submit redirect. It commonly points back to Rock's Workflow Entry page (for example, `/page/1108?WorkflowId=...`), which does not exist on the website. Navigate only when `actionData.message` explicitly has the `Redirect` type, then pass that destination through the existing redirect validator. Otherwise show the workflow completion message in place.

Return `restartRequired: true` when a Connection Signup context is invalid, its configuration changed, its nonce is gone, or Rock definitively rejected the request. The client clears only the spent context, obtains a fresh Turnstile-protected context, and preserves entered values that still exist in the refreshed schema. Ambiguous upstream outcomes remain terminal and must never offer automatic retry.

## Why This Works

AES-GCM provides confidentiality and integrity, so the browser cannot extract the Rock upload grant or alter the workflow state. Stream and entry limits bound unauthenticated memory use. The database-backed limiter works across application instances. Explicit restart semantics distinguish safe retries after known failures from unsafe retries after an unknown upstream outcome.

## Prevention

- Treat every client-returned signed payload as readable unless it is encrypted.
- Bound request bytes before parsers materialize multipart bodies.
- Give public lookup endpoints strict Origin and durable per-client abuse limits.
- Behind a reverse proxy, derive Origin and Turnstile hostname checks from one trusted public-domain setting; do not trust the application's internal request URL.
- Do not infer navigation from Rock's workflow permalink; require an explicit Redirect action.
- Model one-use capability failures explicitly as reusable, restart-required, or outcome-unknown.
- Exercise migration up, refusal, down, and re-apply against real PostgreSQL when a migration owns security ledgers.

## Related Issues

- [Rock connection signup operations](../../rock-connection-signups.md)
- [Rock connection signup implementation plan](../../plans/2026-08-04-001-feat-rock-connection-signups-plan.md)
