# Courses UI reference

One selected design for the approved Courses implementation. Throwaway mockup only; do not ship it as production code.

Open `courses-prototype.html` directly in a browser. No server, package install, external requests, storage, or real email is used. Albert Sans is embedded; its redistribution license is included in `Albert-Sans-OFL.txt`. Sample people, emails, responses, and completed course are fictional. Faithful with Money is the first course example, not an architectural template.

Use the dark **UI PROTOTYPE** panel to switch screens, Solo/Group, and saved/empty/saving/error/newer-answer states. The panel is reference tooling, not product UI, and is hidden in screenshots.

## Ticket references

| Approved slice | Screens | Behaviours fixed by the mockup |
| --- | --- | --- |
| 1. Take a course solo | `#courses`, `#overview`, `#lesson` | In progress / Completed / Available sections; single next action per course; Solo or Group selection; lesson navigation; Mark lesson complete. |
| 2. Save course answers | `#lesson` | Personal and Shared badges before fields; subtle Saved status; no Submit; revealable guidance; one group answer or separate shared individual answers; saving, error, and stale-save states. |
| 3. Take a course with a group | `#overview`, `#group`, `#lesson` | Create a group; invite by email; facilitator sees progress but no personal answers; new members can read existing shared answers; no pair features. |
| 4. Complete a budget exercise | `#budget` | Weekly pay, five fixed category blocks, editable/repeating rows, computed totals and remainder; same autosave pattern. |
| 5. Launch Faithful with Money | All screens | Concise copy, three lessons, established portal styling, responsive layouts; course overview can be linked from generosity page. |

## Visual decisions

- Existing warm-white portal background, black site header, horizontal member navigation, red active marker.
- Albert Sans UI; serif is limited to teaching passages and Bible reading prompts.
- Simple course rows rather than image-heavy catalog cards; no decorative stock imagery.
- Lesson rail on desktop becomes a horizontally scrollable lesson list on mobile.
- One primary action at the bottom of a lesson. Shared forms have no publish/submit workflow.
- Audience is a short badge. In Solo mode all answer badges become personal.
- Budget screenshot demonstrates an author-configured Personal exercise even in Group mode; numeric values must not become group-visible by default.
- Group names are short human-readable labels; group membership is independent of Connect Groups.
- Portal chrome does not imply a Rock profile requirement. Any registered, signed-in website account must be able to enrol; existing navigation links grant no additional access.

## States and screenshot index

Each of `courses`, `overview`, `lesson`, `group`, and `budget` has `-desktop.png` (1280px wide) and `-mobile.png` (390px wide).

Additional desktop screenshots:

- `courses-empty-desktop.png`: no enrolled or completed attempts.
- `lesson-saving-desktop.png`: autosave in progress.
- `lesson-error-desktop.png`: retained input with Retry.
- `lesson-stale-desktop.png`: newer saved answer with retained local changes and explicit resolution.

`capture.cjs` is optional machine-local QA tooling. It uses the existing Playwright install from a neighbouring repository and `/usr/bin/google-chrome`; it is not an application dependency. Run `node .scratch/courses-design/capture.cjs` from the website checkout to recapture on this computer.

Checked all screen sizes for horizontal overflow, runtime errors, and external HTTP requests. Exercised autosave, invite simulation, stale-answer resolution, and budget totals. All passed. Representative desktop and mobile screenshots were visually inspected.

## Production boundaries

The mockup keeps state only in memory. Its invite action adds a fake pending row without sending mail, and its completion buttons show navigation rather than performing durable enrolment changes. Use the approved requirements for permission enforcement, versions, durable saving, enrolment lifecycle, and destructive-action confirmations. Rebuild using existing website components and patterns.
