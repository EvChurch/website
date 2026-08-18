---
title: Keep custom Next routes outside Payload collection API namespaces
date: 2026-08-19
category: integration-issues
module: Payload CMS and Next.js API routing
problem_type: integration_issue
component: payload
symptoms:
  - Payload admin updates return Method Not Allowed for an otherwise editable collection record
  - A custom form proxy and a Payload collection share the same API path prefix
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [payload-cms, nextjs, api-routes, route-collision, rock-forms]
---

# Keep custom Next routes outside Payload collection API namespaces

## Problem

The `rock-forms` Payload collection and a custom dynamic Next route both used the `/api/rock-forms/*` namespace. Saving record `1` in the Payload admin sent `PATCH /api/rock-forms/1`, but Next matched the custom workflow proxy instead of Payload's REST handler and returned Method Not Allowed.

## Symptoms

- Reading the collection in Payload admin worked, but saving an edit returned Method Not Allowed.
- The dynamic segment accepted either a Rock workflow GUID or a numeric Payload document ID, so URL shape alone could not disambiguate the two handlers.

## What Didn't Work

- Changing Payload access rules did not address the failure because the request never reached Payload's collection handler.
- Treating the custom dynamic parameter as a GUID was insufficient; route matching happens before the handler validates that value.

## Solution

Reserve `/api/<collection-slug>` for Payload and give the custom Rock proxy its own namespace. The form client now fetches from `/api/rock-entry-forms/<workflow-guid>`, implemented under `src/app/api/rock-entry-forms/[workflowTypeGuid]/`, while the collection remains registered with the `rock-forms` slug in `src/collections/RockForms.ts`.

Update every in-repo caller and route test as part of the rename. Verify both sides independently: save a real collection record through Payload admin, and run the custom route tests plus a production build so the route manifest contains both `/api/[...slug]` and `/api/rock-entry-forms/[workflowTypeGuid]`.

## Why This Works

Next no longer has two route owners for the same path shape. Payload's catch-all API route exclusively handles `/api/rock-forms/*`, while the explicit Next route handles only `/api/rock-entry-forms/*`.

## Prevention

- Treat every Payload collection slug as a reserved `/api/<slug>` namespace.
- Before adding an explicit route below `src/app/api/`, compare its prefix with the collection slugs registered in `payload.config.ts`.
- For a new collection plus custom integration route, test one real admin create or update in addition to handler-level tests.

## Related Issues

- [A Payload collection does not connect its public route](../logic-errors/payload-collection-does-not-connect-public-route.md)
- [Missing database migration for new Payload CMS block field causes Railway deploy failure](../database-issues/missing-migration-column-not-found.md)
