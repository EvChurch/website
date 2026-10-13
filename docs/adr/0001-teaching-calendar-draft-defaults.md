# Teaching calendar supplies draft defaults; Payload owns published sermons

Match a recording to the teaching calendar using the service date in its filename and its recording campus. The user confirms that recording filenames carry the matching date. On import, populate the date, title (Sunday Topic), series, Bible passage, Bible-book selection, and the preacher from that campus's column.

Calendar values become editable draft defaults, not continuously synchronized sermon fields. Later calendar edits must not silently replace a manager's corrections or published metadata; refreshing from the calendar is an explicit action. Payload remains authoritative for published sermons.

Topic tags come from transcript processing after publication rather than the calendar's Sunday Topic or prose Themes column. Topics no longer block publication. Automatically apply a small set of relevant existing tags; propose new tag names for a sermon manager to approve instead of automatically expanding the taxonomy.

Use explicit mappings from shortened calendar preacher names to Payload speakers. Unknown or ambiguous names remain unset for correction. Reuse matching series and automatically create missing series from calendar labels.

The calendar file must be configurable because a future year's calendar may be in a different spreadsheet. Provide spreadsheet and worksheet selection in Sermon Settings rather than fixing the application to the 2026 source.

Every newly published recording must receive a timestamped transcript and transcript-derived topic tags attached to the sermon, regardless of preacher identity or review email availability. This processing is independent of article eligibility.

Display the transcript to listeners on the sermon page with clickable timestamps that seek to matching positions in the published audio. Replacing the published recording regenerates the transcript and topic tags so they describe the replacement audio.

The article is a separate artifact adapted for written presentation while preserving meaning and theology. Generate it only when a known preacher has a review email. Once sent for review, it remains independent of subsequent recording changes.
