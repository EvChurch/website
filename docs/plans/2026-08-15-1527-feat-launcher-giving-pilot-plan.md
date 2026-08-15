---
title: Launcher Giving Pilot - Plan
type: feat
date: 2026-08-15
topic: launcher-giving-pilot
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Launcher Giving Pilot - Plan

## Goal Capsule

- **Objective:** Let a person configure and authorise a one-off or fixed recurring bank-account gift from the EV Church launcher with the shortest practical flow and a gentle preference for recurring giving.
- **Product authority:** The giving-flow decisions were settled in the product conversation. BlinkPay's current Going Live, Testing, Recurring Payments, and Fixed Recurring Payments documentation owns the external production-readiness contract.
- **Execution profile:** This is a financial integration pilot involving persisted giving records, hosted bank authorisation, signed webhooks, administrative controls, feature-flagged exposure, monitoring, and E2E evidence.
- **Stop conditions:** Do not enable real giving until BlinkPay certification is complete, production credentials are isolated from sandbox credentials, the production-readiness acceptance examples pass, and a controlled real-money smoke test succeeds.
- **Tail ownership:** Implementation may prepare the production-shaped integration and sandbox proof. Production credentials, real-money tests, public feature-flag exposure, deployment, and external financial-system mutations remain explicitly controlled release actions.

---

## Product Contract

### Summary

EV Church will replace the launcher and header's disconnected external giving journey with a concise, mobile-first giving flow that asks one question at a time and hands bank authorisation to BlinkPay's hosted Gateway. BlinkPay will execute fixed recurring gifts through Fixed Recurring Payment schedules, while EV owns giver identity, fund allocation, reconciliation identifiers, administration, confirmations, and operational evidence.

### Problem Frame

Giving currently takes people from the EV Church website to a different giving website. That transition breaks the continuity of the launcher, adds friction at a high-intent moment, and prevents EV from shaping a short mobile experience or automatically associating digital gifts with known people and funds.

The Nucleus reference demonstrates the desired interaction discipline: one decision per view, very little explanatory text, compact summaries of earlier choices, and the ability to go back without losing later configuration. The supplied church-giving report indicates that recurring and bank-account giving account for disproportionate giving volume in its Nucleus dataset. EV will use that evidence directionally to prioritise recurring giving without hiding or obstructing one-off gifts.

### Actors

- A1. A guest who wants to give without creating or signing into an account.
- A2. A signed-in EV member whose known name and email can be reused.
- A3. An authorised EV giving administrator managing funds, givers, gifts, schedules, and exceptions.
- A4. BlinkPay's hosted Gateway, consent, payment, fixed-recurring-payment, and webhook services.
- A5. An EV operator responsible for production access, monitoring, incident response, and controlled rollout.

### Key Decisions

- **Use BlinkPay's hosted Gateway.** (session-settled: user-directed — chosen over sending the giver to an unrelated giving website or implementing a direct bank-selection flow: the experience should remain recognisably EV while BlinkPay owns bank authorisation.) Governs R1, R13, R20 and R21.
- **Let BlinkPay manage fixed recurring execution.** (session-settled: user-directed — chosen over an EV-owned payment scheduler: BlinkPay supports Fixed Recurring Payment schedules with starting dates, retries, cancellation, status and webhooks.) Governs R7-R10 and R26-R29.
- **Prioritise recurring giving gently.** (session-settled: user-directed — chosen over equal visual weight or a recurring-only path: recurring giving is strategically valuable while one-off giving must remain clear and available.) Governs R5 and R6.
- **Ask guests for identity immediately before BlinkPay.** (session-settled: user-directed — chosen over asking at the beginning: early configuration should feel fast, and known signed-in data should not be collected twice.) Governs R11-R13.
- **Use PostHog for controlled exposure.** (session-settled: user-directed — chosen over a PostgreSQL feature flag: staff must be able to prove sandbox and production behaviour before public activation.) Governs R34-R40.
- **Run marked sandbox E2E journeys against the production origin.** (session-settled: user-directed — chosen over limiting E2E to a local or preview deployment: the deployed EV return paths and launcher must be proven without creating real transactions.) Governs R38-R40.
- **Keep the first work unit production-shaped but narrow.** (session-settled: user-approved — chosen over a complete giving-management platform: the immediate goal is BlinkPay production readiness and a safe donor flow.) Governs R14-R19 and the Scope Boundaries.

### Requirements

**Launcher experience**

- R1. Give Now in the existing launcher and Give in the shared header open the same giving flow inside the launcher rather than navigating to a separate giving website when the PostHog flag is enabled.
- R2. The flow presents one primary question per view, uses only copy needed to complete that decision, and is designed first for effortless one-handed mobile use.
- R3. The launcher retains the shared Back, full-screen, Close, and Sign In controls, while Sign In remains launcher functionality rather than a required giving step.
- R4. A giver can return to any completed step and edit it without losing other valid answers; only answers made invalid by the change are cleared.
- R5. The frequency view gives monthly recurring the strongest prominence, presents weekly and fortnightly recurring choices next, keeps one-off giving clearly available with secondary emphasis, and places less common supported frequencies behind a compact additional-options action.
- R6. Recurring encouragement remains invitational: the flow does not preselect a financial commitment, hide one-off giving, introduce shame-based copy, or add extra steps to the one-off path.

**Gift configuration**

- R7. A recurring gift captures a fixed NZD amount, BlinkPay-supported frequency, and first payment date before authorisation.
- R8. Starting date uses a Nucleus-style view with a small set of immediately understandable near-date choices and a custom-date option, and the chosen date must satisfy BlinkPay's NZ-time validation.
- R9. Supported recurring choices map exactly to BlinkPay enduring-consent periods; unsupported twice-monthly patterns such as the 1st and 15th are not presented as native schedules.
- R10. EV creates a BlinkPay Fixed Recurring Payment schedule only after its enduring consent is confirmed as authorised, and BlinkPay remains responsible for initiating subsequent fixed payments.
- R11. General is the default fund and appears as a compact editable summary row, allowing the common path to proceed without a mandatory fund-selection screen.
- R12. The giver can select any other active public fund, and every submitted gift is associated with exactly one fund.
- R13. The review before BlinkPay shows amount, fund, one-off or recurring frequency, and recurring starting date in concise editable summary rows.

**Identity and confirmation**

- R14. A guest supplies name and email immediately before leaving EV for BlinkPay.
- R15. A signed-in giver is not asked for name or email already present in the EV member profile and is asked only for a missing required field.
- R16. Signing in midway through giving preserves the valid gift configuration and resumes at the appropriate point.
- R17. Giving remains available to guests, and neither account creation nor sign-in is required to complete a gift.
- R18. EV displays success only after verifying the authoritative BlinkPay consent or payment state, not merely because the browser returned to EV.
- R19. The confirmed result summarises the gift in clear language; branded emailed receipts and annual tax statements are deferred from the pilot.

**Giving identity and reconciliation**

- R20. EV assigns a durable internal giving or envelope ID to each giver and associates every gift, consent, and recurring schedule with that identity.
- R21. EV supplies a non-sensitive, bank-safe reconciliation reference within BlinkPay's Particulars, Code and Reference limits and retains the full internal mapping when the bank-visible fields cannot contain the complete identifier.
- R22. EV stores the selected fund independently from bank-statement text so truncation or statement formatting cannot change allocation.
- R23. EV does not treat BlinkPay as a source for giver name or email and does not request account-information access solely to infer identity.
- R24. EV does not store bank credentials or account details returned only within BlinkPay's hosted bank experience.

**Funds and administration**

- R25. An authorised giving administrator can create, edit, order, activate, deactivate, and choose the default from the funds shown in the public flow.
- R26. An authorised giving administrator can find a giver and see their internal giving ID, contact identity, gifts, BlinkPay identifiers, recurring arrangements, and current statuses.
- R27. An authorised giving administrator can inspect a gift or recurring arrangement by internal ID, BlinkPay consent ID, schedule ID, or payment ID.
- R28. An authorised giving administrator can cancel an active BlinkPay recurring schedule with an explicit confirmation and can distinguish schedule cancellation from consent revocation.
- R29. The administration surface highlights failed payments, cancelled schedules, revoked or expired consents, and webhook-processing exceptions that require attention.

**BlinkPay lifecycle and reliability**

- R30. One-off gifts use BlinkPay's hosted one-off payment path, while recurring gifts use an authorised enduring consent followed by one Fixed Recurring Payment schedule per consent.
- R31. EV records BlinkPay consent, payment, fixed-recurring-payment, next-payment-date, and lifecycle identifiers and statuses needed to reconcile the authoritative state.
- R32. EV verifies signed fixed-recurring-payment webhooks against the raw request body, deduplicates events, durably records receipt before processing, and safely handles completed, failed, and cancelled events without assuming delivery order.
- R33. The integration refreshes authentication after an applicable `401`, uses bounded backoff for retryable `5xx` failures, applies explicit timeouts, prevents duplicate financial actions, and records BlinkPay request IDs for support.

**Feature flag, environments and measurement**

- R34. A PostHog feature flag controls exposure of the new giving experience in both the launcher and shared header as one rollout decision.
- R35. When the flag is disabled, the existing production giving destination remains available; enabling the flag for a targeted audience opens the new in-launcher flow.
- R36. Sandbox and production BlinkPay endpoints, API credentials, and webhook secrets remain strictly separated, server-side only, and impossible to switch through browser input or the PostHog flag.
- R37. The initial flag remains unavailable to the public while transactions are mocked or sandboxed and becomes publicly eligible only after all production gates in this contract pass.
- R38. The production deployment provides a protected E2E test-session mechanism that routes only an explicitly authorised test session to BlinkPay sandbox credentials and endpoints without allowing a public query parameter, browser field, PostHog property, or client-side value to select the payment environment.
- R39. Every giver, gift, consent, payment, recurring schedule, webhook event, confirmation and administrative record created by a production-origin sandbox E2E session is durably marked as test data, visibly distinguished in administration, and excluded from real giving totals, receipts, exports and downstream financial integrations.
- R40. PostHog measures flow starts, step progression, returns from BlinkPay, verified completions, recurring selection and authorisation, errors, and time to completion without sending gift amounts, identity, BlinkPay identifiers, or other financial data; E2E events are marked as synthetic and excluded from production conversion reporting by default.

**Production readiness**

- R41. The release satisfies BlinkPay's current Going Live and Testing requirements for consent creation, hosted authorisation, payment initiation, return handling, error handling, security, mobile UX, monitoring, and the PNZ sandbox.
- R42. Operators monitor payment success, consent-authorisation success, API and webhook error rates, and completion time, and subscribe to BlinkPay service-status updates.
- R43. Public activation requires BlinkPay production certification, separate production credentials, a controlled real-money one-off test, a controlled real-money recurring setup and cancellation test, and verified reconciliation in EV.
- R44. The public rollout has a documented owner, a reversible PostHog flag action, and a response path for payment, consent, schedule, and webhook failures.

### Key Flows

- F1. **Configure a recurring gift as a guest**
  - **Trigger:** A1 opens Give from the launcher or header.
  - **Steps:** The flow captures amount, retains General or accepts another fund, offers recurring frequencies with monthly prominence, captures a starting date, gathers name and email, and presents an editable review.
  - **Outcome:** A1 reaches BlinkPay with a complete recurring-gift configuration and no unnecessary account step.
  - **Covered by:** R1-R14, R17 and R30
- F2. **Authorise and schedule a recurring gift**
  - **Trigger:** A1 or A2 confirms the reviewed recurring gift.
  - **Steps:** EV creates the enduring consent, sends the giver through BlinkPay's hosted Gateway, verifies authorisation on return, creates the fixed recurring schedule, and persists the resulting identifiers.
  - **Outcome:** BlinkPay owns future execution and EV shows a verified schedule summary.
  - **Covered by:** R10, R13, R18, R20-R24, R30 and R31
- F3. **Complete a one-off gift**
  - **Trigger:** A1 or A2 chooses one-off and confirms the reviewed gift.
  - **Steps:** EV gathers only missing identity, creates the hosted one-off BlinkPay payment journey, verifies the returned state, and records the allocated gift.
  - **Outcome:** The giver receives an EV confirmation and the administrator can reconcile the gift.
  - **Covered by:** R6, R11-R24, R26, R27, R30 and R31
- F4. **Edit an earlier answer**
  - **Trigger:** A1 or A2 selects an earlier summary row or uses Back.
  - **Steps:** The launcher returns to that question, applies the new answer, preserves independent later answers, clears invalid dependants, and returns to the updated progression.
  - **Outcome:** The giver can correct configuration without starting again.
  - **Covered by:** R3, R4 and R13
- F5. **Sign in during giving**
  - **Trigger:** A1 chooses the launcher's shared Sign In action after configuring some or all of a gift.
  - **Steps:** The launcher preserves the non-sensitive configuration across authentication, resolves the member profile, removes redundant identity questions, and resumes the flow.
  - **Outcome:** A2 continues without losing configuration or re-entering known details.
  - **Covered by:** R3 and R14-R17
- F6. **Process a recurring lifecycle event**
  - **Trigger:** A4 sends a signed completed, failed, or cancelled webhook.
  - **Steps:** EV verifies and records the event, deduplicates it, correlates the schedule and giver, updates lifecycle state, and surfaces exceptions to A3.
  - **Outcome:** EV's operational view reflects BlinkPay without duplicate gifts or silent failures.
  - **Covered by:** R26-R33 and R42
- F7. **Release the production flow**
  - **Trigger:** A5 prepares to enable real public giving.
  - **Steps:** A5 confirms sandbox evidence, BlinkPay certification, credential isolation, real-money smoke tests, monitoring and rollback, then expands the PostHog audience.
  - **Outcome:** Real giving is exposed intentionally and can be withdrawn without redeploying.
  - **Covered by:** R34-R44
- F8. **Run sandbox E2E against the production origin**
  - **Trigger:** The authorised E2E runner establishes a protected test session on the deployed EV site.
  - **Steps:** EV validates the test-session authority on the server, binds that session to the sandbox environment, completes the launcher and hosted BlinkPay journey, and propagates the test marker through return handling, persistence, webhooks, administration and analytics.
  - **Outcome:** The deployed production-origin journey is proven end to end without using production BlinkPay credentials or contaminating real financial records and metrics.
  - **Covered by:** R36 and R38-R41

### Acceptance Examples

- AE1. **Covers R1-R6 and R11-R13.** Given the PostHog flag is enabled for a mobile guest, when they select Give in either entry point, then the launcher opens at amount, General is already available as the fund summary, monthly has strongest recurring prominence, and one-off remains plainly selectable.
- AE2. **Covers R3, R4 and R13.** Given a giver has selected amount, General, monthly and a starting date, when they edit the amount and move forward, then fund, frequency and starting date remain unchanged.
- AE3. **Covers R7-R10.** Given a giver selects monthly with a valid future starting date and authorises the enduring consent, when EV creates the fixed recurring schedule, then BlinkPay reports an active schedule with the expected amount and next payment date.
- AE4. **Covers R8 and R9.** Given a giver selects a recurring frequency, when the starting-date view opens, then it offers concise near-date choices and a valid custom date without offering a twice-monthly schedule BlinkPay cannot represent.
- AE5. **Covers R14-R17.** Given a signed-in member has both name and email, when they configure a gift, then no identity view appears; given only email is missing, then only email is requested.
- AE6. **Covers R16.** Given a guest has configured a recurring gift and then signs in through the launcher, when authentication returns, then the same configuration is restored and known identity fields are skipped.
- AE7. **Covers R18, R30 and R31.** Given BlinkPay redirects the browser back before an authoritative success state is available, when EV handles the return, then it shows a processing state and does not show success until verification completes.
- AE8. **Covers R20-R24.** Given a gift has a bank-safe shortened reference, when an administrator searches by the full EV giving ID, then they can find the giver, fund and BlinkPay payment without EV storing bank credentials or relying on statement text for allocation.
- AE9. **Covers R25-R29.** Given an administrator deactivates a non-default fund, when a new giving flow begins, then that fund is absent while historical gifts retain their allocation.
- AE10. **Covers R28.** Given an administrator confirms cancellation of an active schedule, when BlinkPay accepts it, then EV records the schedule as cancelled and does not falsely describe the underlying enduring consent as revoked.
- AE11. **Covers R32.** Given BlinkPay delivers the same signed completed event more than once or out of order, when EV processes the deliveries, then only one gift outcome is recorded and the durable event history remains inspectable.
- AE12. **Covers R33.** Given BlinkPay returns an authentication failure or transient server failure, when the operation is safe to retry, then EV refreshes or backs off within bounded limits without creating a duplicate payment or schedule.
- AE13. **Covers R34-R40.** Given the feature flag is disabled for an ordinary visitor, when they use either Give entry point, then the current production giving destination remains available and no sandbox flow or financial event data is exposed to PostHog.
- AE14. **Covers R36 and R38-R40.** Given an authorised E2E run on the production origin, when the runner establishes its protected test session, then only that session uses BlinkPay sandbox, all resulting records and analytics are marked synthetic, and an ordinary visitor cannot reproduce the mode by copying a URL or changing browser-visible state.
- AE15. **Covers R41.** Given the PNZ sandbox, when the E2E suite exercises hosted one-off success, recurring authorisation and scheduling, rejection, timeout, cancellation and return handling, then each result is verified against BlinkPay state and EV's persisted test-marked record.
- AE16. **Covers R32 and R41.** Given BlinkPay cannot deterministically produce a failed fixed-recurring-payment event in sandbox, when verification runs, then completed and cancelled events use live sandbox E2E coverage and failed-event behavior uses a signature-valid mocked integration test documented as the provider limitation.
- AE17. **Covers R37 and R43-R44.** Given BlinkPay certification or either controlled real-money smoke test is incomplete, when an operator considers public activation, then the public PostHog audience remains disabled.

### Scope Boundaries

**Included now**

- The production-shaped one-off and fixed recurring donor journeys inside the launcher.
- Shared header entry, launcher Sign In continuity, guest identity capture, editable state retention, fund configuration, giving identity, minimal administration, webhook lifecycle, PostHog rollout and measurement, marked production-origin sandbox E2E proof, and production certification gates.
- The smallest operational surface needed to trace and respond to a real gift or recurring schedule safely.

**Deferred to later work**

- Branded email receipts, annual tax receipts, donor statements, giving-history visualisation, and a full self-service giver portal.
- Self-service changes to amount, frequency or starting date; BlinkPay requires cancelling the existing fixed schedule and creating a replacement.
- Automated matching of historical bank-statement deposits, broad accounting exports, and Rock RMS or other finance-system synchronisation.
- Split gifts across multiple funds, campaigns with goals or progress displays, pledges, variable recurring amounts, card payments, and non-NZD giving.
- Direct bank selection or direct account-data access inside EV; the pilot uses BlinkPay's hosted Gateway.
- Replacing the wider launcher design or making Sign In part of the giving component.

### External Production Contract

The following current BlinkPay documents are normative for the pilot. This plan records EV-specific behavior and does not duplicate their full requirements:

- [Going Live](https://merchants.blinkpay.co.nz/docs/shared/help/going-live)
- [Testing Guide](https://merchants.blinkpay.co.nz/docs/debit/testing)
- [Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments)
- [Fixed Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments)

The supplied Nucleus church-giving report and interface screenshots are directional research inputs for recurring prominence and interaction simplicity. They do not establish expected EV conversion or giving-volume forecasts.
