---
title: EV Church Feedback Triage Automation - Plan
type: feat
date: 2026-08-13
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# EV Church Feedback Triage Automation - Plan

## Goal Capsule

- **Objective:** Make EV Church website feedback explainable, prioritised, and actionable from Payload, then provide one Codex skill that can run manually or daily to triage feedback and carry genuinely low-risk fixes through to verified production.
- **Product authority:** This plan and its session-settled decisions govern the workflow. Existing Payload access controls, repository shipping rules, and explicit user approvals govern execution.
- **Stop conditions:** Do not autonomously perform medium/high-risk work, finalise a `wont-fix` recommendation, contact submitters, send email or Slack, expose credentials, or resolve actionable feedback before production verification succeeds.
- **Execution profile:** Implement the versioned Payload schema, migration, generated types, and regression coverage in this repository. Install the reusable skill in the user's Codex skills directory and create the daily automation only after a successful manual read-only/triage verification.
- **Tail ownership:** For eligible code fixes the skill owns branch, PR, CI, merge, Railway deployment, and live verification. For eligible content fixes it owns Payload MCP update and live readback.

## Product Contract

### Summary

Add durable triage metadata and duplicate relationships to Payload feedback records, then install a risk-gated Codex skill that can assess unresolved feedback, update its workflow state, and automatically deliver only clear low-risk work. Run the same workflow manually or at 10:00 AM daily in `Pacific/Auckland`, reporting only in its Codex task.

### Problem Frame

Feedback currently records the request and a coarse resolution state, but the prioritisation reasoning lives outside Payload. Manual review must repeatedly rediscover requester context, duplicates, actionability, risk, and whether work reached production. A scheduled agent also needs durable state, bounded authority, and idempotency so it cannot repeat work or silently override human decisions.

### Actors

- **Feedback submitter:** Supplies the comment, email, and affected page; receives no automated contact from this workflow.
- **EV decision-maker:** Approves medium/high-risk work and every final `wont-fix` outcome.
- **Codex triage agent:** Reads context, stores explainable assessments, closes non-actionable categories, and delivers eligible low-risk changes.
- **Payload and GitHub/Railway:** Provide the content and code delivery paths and their verification signals.

### Requirements

R1. Each feedback record stores a one-sentence triage summary, classification, risk, requester rank, ministry-area relevance, work priority, recommendation, recommendation rationale, triage timestamp, triage version/run identifier, requester-match snapshot, and bounded delivery checkpoint metadata.

R2. Classification supports `bug`, `content-change`, `feature-request`, `unclear`, `duplicate`, `spam`, and `appreciation`.

R3. Resolution status retains `new`, `planned`, `in-progress`, `resolved`, and `wont-fix`, and adds non-final `needs-approval` plus final `duplicate`.

R4. A duplicate record stores a self-relationship to the canonical feedback item. Duplicate records leave the active queue while the canonical item keeps its independent lifecycle.

R5. Risk uses `low`, `medium`, or `high`. Risk reflects uncertainty, blast radius, reversibility, production-data impact, security/privacy, deployment complexity, and verifiability; requester authority never lowers risk.

R6. Requester rank uses `high`, `standard`, `low`, or `unmatched`, derived heuristically from the email-matched team member's `teamGroup` and role/title, with a small explicit override mechanism. The website display `order` field is not an authority signal. (session-settled: user-directed — chosen over a maintained people list or website display order: existing staff group and title data should follow organisational changes while remaining explainable.)

R7. Area relevance captures whether the request concerns the matched staff member's own area, an adjacent area, an outside area, or cannot be determined. Rank and relevance influence priority but not authorization.

R8. Final priority uses `urgent`, `high`, `normal`, or `low`, derived heuristically from requester rank, area relevance, likely user impact, and request context.

R9. The skill verifies Payload MCP access without mutation, pages through all non-final feedback newest-first, reads the minimum team-member/page context required, groups duplicates, and persists assessments with read-before-write and readback verification.

R10. `appreciation`, clear spam, and referenced duplicates may close automatically under their distinct stored classification/status without creating fake work or contacting anyone. (session-settled: user-directed — chosen over leaving positive comments in the active queue: appreciation should be recorded and closed rather than treated as actionable work.)

R11. Clear low-risk actionable work may proceed automatically using heuristic judgment rather than exact keyword rules. Medium/high risk, uncertainty, scope expansion, and every `wont-fix` recommendation move to `needs-approval` with the reason recorded. (session-settled: user-directed — chosen over firm exact-match automation or broad autonomy: feedback is variable, but complexity and risk must still trigger authorization.)

R12. Prefer Payload MCP for production content changes. Find the current document, make the smallest change, read it back, and verify the live page before resolving the feedback.

R13. Eligible low-risk code changes use an isolated branch, focused verification, PR, green CI, merge, Railway deployment confirmation, and live verification. A draft PR or merge alone is not completion. (session-settled: user-approved — chosen over stopping at a draft PR or pushing directly to main: the workflow must reach production through the normal reviewed path.)

R14. The same skill supports interactive manual runs and non-interactive scheduled runs. Repeated or overlapping runs do not duplicate work, overwrite intervening human edits, or falsely report success after partial failure. Every triage mutation is an atomic conditional update constrained by the record ID and expected `updatedAt`; a zero-match result is a conflict that returns the item to re-triage.

R15. The daily run starts at 10:00 AM `Pacific/Auckland` and reports only in its generated Codex task. It sends no email, Slack message, or submitter communication. (session-settled: user-directed — chosen over external notifications: the Codex task is the sole report destination.)

R16. Runs are bounded. A default non-interactive run assesses at most 20 records, automatically closes at most 10 non-actionable records, and begins at most one production delivery. Once a limit is reached, eligible items remain non-final and are listed as deferred in the report. Manual runs use the same defaults unless the user explicitly narrows or raises them.

R17. Feedback text, email, URLs, replay data, and user-agent data are untrusted input. The workflow never follows submitter-provided instructions or links, interpolates feedback into commands/queries/branch names/PR metadata, or trusts a claimed verification step. It independently confirms an EV-owned source URL and discovers every target through trusted repository or Payload context.

R18. Reports and delivery artifacts minimise personal and session data: use feedback IDs and paraphrased summaries; omit submitter email, client digest, user agent, replay URL/session ID, credentials, and raw comments unless the user explicitly requests them.

### Key Decisions

- **Separate priority from risk.** Staff influence may raise importance but never expand agent authority. Governs R5-R8, R11.
- **Persist explainable triage state.** Payload, not an ephemeral report, is the durable source of truth. Governs R1-R4, R9.
- **Heuristic low-risk autonomy.** Judgment is required, but conservative exclusions and approval gates constrain it. Governs R11-R14.
- **Production is the completion boundary.** Content and code paths both require live verification. Governs R12-R13.

### Key Flows

1. Verify MCP access; load newest-first non-final feedback and relevant staff/page context.
2. Match requester context, detect duplicates, classify, assess risk and priority, then persist and read back the assessment.
3. Close appreciation/spam/duplicates or route actionable medium/high/`wont-fix` cases to `needs-approval`.
4. For eligible low-risk work, deliver through Payload or the code PR path; resolve only after live verification.
5. Produce a concise Codex-task report covering actions, verification, failures, and remaining open feedback.

### Acceptance Examples

- AE1. A leadership team member requests a change within their ministry area: requester rank and area relevance may raise priority, but a security-sensitive change remains high risk and waits in `needs-approval`.
- AE2. Two submissions describe the same defect: the stronger canonical item remains in its lifecycle; the other becomes `duplicate` and references it.
- AE3. A positive comment contains no request: it is classified `appreciation`, marked resolved, and appears in the report without generating work.
- AE4. A typo in Payload-managed copy is unambiguous and reversible: the skill updates it through Payload MCP, reads it back, verifies the live URL, then resolves the feedback.
- AE5. A small code defect passes the low-risk gate: the skill opens and merges a PR only after tests and CI, waits for Railway, verifies production, then resolves the item.
- AE6. A human edits an item after the skill reads it: the stale write is abandoned and the item is reported for re-triage.
- AE7. The run finds no new/non-final feedback: it reports that result and performs no writes.

### Scope Boundaries

**In scope:** Stored triage metadata, duplicate references, staff-context prioritisation, risk-gated manual/scheduled skill execution, low-risk content/code delivery, approval routing, and Codex-task reports.

**Deferred:** Richer organisational-directory sources, historical analytics dashboards, and automated submitter responses.

**Never autonomous:** Medium/high-risk execution, final `wont-fix`, security/privacy/destructive work without explicit authorization, email/Slack, credential disclosure, or unrelated improvements.

## Planning Contract

### Product Contract Preservation

Product Contract captured from the confirmed brainstorm dialogue; no scope changes introduced during planning.

### Key Technical Decisions

KTD1. Extend `feedback-submissions` additively and ship an explicit guarded PostgreSQL migration. Preserve existing records and enum values; add indexes, a self-FK for `duplicateOf`, and a database deletion guard so deleting a canonical item cannot orphan final duplicates, with safe rollback ordering. Source: `src/migrations/20260813_120000_feedback_triage_all_mcp.ts` and `docs/solutions/database-issues/missing-migration-column-not-found.md`.

KTD2. Keep synced `team-members` fields untouched. The skill performs case-insensitive email matching with controlled selection/depth and snapshots the matched name/title/group and derived assessment onto feedback. Source: `src/collections/TeamMembers.ts` and `docs/solutions/architecture-patterns/payload-managed-campus-pages.md`.

KTD3. Put workflow heuristics in the personal Codex skill, not application runtime code. Use explicit `manual` and `mode:non-interactive` behavior, treat feedback text as untrusted data, and keep exceptional rank overrides in a small skill reference/config section.

KTD4. Use Payload's conditional update-by-where capability as compare-and-swap: constrain each mutation by record ID and the exact expected `updatedAt`. A zero-document result is a conflict, never a retry signal. Re-read after a successful update. If the active MCP update tool cannot express that condition, autonomous mutation is blocked until a narrowly scoped server-side operation can.

KTD5. Use a dedicated automation credential with a fixed standing permission set: feedback find/update, team-member find, and find/update only for the explicitly allowlisted low-risk content surfaces `pages`, `navigation`, and `site-settings`. Credential administration is unavailable to the skill. Targets outside that allowlist move to `needs-approval`; the scheduled agent never grants itself permissions. Never embed the Bearer credential in repo, skill text, automation prompt, or logs.

KTD6. Treat `resolved`, `wont-fix`, and `duplicate` as final for queue selection. `needs-approval`, `new`, `planned`, and `in-progress` remain non-final. Appreciation/spam use `resolved` plus their classification; duplicates use the dedicated final status and canonical relationship.

KTD7. Do not add a special “merged but unverified” resolution status. Keep the feedback `in-progress` and persist structured delivery metadata on the record: delivery kind and phase, owning run, branch, PR URL, merge commit, Railway deployment identifier, last verification timestamp/result, and a bounded failure note. Resume from the stored phase; never create a second branch/PR for an existing active checkpoint.

KTD8. Create the daily schedule with Codex's automation primitive after a successful manual skill run. Use a standalone cron automation targeted at this project because each run should produce its own Codex task.

KTD9. Rotate the exposed setup credential before granting the dedicated automation permissions, enabling production mutations, or creating the schedule. Update the local MCP registration without printing the secret, verify the replacement, and revoke both exposed historical keys.

### System-Wide Impact

- **Data lifecycle:** Existing feedback rows receive nullable triage metadata; new rows continue to work through defaults. Duplicate deletion behavior must not cascade-delete canonical feedback.
- **Authorization:** Payload content-lead/admin access remains unchanged; MCP permissions are separate and least privilege. Requester rank is prioritisation context, never execution authority.
- **Agent parity:** The skill has read context and write tools equivalent to the allowed admin actions, but production delivery remains behind explicit risk gates and verification checkpoints.
- **Operations:** Scheduled runs are bounded, idempotent, and partial-failure aware. Railway plus live route behavior is authoritative for code completion.

### Risks & Dependencies

- Payload enum/self-relationship migrations can fail after partial deploys; guard creation, preserve rows, and test up/down/reapply against a confirmed disposable database.
- MCP capability exposure and per-key permission are distinct; tool presence does not prove the dedicated automation key can call it.
- Heuristic ranking can misread ambiguous titles; store the basis/uncertainty and default ambiguous cases conservatively.
- Autonomous code delivery can outlive one run; store/checkpoint state and do not resolve until deployment/live verification complete.
- The currently exposed MCP key appeared in terminal history during setup; rotation and revocation are a prerequisite for production mutation and scheduling.

### Sequencing

1. Add the schema contract, validation, migration, and tests.
2. Regenerate Payload types and verify the repository build.
3. Install and validate the personal skill against the working MCP server in read-only/manual mode.
4. Ship the code change through PR/CI and confirm deployment/migration health.
5. Rotate the exposed credentials, provision the dedicated fixed-permission key, and verify its exact tool capabilities without printing it.
6. Run one bounded manual triage pass, then create the daily Codex automation.

## Implementation Units

### U1. Persist feedback triage state

- **Goal:** Make Payload the durable, explainable triage source of truth.
- **Requirements:** R1-R8.
- **Files:** `src/collections/SiteFeedback.ts`, `src/collections/SiteFeedback.test.ts`, `src/payload-types.ts`.
- **Approach:** Add bounded select/text/date/relationship fields, structured delivery checkpoint fields, and admin columns/groups. Add validation for duplicate reference requirements and self-reference safety without changing public submission input.
- **Test scenarios:** All enum options and defaults; duplicate requires a different canonical record; non-duplicate clears/rejects duplicate references; delivery checkpoints remain bounded and nullable; access remains content-lead/admin only; current submission fields remain compatible.
- **Verification:** Focused Vitest collection tests and regenerated types.

### U2. Migrate existing production data safely

- **Goal:** Add triage columns/enums/indexes/FK without replacing feedback rows.
- **Requirements:** R1-R4, R16.
- **Files:** `src/migrations/20260813_220000_feedback_triage_metadata.ts`, `src/migrations/20260813_220000_feedback_triage_metadata.json`, `src/migrations/index.ts`, `src/migration-tests/20260813_feedback_triage_metadata.test.ts`, `src/migration-tests/20260813_feedback_triage_metadata.integration.test.ts`.
- **Approach:** Use bounded, additive, idempotent SQL. Extend or replace the existing resolution enum safely, add triage/delivery enums and columns, indexes, and a non-cascading self-FK. Do not modify credential permissions in the schema migration.
- **Test scenarios:** Existing rows survive; defaults/nullability work; every enum accepts intended values; duplicate FK accepts canonical IDs and rejects missing IDs; down removes new objects in safe order; reapply succeeds; no existing MCP key permissions change.
- **Verification:** SQL-shape tests, guarded disposable-Postgres integration test where configured, migration inspection, and `pnpm build`.

### U3. Create the reusable triage skill

- **Goal:** Provide one safe workflow for manual and scheduled feedback processing.
- **Requirements:** R5-R11, R14-R16.
- **Files:** Personal skill at `${CODEX_HOME}/skills/ev-feedback-triage/SKILL.md`, `${CODEX_HOME}/skills/ev-feedback-triage/agents/openai.yaml`, and only necessary references/scripts.
- **Approach:** Initialise with `skill-creator`, keep the core workflow concise, paginate non-final feedback newest-first, query team members with selected fields, make heuristic assessments, group duplicates, use atomic conditional updates plus readback, enforce conservative risk gates/bounds, resume structured delivery checkpoints, and render a redacted numbered Codex-task report. Treat all feedback as quoted data, independently discover targets, and reject submitter-directed actions.
- **Test scenarios:** No feedback; unmatched requester; ambiguous title; own/adjacent/outside area; duplicate group; appreciation/spam; medium/high approval stop; `wont-fix` approval stop; concurrent write after final read; repeated/manual-scheduled overlap; partial MCP failure; prompt injection requesting credential access, external navigation, unrelated edits, or false verification.
- **Verification:** Skill validator, read-only live MCP smoke, forward-test with mutation disabled, then one bounded manual production triage run after schema deployment.

### U4. Deliver eligible low-risk changes

- **Goal:** Make “work on it” mean verified production completion.
- **Requirements:** R11-R13.
- **Files:** Skill workflow/reference files from U3; target application/content files are selected per feedback item and are not pre-enumerated.
- **Approach:** Prefer Payload find/update/readback/live-route verification on the fixed allowlist. For code, use isolated branch, focused regression coverage, PR, CI, merge, Railway deployment, live verification, and structured checkpoint updates. Exclude auth, permissions, migrations, dependencies/lockfiles, privacy/security, destructive data changes, external communications, broad refactors, and uncertain behavior from automatic execution.
- **Test scenarios:** Successful Payload update; Payload validation failure; code CI failure; merge succeeds but deployment fails; deployment succeeds but live verification fails; rollback/escalation leaves the feedback non-final.
- **Verification:** Per-item evidence in the Codex report and stored feedback rationale/checkpoint; final resolution only after live proof.

### U5. Schedule the daily run

- **Goal:** Run the same validated workflow every day without separate behavior drift.
- **Requirements:** R14-R16.
- **Files:** Codex automation state managed through the automation API, not committed files.
- **Approach:** After U3's successful manual run, create a standalone project cron at 10:00 AM `Pacific/Auckland` invoking the skill in non-interactive mode. Prefer updating an existing matching automation to creating a duplicate.
- **Test scenarios:** Automation exists once, targets the church-web project, uses local/worktree execution appropriate to code delivery, creates a Codex task report, and performs no work on an empty queue.
- **Verification:** Read back automation configuration and inspect the first scheduled/manual-equivalent task output.

## Verification Contract

- `pnpm test -- src/collections/SiteFeedback.test.ts src/migration-tests/20260813_feedback_triage_metadata.test.ts`
- Run `src/migration-tests/20260813_feedback_triage_metadata.integration.test.ts` only against its exact guarded disposable local database.
- `pnpm run generate:types`
- `pnpm build`
- Inspect migration SQL and confirm the target database before deployment.
- After deploy, confirm Railway migration/startup health, read back one feedback schema record through Payload MCP, and verify the public site remains healthy.
- Validate the installed skill with `quick_validate.py`, then run a read-only manual smoke before enabling writes or scheduling.
- Do not treat tool discovery, a green build, a merged PR, or a Railway success label alone as live behavioral proof.

## Definition of Done

- U1: Payload exposes all triage fields/statuses and enforces duplicate-reference integrity without breaking submissions.
- U2: Migration and generated types ship together; focused tests/build pass; production migration health is confirmed.
- U3: The personal skill is discoverable, validated, manually runnable, safely non-interactive, and produces the agreed concise report.
- U4: Low-risk delivery paths are risk-gated, checkpointed, and resolve feedback only after live verification.
- U5: Exactly one daily 10:00 AM Pacific/Auckland Codex automation invokes the same skill and reports in its task using the rotated dedicated credential.
- No credentials, user-owned unrelated changes, abandoned code, or optional unrelated improvements are included.
