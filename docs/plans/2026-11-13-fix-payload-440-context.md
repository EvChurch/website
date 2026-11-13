---
title: Repair grouped Payload dependency context regression
type: fix
status: in_progress
date: 2026-11-13
---

PR #440 installs Payload plugins and Next providers at 3.93.0 while the application's core and UI remain at 3.91.0. The existing installed-context regression check fails. Align the complete Payload train to the candidate's exact 3.93.0, whose published UI/Next peers require core 3.93.0. Preserve every other intended grouped update and current-main security control.

Upstream v3.93.0 still lacks the non-Mongoose queue update/commit failure rollback. Port the existing version-bound patch without changing its semantics; preserve the installed-helper transaction tests and extend coverage to commit failure. Primary publisher advisories show Payload 3.93.0 pins affected Undici 7.30.1. Override only `payload>undici` to the fixed same-major 7.30.2; leave the independent jsdom candidate untouched. Verify its installed caller using synthetic HTTP/security probes. Regenerate the pnpm lock without unrelated upgrades, and inspect both lock documents and all changed package/peer edges.

Acceptance: reproduce then pass the actual Next-provider/application-consumer context check; pass queue, synthetic affected-caller, format/lint/type and existing full test gates with at most two workers; build the app and Rock worker images through the shared validation slot, start the real app against a disposable synthetic database, and verify Node 24.22.3, TLS controls, health, image serving and docs assets. Review primary release/advisory material and the final diff. Record existing residual advisories separately. Publish through a normal fast-forward PR update when exclusive and authorized; otherwise a scoped repair PR. Use draft if any required validation remains incomplete. Never merge or deploy from this checkout.

Evidence lives outside source under the batch032 website440-repair directory. No live providers, source credentials or real donor data are used.
