---
title: Verify the Payload database target before local browser testing
date: 2026-07-26
category: developer-experience
module: Payload CMS local development
problem_type: developer_experience
component: development_workflow
severity: high
applies_when:
  - "Starting the Next.js development server with a configured DATABASE_URL"
  - "Running browser acceptance against routes that initialize Payload CMS"
tags:
  - payload-cms
  - postgresql
  - browser-testing
  - database-safety
---

# Verify the Payload database target before local browser testing

## Context

The repository's `npm run dev` script starts Next.js, and rendering a Payload-backed route can initialize Payload's database adapter. During local sermon-page acceptance, Payload inspected the configured database and presented an interactive schema reconciliation prompt containing tables unrelated to this application. The run was stopped without accepting the prompt.

A reachable development route is therefore not enough evidence that the configured database is safe for local schema reconciliation.

## Guidance

Before starting browser acceptance:

1. Confirm that `DATABASE_URL` identifies the intended EV Church development database without printing or logging its credentials.
2. Prefer a disposable local PostgreSQL database for development and migration testing.
3. Treat any Payload create-or-rename schema prompt as a stop condition until the database identity and expected schema are independently confirmed.
4. Never accept a rename suggestion merely because Payload offers it; unrelated existing tables can produce plausible but destructive rename candidates.
5. Record browser acceptance as blocked by the environment when the safe database target cannot be established. A successful `npm run build` is still useful verification, but it is not a substitute for the blocked browser flow.

## Why This Matters

Payload's development-time schema inspection operates against the database named by the active environment. Pointing local development at the wrong PostgreSQL database can turn routine page loading into a destructive schema decision. Stopping at the prompt preserves the external database and keeps verification claims honest.

## When to Apply

- Before running `npm run dev` for any Payload-backed route.
- Before applying or rolling back files under `src/migrations/`.
- Whenever a schema prompt mentions unexpected tables, collections, or rename candidates.

## Examples

Safe response to an unexpected schema prompt:

```text
1. Do not select create or rename.
2. Stop the development server.
3. Verify the database target through the approved environment source.
4. Restart only with a confirmed development database.
```

The development entry point is defined in `package.json`; database migrations are registered through `src/migrations/index.ts`.

## Related

- [Missing Payload migration columns](../database-issues/missing-migration-column-not-found.md)
