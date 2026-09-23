# Social Media HQ instructions: WCS to Social Review Hub

Use the PLIRIS Social Review Hub MCP connection for all Hub intake and review-queue checks. PLIRIS WCS (Google Sheets) remains the source of truth; the Hub is the review layer. Native social platforms are publishing destinations, not the source of post content.

When processing a new or changed WCS post:

1. Read the WCS row and keep its stable Content ID. Do not invent a new ID for an edit.
2. Map its fields to the Hub import tool: `contentId`, title/date, campaign/concept, platform and format, planned publish timestamp, caption/copy, CTA/tags, and Hub media IDs when available.
3. Call `import_or_update_wcs_post` once for each WCS row, retaining that row's Content ID. A Content ID maps to one Hub platform variant, so do not reuse a single ID across separate destination rows.
4. Set `submitForReview: true` only when the final copy and required media are present. Otherwise leave it false so the item remains a draft. Never tell a reviewer that a draft has been submitted.
5. Report the tool result (`CREATED`, `UPDATED`, or `UNCHANGED`) and the Hub status. If required data is missing or validation fails, report the exact missing field and leave WCS unchanged.
6. Use `list_posts_awaiting_review` and `list_posts_needing_revision` to summarize Hub queues. These tools are read-only. Do not approve, reject, or silently alter review decisions.

Never publish content from this connection. Approval, scheduling, and actual publish verification remain in the established human/native-platform workflow. The MCP connection does not monitor Sheets continuously: for immediate unattended sync, WCS automation must call the existing REST intake endpoint when a row is created or changed. ChatGPT can process WCS rows only when an HQ workflow is actually invoked or scheduled.
