---
title: "Missing database migration for new Payload CMS block field causes Railway deploy failure"
category: database-issues
date: 2026-03-31
tags:
  - payload-cms
  - postgresql
  - railway
  - migrations
  - schema-drift
  - deploy-failure
severity: high
component: "Payload block configs (HeroBlock, PageHeaderBlock), database migrations"
symptoms:
  - "Railway deployment fails during seed script execution"
  - "PostgreSQL error: column pages__blocks_hero.key_color does not exist"
  - "errorMissingColumn routine triggered on deploy"
  - "New block field added to Payload config but no corresponding migration committed"
---

# Missing Database Migration for New Payload CMS Block Field

## Problem Description

After adding a `keyColor` field to two Payload CMS block configs (`HeroBlock`, `PageHeaderBlock`) to support per-program accent colours, the Railway deployment failed at runtime. The build succeeded both locally and on Railway, but the application crashed when the seed script attempted to insert `keyColor` values because the corresponding PostgreSQL column `key_color` did not exist.

**Error:** `column pages__blocks_hero.key_color does not exist`

## Investigation Steps

1. Ran `npx next build` and `npx tsc --noEmit` locally -- both passed with no errors.
2. Checked Railway build logs via `railway logs --build` -- build phase completed successfully.
3. Checked Railway runtime logs via `railway logs` -- found the missing column error occurring during seed script execution, not during build.
4. Identified that Payload CMS requires an explicit database migration whenever new fields are added to collection or block configs.

## Root Cause Analysis

Payload CMS uses a code-first schema definition, but it does not automatically apply schema changes to the database. When a new field is added to a block config, Payload knows about it at the application level, but the PostgreSQL table has no corresponding column until a migration is explicitly created and run.

TypeScript compilation and Next.js builds validate only code-level types -- they have no visibility into the live database schema. This means a schema/database mismatch will always pass build checks and only surface at runtime when a query or insert touches the missing column.

## Working Solution

Generate the migration using the Payload CLI:

```bash
npx payload migrate:create add-key-color
```

This produced `src/migrations/20260331_190736_add_key_color.ts`:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero" ADD COLUMN "key_color" varchar;
    ALTER TABLE "pages_blocks_page_header" ADD COLUMN "key_color" varchar;
    ALTER TABLE "_pages_v_blocks_hero" ADD COLUMN "key_color" varchar;
    ALTER TABLE "_pages_v_blocks_page_header" ADD COLUMN "key_color" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_hero" DROP COLUMN "key_color";
    ALTER TABLE "pages_blocks_page_header" DROP COLUMN "key_color";
    ALTER TABLE "_pages_v_blocks_hero" DROP COLUMN "key_color";
    ALTER TABLE "_pages_v_blocks_page_header" DROP COLUMN "key_color";
  `)
}
```

Note that Payload generates migrations for both the live tables (`pages_blocks_*`) and the version history tables (`_pages_v_blocks_*`).

The migration file, its accompanying JSON snapshot, and the updated migrations index were committed and pushed together. Railway ran the migration on the next deploy, creating the columns before the seed script executed.

## The Three Files That Must Travel Together

Every `npx payload migrate:create [name]` produces exactly three artifacts. All three must be committed alongside the schema change:

1. `src/migrations/[timestamp]_[name].ts` -- the up/down SQL
2. `src/migrations/[timestamp]_[name].json` -- the Drizzle schema snapshot
3. `src/migrations/index.ts` -- updated to import and register the new migration

If any one of these is missing, the deploy will fail.

## Prevention Checklist

Run this whenever you touch a Payload collection, block, or global config:

**After writing the schema change:**
- [ ] Run `npx payload migrate:create [descriptive-name]`
- [ ] Confirm the `.ts` file contains the expected ALTER TABLE SQL -- read it, do not assume
- [ ] Confirm the `.json` snapshot was created alongside it
- [ ] Confirm `src/migrations/index.ts` was updated
- [ ] Run `npx payload migrate` locally to prove it applies cleanly

**At commit time:**
- [ ] `git diff --name-only` -- do you see all three migration files alongside the collection/block config change?
- [ ] If you see a Payload config change but no migration file, stop and create the migration before committing

## The One Rule

**The schema change commit and the migration commit should be the same commit.** Never push a Payload config change to main without its migration files present in the same diff.

## Cross-References

- [Phase 3: Payload Collections, Blocks, Globals](../integration-issues/phase3-payload-collections-blocks-globals.md) -- documents block config conventions but does not cover migrations
- [Phases 3-8: Full Build Completion](../integration-issues/phases3-8-full-build-completion.md) -- references Railway as deployment target but lacks migration guidance
