---
title: Rock Auth0 Identity Resolution - Plan
type: fix
date: 2026-08-11
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Rock Auth0 Identity Resolution - Plan

## Goal Capsule

- **Objective:** Restore public-member sign-in for Rock Auth0 identities whose `UserLogin.ForeignKey` is empty.
- **Authority:** The exact-subject and no-email-fallback decisions in this plan govern the implementation, followed by `AGENTS.md` and existing authentication patterns.
- **Execution profile:** Lightweight security-sensitive hotfix with one resolver unit and one documentation and verification unit.
- **Stop conditions:** Stop if the exact Auth0 username is not unique, the authentication entity is wrong, the login has no linked person, or the change would require email matching or Payload authorization changes.
- **Tail ownership:** LFG owns review, commit, pull request creation, and CI follow-through.

## Product Contract

### Summary

Public-member sign-in must resolve the exact Auth0 subject from Rock's deployed `UserLogin` representation even when Rock leaves `ForeignKey` empty.

### Problem Frame

Production Rock stores the exact Auth0 subject in `UserName` as `AUTH0_<sub>` for many member identities but does not consistently populate `ForeignKey`.
The website currently requires both fields, so valid Auth0 sessions become unresolved member sessions and redirect to the generic sign-in error page.

### Requirements

**Identity resolution**

- R1. Resolve a member candidate by the exact case-sensitive `AUTH0_<sub>` username.
- R2. Accept the candidate only when exactly one login exists, its authentication entity is the expected Auth0 entity, and it links to a valid Rock person.
- R3. Keep zero, duplicate, malformed, wrong-entity, and unlinked results fail-closed.

**Security boundary**

- R4. Do not use email as an identity key or fallback and do not change Payload authorization behavior.

**Regression and operations**

- R5. Add regression coverage for a valid Rock Auth0 login whose `ForeignKey` is empty.
- R6. Update the public-member authentication runbook to document the deployed Rock identity contract.

### Acceptance Examples

- AE1. Covers R1, R2, R5: Given one expected Auth0 `UserLogin` with username `AUTH0_<sub>`, a linked person, and `ForeignKey: null`, when the resolver runs, then it returns that member profile.
- AE2. Covers R2, R3: Given a username match with the wrong authentication entity or no linked person, when the resolver runs, then it returns an unresolved result.
- AE3. Covers R3: Given zero or more than one exact username match, when the resolver runs, then it returns `identity-not-found` or `identity-ambiguous` and does not load a person profile.
- AE4. Covers R4: Given a person with a matching email but no exact Auth0 username, when the resolver runs, then email does not influence the result.

### Scope Boundaries

- In scope: Rock member identity lookup, its focused tests, and the public-member authentication runbook.
- Out of scope: Auth0 tenant settings, Rock record mutation, email-based account linking, Payload role assignment, session-cookie changes, and UI redesign.

## Planning Contract

### Key Technical Decisions

- KTD1. **Use `UserName` as the deployed exact-subject key.** Query `UserLogin` by `AUTH0_<sub>` and validate the returned username again after parsing. (session-settled: user-approved — chosen over requiring both `ForeignKey` and `UserName`: production evidence shows valid Rock identities often leave `ForeignKey` empty.) Covers R1-R3.
- KTD2. **Retain independent identity invariants.** Keep exact-one cardinality, expected authentication entity, positive login and person IDs, and linked-person profile validation. (session-settled: user-directed — chosen over email fallback: exact Auth0-to-Rock association is the required security boundary.) Covers R2-R4.
- KTD3. **Model the production record shape in the focused unit test.** Add a `ForeignKey: null` fixture while keeping wrong-username, wrong-entity, ambiguity, injection-escaping, and upstream-failure coverage. Covers R3-R5.

### Assumptions

- Rock's Auth0 integration continues to store the exact OIDC subject in `UserName` with the `AUTH0_` prefix.
- The existing expected Auth0 authentication entity GUID remains the correct discriminator.
- This change remains read-only with respect to Rock and Payload.

### Risks and Mitigations

- Rock may compare `UserName` case-insensitively. Post-query exact comparison prevents authenticating a case-mismatched identity, while ambiguity remains fail-closed.
- Mocked tests can drift from production Rock data. The regression fixture mirrors the observed nullable field and a read-only production contract check verifies the deployed representation.

## Implementation Units

### U1. Correct the Rock Auth0 identity adapter

- **Goal:** Resolve valid member identities without depending on nullable `ForeignKey`.
- **Requirements:** R1-R5; KTD1-KTD3.
- **Files:** `src/auth/rock-member-profile.ts`, `src/auth/rock-member-profile.test.ts`.
- **Approach:** Remove `ForeignKey` from the query projection and validation invariant. Keep exact username, entity, cardinality, linked-person, escaping, timeout, retry, and categorized failure behavior.
- **Test scenarios:**
  - One exact username with `ForeignKey: null` resolves the expected profile.
  - Zero and duplicate username matches fail before the person request.
  - Wrong username, wrong entity, mismatched entity ID, and missing person stay invalid.
  - A subject containing an apostrophe remains escaped without broadening the OData filter.
  - Email changes do not alter identity selection.
- **Verification:** Focused resolver tests and the broader authentication callback and completion-route tests pass.

### U2. Align operational documentation and verify the hotfix

- **Goal:** Make the deployed identity contract explicit and prove the change across repository and production-read boundaries.
- **Requirements:** R4-R6; KTD1-KTD3.
- **Files:** `docs/runbooks/public-member-authentication.md`.
- **Approach:** Replace the `ForeignKey` requirement with exact `AUTH0_<sub>` username guidance and state that Rock may leave `ForeignKey` empty. Run repository checks and a read-only production Rock contract check without logging subjects or profile data.
- **Verification mechanism:** Use a transient `tsx` evaluation under Railway's injected production environment. Read the operator-selected person's existing Auth0 `UserLogin` usernames through `memberRockFetch`, pass each subject internally to `resolveRockMemberProfile`, and print only attempted, resolved, and categorized failure counts. Do not persist the operator input or raw responses.
- **Test scenarios:**
  - The runbook preserves the no-email-fallback rule and Payload authorization separation.
  - The production contract check reports only aggregate success and failure categories.
- **Verification:** Full tests, lint, production build, and read-only contract verification pass without production mutation.

## Verification Contract

- `pnpm vitest run src/auth/rock-member-profile.test.ts src/auth/auth0-client.test.ts 'src/app/(frontend)/member-auth/complete/route.test.ts'` proves the focused authentication path.
- `pnpm test` proves repository regression coverage.
- `pnpm run lint` must report no new errors or warnings in changed files.
- `pnpm payload generate:importmap` followed by `pnpm build` must complete with valid non-production build environment values.
- A transient `tsx` evaluation using Railway's production environment injection must resolve each Auth0 username already linked to the operator-selected member through the existing Rock client and member resolver. Its output is limited to attempted, resolved, and categorized failure counts; it must not print the operator input, subjects, email, profile fields, or raw Rock responses.

## Definition of Done

- U1 and U2 satisfy their cited requirements and test scenarios.
- The resolver no longer queries or validates `ForeignKey`.
- Exact username, expected entity, exact-one cardinality, and linked-person validation remain fail-closed.
- The authentication runbook matches the deployed Rock record shape.
- Focused tests, full tests, lint, build, and read-only production contract checks pass.
- Review reports no unresolved actionable findings.
- No abandoned experiments, production-data writes, unrelated refactors, or generated artifacts remain in the diff.
