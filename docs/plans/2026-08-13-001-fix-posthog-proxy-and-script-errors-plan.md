---
title: PostHog Managed Proxy and Third-Party Script Errors - Plan
type: fix
date: 2026-08-13
topic: posthog-managed-proxy-and-script-errors
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

## Goal Capsule

- Objective: route browser PostHog ingestion through the managed `t.ev.church` proxy and expose full exception context for controlled third-party scripts whose origins support anonymous CORS.
- Product authority: existing analytics privacy exclusions, capture behavior, session-replay masking, and third-party feature behavior remain unchanged.
- Execution profile: add focused regression assertions, make the minimal SDK and script-loader changes, then verify the affected tests and production build.
- Stop conditions: do not add anonymous CORS to a script whose origin lacks `Access-Control-Allow-Origin`, because that would block the script from loading.
- Tail ownership: implementation owns code, tests, environment documentation, Railway configuration, review, PR creation, and CI.
- Open blockers: none.

## Product Contract

### Summary

PostHog event ingestion must use the managed first-party proxy at `https://t.ev.church` while PostHog UI links retain the US Cloud application host.
Browser exceptions from Google Analytics and Cloudflare Turnstile must include cross-origin context where their current response headers permit it.

### Problem Frame

The current PostHog initializer still points directly at the US ingestion host, so it bypasses the newly managed proxy.
PostHog also reports generic `Script error.` exceptions when a cross-origin script throws without anonymous CORS enabled, hiding the stack and source details needed for diagnosis.

### Requirements

- R1. Send PostHog SDK ingestion and asset requests through `https://t.ev.church`.
- R2. Keep PostHog UI navigation on `https://us.posthog.com` rather than treating the ingestion proxy as the application host.
- R3. Document separate browser-visible ingestion and UI host settings for local and Railway configuration.
- R4. Load Google Analytics and Cloudflare Turnstile with anonymous CORS so exceptions can include source context.
- R5. Preserve existing analytics privacy rules, route exclusions, masking, exception capture, replay behavior, and Google Analytics pageview behavior.
- R6. Do not add anonymous CORS to API.Bible FUMS or YouTube's iframe API while those origins omit `Access-Control-Allow-Origin`, because CORS-mode loading would reject those required scripts.
- R7. Protect each changed code-level PostHog and script-loader configuration boundary with a focused regression assertion.

### Acceptance Examples

- AE1. PostHog initialization
  - **Covers:** R1-R3, R5, R7.
  - **Given:** the PostHog project token, managed proxy host, and UI host are configured.
  - **When:** an eligible public page initializes analytics.
  - **Then:** the SDK receives the proxy as `api_host`, the PostHog application as `ui_host`, and all existing privacy options unchanged.

- AE2. CORS-capable external scripts
  - **Covers:** R4, R5, R7.
  - **Given:** an eligible page loads Google Analytics or a form loads Turnstile.
  - **When:** the external script element is created.
  - **Then:** it uses anonymous CORS without changing its source, timing, callbacks, or page behavior.

- AE3. CORS-incapable required scripts
  - **Covers:** R6.
  - **Given:** API.Bible FUMS or YouTube's iframe API is required.
  - **When:** the site loads that integration.
  - **Then:** the existing loader remains unchanged rather than being blocked by an unsupported CORS request.

### Scope Boundaries

- In scope: PostHog SDK host configuration, browser-visible environment documentation, Railway web-service variables, Google Analytics script attributes, Turnstile script attributes, and focused regression coverage.
- Out of scope: analytics route or privacy changes, self-hosting third-party scripts, proxying API.Bible or YouTube, suppressing `Script error.` events, source-map upload changes, and unrelated observability work.

### Sources and Research

- `src/components/seo/AnalyticsManager.tsx`
- `src/components/seo/AnalyticsManager.test.tsx`
- `src/components/seo/GoogleAnalytics.tsx`
- `src/components/forms/TurnstileWidget.tsx`
- `src/components/forms/TurnstileWidget.dom.test.tsx`
- `src/components/daily-readings/DailyReadingFlow.tsx`
- `.env.example`
- `docs/solutions/architecture-patterns/public-analytics-sensitive-route-boundary.md`
- PostHog Error Tracking troubleshooting document supplied with this task.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Separate PostHog ingestion from UI navigation.** Continue using browser-visible environment values, but pass the managed proxy to `api_host` and the US Cloud application origin to `ui_host`. This follows PostHog's reverse-proxy contract and prevents toolbar or link behavior from targeting the ingestion-only proxy. Covers R1-R3.
- KTD2. **Apply anonymous CORS only where the upstream supports it.** Add `crossOrigin="anonymous"` to Google Analytics and set `script.crossOrigin = 'anonymous'` before the Turnstile source is assigned. Live responses from both origins include permissive CORS headers. Covers R4, R7.
- KTD3. **Leave unsupported third-party loaders unchanged.** API.Bible FUMS and YouTube's iframe API currently return no `Access-Control-Allow-Origin`; adding anonymous CORS would turn an opaque exception into a load failure. Covers R6.
- KTD4. **Preserve the established analytics privacy boundary.** The change is transport and error-context configuration only; do not change route eligibility, masking, persistence, capture, replay, or identification settings. Covers R5.

### Assumptions

- The managed proxy remains assigned to the existing US Cloud PostHog project.
- `NEXT_PUBLIC_POSTHOG_UI_HOST` is set to `https://us.posthog.com` in deployed environments.
- Railway CLI access is linked to the production project and the target web service can be identified without exposing secret values.
- Third-party response headers were checked live during planning and may be rechecked before implementation if the provider behavior changes.

### Sequencing

U1 adds the PostHog host split and its regression contract.
U2 adds supported anonymous-CORS attributes and focused assertions.
U3 updates the Railway web-service variables after local verification, then the normal shipping tail builds and validates the combined change.

### Risks and Dependencies

- A wrong `ui_host` would direct PostHog UI behavior to an ingestion-only domain. Assert it separately from `api_host`.
- Adding `crossOrigin` after a dynamic script source is assigned can be too late. Set it before `src` and before insertion.
- Adding anonymous CORS to a source without upstream ACAO would break that integration. Keep API.Bible and YouTube excluded unless their headers change.
- Updating a `NEXT_PUBLIC_*` Railway variable requires a new web build because Next.js embeds it into the browser bundle.

---

## Implementation Units

### U1. Route PostHog through the managed proxy

- **Goal:** split PostHog's ingestion and UI origins while retaining the existing privacy-safe initializer.
- **Requirements:** R1-R3, R5, R7; AE1; KTD1, KTD4.
- **Files:** `src/components/seo/AnalyticsManager.tsx`, `src/components/seo/AnalyticsManager.test.tsx`, `.env.example`.
- **Approach:** read a dedicated UI-host environment value alongside the existing project token and proxy host, require all three before initialization, and pass both PostHog host options. Update the environment template to name the managed proxy and US Cloud UI origin clearly.
- **Test scenarios:**
  1. An eligible public route initializes PostHog with `api_host: https://t.ev.church` and `ui_host: https://us.posthog.com`.
  2. The initializer retains all current privacy and replay settings.
  3. A sensitive route still does not initialize analytics.
  4. A missing PostHog UI host leaves PostHog uninitialized while Google Analytics remains available on an eligible route.
- **Verification:** run `pnpm exec vitest run src/components/seo/AnalyticsManager.test.tsx`.

### U2. Enable full exception context for supported third-party scripts

- **Goal:** prevent opaque cross-origin exceptions from the third-party loaders that support CORS.
- **Requirements:** R4-R7; AE2, AE3; KTD2-KTD4.
- **Files:** `src/components/seo/GoogleAnalytics.tsx`, `src/components/seo/GoogleAnalytics.test.tsx` (new), `src/components/forms/TurnstileWidget.tsx`, `src/components/forms/TurnstileWidget.dom.test.tsx`.
- **Approach:** add anonymous CORS to the external Google Analytics script component and to dynamically created Turnstile scripts before assigning their URL. Do not alter API.Bible FUMS or YouTube loaders.
- **Test scenarios:**
  1. Google Analytics renders its external loader with anonymous CORS while retaining the expected URL and loading strategy.
  2. A newly created Turnstile script has anonymous CORS before use and retains the expected URL, async/defer flags, retry state, and callbacks.
  3. Existing Turnstile failure and retry behavior still passes.
- **Verification:** run `pnpm exec vitest run src/components/seo/GoogleAnalytics.test.tsx src/components/forms/TurnstileWidget.dom.test.tsx`.

### U3. Apply and verify deployment configuration

- **Goal:** make the production browser bundle use the managed proxy and correct UI host.
- **Requirements:** R1-R3; AE1.
- **Files:** Railway web-service environment configuration; no secret file is committed.
- **Approach:** identify the linked production web service, securely retain the current host values for rollback, health-check the managed proxy, set the proxy and UI host browser variables, allow the variable update to trigger the required deployment, and report deployment/CI status separately. Restore the prior values and redeploy if live verification cannot confirm successful project traffic through the managed proxy.
- **Test scenarios:**
  1. Railway shows both browser-visible host variables on the intended web service.
  2. The managed proxy configuration endpoint continues returning a successful response.
  3. The deployed site bundle sends PostHog traffic to the managed proxy after the PR is deployed.
- **Verification:** inspect Railway variable names without printing credentials, check the deployment created by the change, and perform live browser verification when the PR reaches production.

---

## Verification Contract

- Run the focused analytics and script-loader tests for U1 and U2.
- Run `pnpm build` as the repository production gate.
- Confirm `https://t.ev.church/decide/?v=3` responds successfully.
- Confirm no changes were made to API.Bible FUMS or YouTube loader behavior.
- Review the final diff for accidental analytics privacy or route-policy changes.

## Definition of Done

- PostHog initializes with the managed proxy as `api_host` and the US Cloud app as `ui_host`.
- `.env.example` clearly documents both browser-visible values.
- Google Analytics and Turnstile load with anonymous CORS and focused tests prove the attributes.
- API.Bible FUMS and YouTube loaders remain unchanged while their origins lack ACAO.
- Focused tests and `pnpm build` pass.
- The intended Railway web service has the updated browser configuration.
- The branch is reviewed, committed, pushed, opened as a PR, and CI reaches a decided state.
