# ev.church Engineering Guide

## Default Workflow

Use Compound Engineering as the primary way of working in this repository.

- Start vague product or UX work with `$ce-brainstorm`.
- Turn agreed requirements into an implementation plan with `$ce-plan`.
- Execute an approved plan or a concrete build request with `$ce-work`.
- Investigate bugs and failing behavior with `$ce-debug`.
- Review meaningful changes with `$ce-code-review` before shipping.
- Simplify recently changed code with `$ce-simplify-code` when a cleanup pass is useful.
- Capture durable project learnings with `$ce-compound`.
- Commit, push, and open a PR with `$ce-commit-push-pr` only when explicitly asked.

Compound Engineering artifacts live under `docs/` by default. Reuse relevant
material in `docs/brainstorms/`, `docs/plans/`, and `docs/solutions/` instead of
starting from scratch. Keep plans and implementation aligned; if implementation
reveals a product decision that the plan did not settle, pause and resolve it.

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

## Styling

- Rich Red: `#E22A30`
- Brand Black: `#0F0004`
- Warm White: `#FEFAF4`
- Primary sans: Proxima Nova
- Secondary serif: Utopia
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
