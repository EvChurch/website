---
title: Daily Bible Readings - Plan
type: feat
date: 2026-08-11
topic: daily-bible-readings
artifact_contract: ce-unified-plan/v1
artifact_readiness: implemented
product_contract_source: user-review
execution: code
---

# Daily Bible Readings - Plan

## Goal

Turn the sent Daily Bible Reading communication in Rock into fresh weekday content that members can read, reflect on, pray through, and return to.

Rock owns the communication structure and reading metadata. API.Bible supplies the CSB passage text and required FUMS delivery metadata. The website owns presentation, member navigation, device-local progress, completion history, and streak calculations.

## Settled Product Decisions

These decisions supersede the earlier concept and reflect the final browser review:

- The complete reading experience lives under `/members/daily-readings` and requires the existing member sign-in.
- The public homepage may promote the latest reading, but its action enters the Members experience.
- The guided flow has three visible stages: Read, Reflect, and Pray. Completion remains as the final state but is not shown as another progress stage.
- There is no Arrive stage.
- All reflection questions appear together on one page. All prayer prompts appear together on one page.
- Progress is saved on the current device. It records the active stage, completed readings, the current reading streak, and weeks in a row.
- A week counts toward the weekly streak when at least one reading in that Monday-to-Sunday week is complete.
- The archive is a compact Weekbook showing the current week and three earlier weeks.
- The expected publication pattern is Monday to Friday. The archive uses five weekday positions and does not show unavailable placeholders.
- The latest reading is included in the current Weekbook week as well as being featured above it.
- The completion state includes a permanent image, contained confetti, a brief biblical encouragement, Read again, and View your progress actions.

## Requirements

### Import and content

1. Discover Daily Bible Reading communications using the durable Rock list identity, confirmed send timestamp, and normalized subject classification.
2. Ignore draft, scheduled-but-unsent, unrelated, malformed, and duplicate communications.
3. Preserve the Rock identity, sent instant, fixed Auckland source date, opening Scripture line, passage reference, ordered questions, and ordered prayer prompts.
4. Fetch CSB passage text from API.Bible rather than copying Bible text from the email.
5. Store the API.Bible version identity, passage identity, copyright, FUMS token, and fetch timestamp.
6. Keep Rock-derived fields immutable after creation. API.Bible delivery fields may refresh when the provider cache expires.
7. Complete API.Bible reads before opening the database transaction, keep provider calls sequential, and quarantine individual passage failures.
8. A failed or empty import must not delete or partially publish reading history.
9. Register the importer in the recurring Rock sync runner and retain the explicit one-off worker entrypoint.

### Access and presentation

10. Only published readings are externally readable through Payload; Payload editorial roles may review unpublished records.
11. Member routes must redirect signed-out visitors to the existing Auth0 login and return them to the requested reading.
12. Render imported content as plain text. Verse numbers are superscript, and no email HTML is exposed.
13. Load API.Bible’s FUMS script only when a reading contains a token and report each supplied token when the Read stage is viewed.
14. Use the CSB abbreviation and copyright on one compact attribution line.
15. Keep the member header, navigation, mobile behavior, focus movement, and contrast consistent with the existing Members experience.

### Progress and archive

16. Save exact device-local position by reading identity and retain completion when a completed reading is opened again.
17. The current reading streak is the contiguous completed suffix of the published reading sequence.
18. The weekly streak counts consecutive weeks with at least one completed reading and remains alive while the current week is still in progress.
19. The Weekbook orders readings Monday through Friday, shows completion/in-progress state, and links every displayed reading by stable Rock identity.
20. The home and Members overview CTAs use Start, Resume, or Read again according to available device progress.

## Architecture

### Data boundaries

- `daily-bible-readings` is a Payload collection of Rock reading snapshots plus refreshable API.Bible delivery fields.
- Public collection access is constrained to `isPublished = true`; writes are denied through request-scoped collection access.
- The importer uses trusted Payload Local API operations inside one transaction.
- Reading pages query Payload only. They do not call Rock or API.Bible during a member request.
- Device-local progress contains reading IDs, stage positions, completion flags, and timestamps; it contains no answers, notes, or prayer text.

### Routes

- `/members/daily-readings` — featured current reading, streaks, and four-week Weekbook.
- `/members/daily-readings/[readingId]` — Read, Reflect, Pray, and completion flow.
- `/daily-readings` and `/daily-readings/[readingId]` — compatibility redirects into Members.
- Members overview — Daily Reading block linking to the hub.
- Public home block — latest reading promotion linking into Members.

### Sync sequence

1. Fetch the complete eligible Rock candidate set.
2. Parse and validate each communication.
3. Query existing Rock identities from Payload.
4. Fetch missing or expired CSB passage delivery data from API.Bible.
5. Open a transaction.
6. Insert new Rock snapshots or refresh only API.Bible delivery fields.
7. Commit and return the standard sync result; roll back the complete write batch on a database failure.

## Verification

### Automated

- Parser fixtures cover the observed Rock email structure and malformed candidates.
- API.Bible tests cover reference conversion, response validation, multi-passage handling, timeouts, and FUMS token splitting.
- Importer tests cover idempotent creation, partial provider failure, legacy CSB replacement, cache refresh, empty Rock results, and transaction rollback behavior.
- Progress tests cover the combined three-stage flow, exact resume fallback, retained completion, daily streaks, weekly streaks, and four-week grouping.
- Route tests cover signed-out redirects and signed-in member rendering.
- Collection access tests prove public reads are published-only and editorial roles can review unpublished content.
- Full repository tests, lint, migration tests, generated Payload types, and the production Next.js build pass before merge.

### Browser

- Verify desktop and mobile Members hub layouts using real imported data.
- Verify Start, Resume, Next, Previous, completion, Read again, and Weekbook navigation.
- Verify superscript verse numbers, compact CSB attribution, the permanent completion image, contained confetti, and keyboard focus behavior.
- Verify compatibility redirects and the Members overview entry point.

### Deployment

- Confirm `API_BIBLE_KEY` is configured in the production web and sync environments without exposing its value.
- Apply the three additive migrations before relying on the new collection or home block.
- Verify exactly one home Daily Reading block exists in the live page and latest saved version, positioned immediately after Your Next Step.
- Run the importer and confirm at least one published reading with CSB provider metadata is present.
- Confirm the recurring Rock sync includes `daily-bible-readings` and completes without a new error.
- Verify the production Members hub and one reading route after deployment.

Read-only post-deploy checks for the home block:

```sql
SELECT _parent_id, COUNT(*)
FROM pages_blocks_daily_reading
WHERE id = 'daily-reading-home'
GROUP BY _parent_id;

SELECT _parent_id, COUNT(*)
FROM _pages_v_blocks_daily_reading
WHERE _uuid = 'daily-reading-home'
GROUP BY _parent_id;
```

The rollback path is Payload’s migration down sequence followed by a fresh import if the reading tables were removed. Do not roll back the home-block migration after editors have independently changed block ordering without first preserving those edits.
