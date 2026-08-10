---
title: Member video completion must preserve resume progress
date: 2026-08-11
category: logic-errors
module: member media playback
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - Short Connect Group resource videos restarted from the beginning after leaving and returning.
  - A member video could be marked complete while most of it remained unwatched.
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [member-media, video-progress, resume, zustand]
---

# Member video completion must preserve resume progress

## Problem

The shared listening store used a sermon-oriented completion shortcut for every media item. A video was complete at 95 percent or when five minutes remained, which makes the second condition immediately true for any video five minutes or shorter.

## Symptoms

- A short member video was marked complete on its first progress save.
- Resume then started at zero because completed records are deliberately excluded from resume selection in `src/components/media/MediaPlayerProvider.tsx:465-480`.

## What Didn't Work

- Persisting the current time alone did not restore playback. The saved record was already marked complete, so the provider correctly declined to use it.
- Reusing the public-sermon five-minute allowance for member resources did not fit short weekly videos.

## Solution

Keep the existing 95 percent threshold for all media, but apply the five-minute allowance only to public sermons. The completion policy is defined in `src/lib/listening-store.ts:137-140`:

```ts
completed: previousCompleted || (duration > 0 && (
  currentTime / duration >= 0.95 ||
  (sermon.access !== 'members' && duration - currentTime <= 300)
))
```

Member videos now remain resumable until they reach 95 percent. Public sermons retain the existing long-form convenience rule.

## Why This Works

Resume requires a matching, incomplete progress record. Separating the completion policy by access type preserves that invariant for short member videos without changing established public sermon behavior.

## Prevention

- Test completion with a four-minute member video near the start and at 95 percent.
- Test public media separately so changes to member media do not silently alter sermon completion semantics. The focused regression cases are in `src/lib/listening-store.test.ts:75-102`.

## Related Issues

- Member resource playback also needs provider-level coverage to prove saved progress reaches the video player's resume position.
