---
title: Treat Rock communication-list membership as subscription state
date: 2026-08-21
category: integration-issues
module: Daily Bible Reading email signup
problem_type: integration_contract
component: authenticated_member_action
severity: high
applies_when:
  - A Rock workflow adds a person tag that later syncs into a communication list
  - A signed-in member can subscribe or resubscribe without entering their identity again
  - Unsubscribing leaves the source tag attached to the person
tags: [rock-rms, communication-list, member-authentication, email, idempotency]
---

# Treat Rock communication-list membership as subscription state

## Context

The Daily Bible Reading workflow adds Rock person tag `134`. A six-hour Rock sync uses that tag to populate communication list group `28916`. Unsubscribing does not remove the tag: it changes the existing group membership from active to inactive.

The tag therefore means “has entered the signup path,” not “is currently subscribed.” Hiding a signup control whenever the tag exists prevents an unsubscribed person from rejoining.

## Guidance

For a signed-in member, derive the Rock person ID only from the verified Auth0 session. Query the communication-list membership first:

- An active membership is subscribed.
- An inactive membership is unsubscribed, even when the person still has the tag.
- No membership plus the tag is a new signup waiting for the scheduled list sync.
- No membership and no tag is eligible for signup.

Make signup idempotent. Active members need no write. For inactive and new members, invoke Rock's existing `Communication List Subscribe` block action and read the membership back before reporting success. This preserves Rock's built-in subscription behavior, including reactivation and the communication preference, without requiring generic entity-write permission or duplicating its rules in the website.

Authenticated one-click routes must reject cross-origin requests, accept no person identifier from the browser, return private no-store responses, and expose only generic provider errors. If the read-only status check fails, show the signup control rather than hiding it incorrectly.

## Verification

Cover active, inactive, pending-tag, and new-person states with mocked Rock responses. Verify that duplicate requests perform no writes, activation is read back, and the API always uses the session person ID.
