---
title: Rock volunteer scheduling read contract
date: 2026-08-15
status: shared-credential-approved
---

# Rock volunteer scheduling read contract

This records the sanitized production evidence for the My Service scheduling
adapter. It contains no person identifiers, Attendance GUIDs, names, API keys,
or raw Rock responses.

## Verified provider contract

- The EV instance reports `Rock v19.2.0.0`.
- `https://rock.ev.church/ScheduleToolbox` is the fixed native destination. An
  authenticated request resolves to the Schedule Toolbox and retains the same
  represented person as the signed-in EV Church member session.
- A populated native toolbox displayed the pending assignment and Rock-owned
  **Accept** and **Decline** controls. No response was submitted during
  verification.
- Rock v19.2 does not expose `Occurrence`, `Group`, `Schedule`, or `Location`
  navigation properties through the generic REST queries used here. The
  adapter therefore reads these allowlisted endpoints separately:
  `PersonAlias`, `Attendances`, `AttendanceOccurrences`, `Groups`, `Schedules`,
  and `Locations`.
- `Attendance.StartDateTime` and `AttendanceOccurrence.OccurrenceDate` are
  returned as naive Rock-local date/time strings. The adapter interprets them
  in `Pacific/Auckland` and emits canonical instants.
- `AttendanceOccurrence.DidNotOccur` can be `null`; only explicit `true` means
  the occurrence did not happen.
- The installed OData node-count limit rejects large OR expressions. The
  adapter bounds ID filters to eight values and bounds all pagination.

An authorized read-only smoke using the exact adapter returned:

- an available populated projection with Requests and Upcoming entries;
- only the application fields `id`, `title`, `occurrenceStart`, `scheduleName`,
  and `locationName`;
- the fixed native toolbox URL; and
- an available empty projection for a valid person with no future assignments.

The deployed shapes are represented in
`src/lib/members/volunteer-scheduling.test.ts`.

## Approved credential boundary

The product owner approved using the website's existing server-only
`ROCK_API_URL` and `ROCK_API_KEY` configuration for these reads. The adapter
still exposes only bounded GET operations, never returns the credential to the
browser, and provides no scheduling mutation operation or route.

This approval replaces the earlier dedicated-key rollout requirement. It does
not prove that the shared Rock credential itself is least privilege; that is an
accepted operational exception. The populated and empty adapter probes already
succeeded with this credential and the fixed toolbox destination.

Member notifications require no separate environment switch. Deploy and
complete signed-in desktop, mobile, keyboard, unavailable, and
canonical-return browser checks as part of the normal website rollout.
