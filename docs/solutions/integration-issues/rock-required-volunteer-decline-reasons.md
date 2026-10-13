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

Ev's Serving Team group type requires a reason when a volunteer declines. Rock's stock `ScheduledPersonDecline` REST action accepts only an attendance ID, so calling it from the website cannot preserve the configured reason requirement.

## Symptoms

- A volunteer can decline in the website without selecting one of Rock's decline reasons.
- The resulting attendance state does not match the native Schedule Toolbox flow.

## What Didn't Work

- Calling the stock decline action directly is incomplete because its public contract has no reason field.
- Treating Rock's Obsidian block action as an integration API is unsafe because it depends on the rendered block, page configuration, and Rock user context.
- Calling the reasonless purpose action and then patching the reason would create two partial saves and trigger workflows against incomplete state.

## Solution

Keep accept and reconfirm on the server-only website route, where ownership and current state are checked before invoking Rock's purpose action. For decline, load the active values from Rock's `Group Schedule Decline Reason` defined type, require one in the website modal, revalidate it server-side, and use Rock's stock generic Attendance PATCH endpoint to save the RSVP state and reason together.

The relevant boundaries are implemented in:

- `src/app/api/member-service/respond/route.ts`
- `src/components/members/VolunteerSchedule.tsx`
- `src/lib/members/volunteer-scheduling.ts`

## Why This Works

The member never has to enter Rock. The website uses only supported stock Rock API surfaces, rejects inactive or invented reason IDs, and persists the decline fields in one Rock save so the attendance save hook sees a complete declined state.

## Prevention

- Before exposing a Rock purpose action, compare its public REST signature with the corresponding native block workflow and the live group-type configuration.
- Validate reason IDs against the active Rock defined values at mutation time rather than trusting the browser.
- Keep focused tests proving a reason is required and written in the same PATCH as the RSVP state.

## Related Issues

- The stock Rock purpose actions validate endpoint authorization but not attendance ownership, so website callers must resolve ownership and current state server-side before invoking them.
