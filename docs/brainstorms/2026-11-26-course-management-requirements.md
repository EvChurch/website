# Course management requirements

Requirements approved for ticketing and supervised implementation. Keep the interface and implementation simple.

## Agreed direction

- Keep the system and its interface simple. Use short labels, minimal explanatory copy, and only the controls needed for the current task. Add settings and special cases only when a concrete requirement needs them. Design discussions should also be concise.
- Build a basic course system within the existing website, using its structure and conventions. Rowan's Faithful with Money content is the first content example; its supplied HTML does not determine architecture or code choices.
- Courses combine teaching content, questions, and exercises that collect information.
- Course authors configure available participation modes: solo or group. Participants choose a mode when beginning and invite others by email.
- There are only two participation modes: Solo and Group. Two people taking a course together form a group using the same invitations, permissions, and management rules as any other group. There is no separate pair concept.
- Anyone can register for a website account and enrol in the course. Formal church membership and an invitation are not required. The public generosity page provides an entry point, with sign-in or registration when enrolling.
- Invitees sign in or register to join the course they were invited to.
- Use the name "Courses" without a separate course brand.
- The member portal includes a Courses page showing courses the signed-in person is participating in, courses they have completed, and courses available to join. The public generosity page is one entry point alongside the portal and invitations.
- Question authors choose Personal or Shared visibility. Shared questions collect either one group answer or separate individual answers visible to the group. All answers remain private in Solo mode. The audience is shown before participants enter an answer. Joining a group does not automatically expose existing personal responses.
- Responses, including reflections and financial figures, are saved to participants' accounts and available on any device after signing in. Shared responses are available to the configured audience.
- Course groups are independent of Connect Groups and do not require Connect Group membership.
- Participants maintain individual progress; a facilitator coordinates shared sessions without locking everyone to the same step.
- The person starting a course group becomes its facilitator and manages invitations and removal. Participants can leave voluntarily.
- New joiners can read existing group answers; this is explained before participants share. Leaving or removal ends access to the shared workbook, while personal answers remain with the individual.
- Participants explicitly mark lessons complete. Authors can require particular exercises, but personal reflection questions are optional by default. Completing all required lessons completes the course.
- Completing a required exercise with one group answer satisfies that exercise for everyone in the group. Each participant still marks their own lesson complete.
- Facilitators can see participants' not-started, in-progress, or completed status and completed lessons. Personal answers remain private, and there is no last-active tracking.
- Routine course administration permits managing content, enrolments, and completion without access to private responses. Exceptional staff support access requires a separate explicit policy.
- Authorised staff can assemble and edit courses through basic CMS authoring from the first version, using ordered lessons and supported content blocks.
- Authors draft, preview, and publish courses. They can close new enrolments, removing a course from Available while existing participants can continue.
- Initial lesson blocks support formatted teaching text, images/video, discussion prompts with optional revealable guidance, text/number/choice questions, checklists, and structured exercises. Budgeting needs repeating rows and calculated totals. Grading and certificates are outside the initial scope.
- Solo participants complete shared exercises privately. Authors can provide mode-specific instructions within one lesson.
- Published course versions preserve existing enrolments, responses, and progress. New independent attempts use the latest version; invitees joining an existing group use that group's version. Teaching and title wording corrections can be made in place; changing question prompts, choice labels, budget category labels, audiences, or lesson structure creates a new version. See [course versioning decision](../adr/0004-preserve-enrolments-on-course-versions.md).
- Complex exercises are predefined blocks added to lessons, with limited customisation. The website supplies their behaviour and calculations; authors do not build arbitrary spreadsheets or formulas.
- Shared answers use ordinary autosaving in the existing website and Payload/Postgres database. Periodic refresh shows other participants' saved changes without replacing unsaved local edits. Detect stale saves and preserve the participant's work instead of silently overwriting a newer answer. Live simultaneous editing, WebSocket synchronisation, and additional collaboration services are outside the first version.
- A departing facilitator transfers facilitation to another participant or closes the group. Closing stops invitations and editing while preserving existing participants' read access to the workbook.
- Participants can repeat a course or take it with a different group. Each attempt has separate progress and answers, and earlier attempts remain accessible subject to group access rules. Private answers never carry into another group automatically.
- Participation mode cannot be switched on an existing attempt. Moving from solo to shared participation means a new enrolment/attempt with fresh answers; the original attempt is retained.
- Participants can delete personal answers and their own individually authored shared answers. Deleting a collaborative workbook is a separate explicit action for the group facilitator because it affects other participants. Closing preserves a workbook; deleting removes its contents.
- The initial content hierarchy is Course → Lessons → Blocks, without an additional section level.
- Answers autosave with visible saving, saved, and failure states. There is no separate Submit action or draft-to-published workflow. Navigation must not silently discard unsaved work. Other participants see saved changes through periodic refresh, within the question's configured audience.
- Invitations must be accepted through an account with the invited email verified. Late joiners use the existing group's course version.
- Individually authored shared answers become visible automatically after saving, with the audience displayed. Personal visibility boundaries remain enforced.

## Grooming status

Tatai approved the basic requirements and five vertical implementation tickets. The agreed scope uses simple account-based saving and shared workbooks within the existing website. Liveblocks, Hocuspocus, Yjs, and other live collaboration services are not required. Implementation proceeds through separate supervised chats, with integration and verification before delivery.
