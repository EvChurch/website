---
title: Preserve Rock required decline reasons in volunteer scheduling
date: 2026-08-16
category: integration-issues
module: member volunteer scheduling
problem_type: integration_issue
component: service_object
symptoms:
  - The stock Rock decline action can record a response without the reason required by the serving team configuration
  - Website declines can bypass Rock toolbox notifications and reason collection
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [rock-rms, volunteer-scheduling, decline-reasons, members-area]
---

# Preserve Rock required decline reasons in volunteer scheduling

## Problem

EV's Serving Team group type requires a reason when a volunteer declines. Rock's stock `ScheduledPersonDecline` REST action accepts only an attendance ID, so calling it from the website cannot preserve the configured reason requirement.

## Symptoms

- A volunteer can decline in the website without selecting one of Rock's decline reasons.
- The resulting attendance state does not match the native Schedule Toolbox flow.

## What Didn't Work

- Calling the stock decline action directly is incomplete because its public contract has no reason field.
- Treating Rock's Obsidian block action as an integration API is unsafe because it depends on the rendered block, page configuration, and Rock user context.
- A generic attendance patch would duplicate Rock scheduling behavior and can omit configured response communications.

## Solution

Keep accept and reconfirm on the server-only website route, where ownership and current state are checked before invoking Rock's purpose action. For decline, show the website confirmation dialog and hand off to Rock's existing `/ScheduleToolbox` page. Reject decline payloads at the website mutation route so an authenticated caller cannot bypass the required-reason rule.

The relevant boundaries are implemented in:

- `src/app/api/member-service/respond/route.ts`
- `src/components/members/VolunteerSchedule.tsx`
- `src/lib/members/volunteer-scheduling.ts`

## Why This Works

Rock remains responsible for collecting and validating the decline reason and for running its configured toolbox side effects. The website still provides direct accept and reconfirm actions without pretending the narrower public decline endpoint has parity with the native workflow.

## Prevention

- Before exposing a Rock purpose action, compare its public REST signature with the corresponding native block workflow and the live group-type configuration.
- Reject unsupported state transitions at the website API boundary, even when the UI does not currently send them.
- Keep a focused route test proving decline payloads are rejected.

## Related Issues

- The stock Rock purpose actions validate endpoint authorization but not attendance ownership, so website callers must resolve ownership and current state server-side before invoking them.
