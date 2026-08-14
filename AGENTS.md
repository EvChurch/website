# ev.church Engineering Guide

## Default Workflow

Optimize for the shortest safe path from the user's request to production. Do
the minimum work needed to make the requested change correct, verify it, and
ship it. Do not add process, documentation, refactors, tests, or polish that are
not needed for that outcome.

- For a clear request, inspect the relevant code, implement the smallest scoped
  change, and run the narrowest credible verification. Do not create a plan or
  ask for approval merely because a task has multiple steps.
- Use existing repository patterns and preserve unrelated behavior. Do not
  broaden the task into adjacent cleanup or architectural work.
- Diagnose enough to identify the cause before fixing a bug, but keep the
  investigation proportional to the failure.
- Add or update tests when they protect changed behavior or a likely regression.
  Do not add tests solely to satisfy a workflow ritual.
- Run focused checks while iterating. Run `pnpm build` when the change can affect
  production compilation, generated Payload types, or integration behavior.
- Treat review effort as risk-based. Perform a focused self-review of the diff;
  use a separate comprehensive review only for high-risk changes such as auth,
  payments, permissions, migrations, production data, or broad cross-cutting
  changes, or when the user explicitly requests it.
- Do not create brainstorms, plans, solution notes, handoffs, or other process
  artifacts unless the user asks for them or unresolved decisions make them
  necessary to implement safely.
- Use Compound Engineering skills selectively when they materially shorten or
  de-risk the work. They are tools, not mandatory stages: `$ce-debug` for a
  genuinely open-ended bug, `$ce-plan` for unresolved or large-scope work, and
  `$ce-code-review` for high-risk review. A concrete build request may be
  implemented directly.
- Commit, push, open a PR, deploy, or mutate production only when the user's
  request authorizes that action. When asked to ship, continue through the
  requested delivery steps without adding optional gates.

If implementation exposes a product decision that materially changes scope or
user-visible behavior, pause and ask. Otherwise make reasonable, reversible
assumptions and keep moving.

## Tech Stack

- Framework: Next.js 16 App Router with embedded Payload CMS 3
- Database: PostgreSQL via `@payloadcms/db-postgres`
- Rich text: Lexical via `@payloadcms/richtext-lexical`
- Storage: S3-compatible storage via `@payloadcms/storage-s3`
- Styling: Tailwind CSS 4
- Language: TypeScript in strict mode
- Package manager: pnpm with `pnpm-lock.yaml`
- Runtime: Node.js 22 or newer

## Common Commands

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run generate:types
```

Use `pnpm build` as the primary repository verification because it regenerates
Payload types before building Next.js. Run narrower checks while iterating when
they are sufficient, then run the build for changes that can affect production.

## TypeScript

- `strict: true` is non-negotiable.
- Use Payload's generated types from `src/payload-types.ts`; regenerate them
  rather than editing the generated file.
- Type access functions with `Access` from `payload`.
- Use `satisfies` for exhaustiveness checks, including block renderer maps.
- Define explicit interfaces for external API responses. Do not use `any`.

## Next.js Patterns

- Treat `params` and `searchParams` as promises and always await them.
- Put `'use client'` only on interactive leaf components.
- Keep page-level and data-fetching components as Server Components.
- Use controlled Payload Local API depth (`depth: 0` or `depth: 1`).
- Use `select` to return only fields the caller needs.
- Use `unstable_cache` with `revalidateTag` for ISR caching.

## Payload Conventions

- Collection slugs are kebab-case plurals, such as `team-members`.
- Block slugs are camelCase, such as `cardGrid` and `cta`.
- Set `interfaceName` on every block for predictable generated types.
- Synced Rock RMS collections are read-only for non-admin users.
- Treat database migrations and sync jobs as production-data changes. Confirm
  the target database before running them and preserve idempotency where possible.

## Payload Content Changes

- Use the production Payload MCP server for content changes to collections and
  globals that it exposes. Find the current document first, update it through
  MCP, then read it back to verify the saved result.
- The initial MCP surface exposes `pages`. Do not assume other collections or
  globals are available; inspect the MCP tools before acting.
- Do not edit `src/seed/` to change existing production content, and do not run
  `pnpm seed` against production. Seed files are bootstrap fixtures for explicit
  local or new-environment setup only.
- Use a migration for structural schema changes or a reviewed, one-off data
  migration when MCP cannot express the required production change. Confirm the
  target database before any production data mutation.

## Styling

- Rich Red: `#E22A30`
- Brand Black: `#0F0004`
- Warm White: `#FEFAF4`
- Primary sans: Albert Sans
- Secondary serif: Source Serif 4
- Container maximum: 80rem / 1280px
- Prefer Tailwind utilities; reserve custom CSS for design tokens and cases that
  utilities cannot express clearly.

## Project Structure

- `src/collections/`: Payload collection configuration
- `src/blocks/`: Payload block definitions
- `src/components/`: React components grouped by purpose
- `src/access/`: reusable access-control helpers
- `src/hooks/`: Payload hooks
- `src/lib/`: clients and shared utilities
- `src/sync/`: Rock RMS synchronization
- `src/pipeline/`: sermon content-processing pipeline
- `src/globals/`: Payload global configuration

## AI Provider Boundary

The Anthropic SDK in `src/pipeline/boundary-detector.ts` is an application
runtime dependency used for sermon processing. It is not Claude development
tooling. Do not remove or replace it as part of Codex environment maintenance;
changing that provider requires a separate product and implementation decision.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
