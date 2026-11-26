# Faithful with Money

`faithful-with-money.ts` is initial CMS authoring data, adapted from Rowan's original HTML attachment. It contains three lessons in the original evening order, six talks, Bible studies with optional guidance, personal money-story and giving questions, homework checklists, a personal weekly budget, and help. Runtime pages read CMS content, not this file.

Reviewed source: `faithful-with-money.html`, SHA-256 `00c070c3757c26b1d79bccde829d8da1e98a15bf8bed373247cc9f331898f638`. Only literal teaching data was extracted; attachment scripts were not executed or imported.

All questions are optional. Money figures and reflections are Personal; Bible discussion questions can be Shared. Every response has its normal visible audience badge. Solo answers remain personal. Original browser-only privacy claims and one-screen instructions have been replaced with account saving and explicit audiences. Tax-credit wording is qualified against Inland Revenue guidance; links and verified help contacts are in the course.

## Local review

From this worktree with its isolated `.env.local`:

```sh
pnpm exec tsx scripts/import-faithful-course.ts --local
```

This creates a **draft** only in `ev_courses_dev` on localhost or the local Unix socket. It checks the configured target and connected database before loading Payload. Repeating the command preserves existing content, including human edits. It never publishes or resets data.

Sign into the local CMS as an editor. Open Courses → Faithful with Money → Preview, review all three lessons and audiences, then publish locally for QA. Publishing creates the enrolment edition. The public calculator invitation appears only when the course is published, open and has an edition. Close enrolment to remove it. Existing learners keep their course.

## Reviewed CMS authoring

Export a tool-ready Payload `courses` data object without connecting to any database:

```sh
pnpm exec tsx scripts/import-faithful-course.ts --export /tmp/faithful-with-money-course.json
```

For eventual production authoring, use the authorised CMS/MCP workflow: find the slug first, create a draft only if absent, read it back, then review the staff preview. If it already exists, compare proposed edits with current content; never replace human edits automatically. Publish only after that review. There is intentionally no production CLI import.

The calculator passes no figures into the course. Account registration/sign-in preserves the intended course destination. Local QA uses synthetic accounts; real Auth0 and real invitation delivery still need environment verification.
