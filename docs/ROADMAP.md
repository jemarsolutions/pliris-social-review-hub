# Follow-on work

## Finish external acceptance first

Connect the private repository, Neon, Cloudinary and Vercel; run the live-provider acceptance test. Have Mac test final content creation and review before inviting John. No operational PLIRIS integration is implied.

## P1

- User/account maintenance UI with explicit admin authorization, reviewer assignment including Royal.
- Version comparisons, more detailed audit filtering, date/platform filters on content studio.
- Calendar drag/drop only after agreeing which date changes require review.
- Pagination, scoped service credentials, idempotent ingestion and payload size/rate controls.
- Complete authenticated browser and mobile acceptance; keyboard tablist arrow-key behavior.
- Cloudinary retention policy, asset integrity checks and safe orphan cleanup.
- Approved-to-published archive showing original published versions independently of later edits.
- Budget-controlled CI and further concurrent-request tests against live Neon.

## P2 — separately authorized

- WCS/Control QA ingestion and decision reconciliation through API.
- Outgoing webhook delivery with retries and revocable service identities.
- Meta/Instagram/LinkedIn publishing or scheduling, only behind explicit authorization.
- Actual performance data; keep marketing metrics separate from review KPIs.
- Optional AI content/image generation, video workflow and notifications only after cost review.
- Multi-tenant architecture, billing and native apps only if product adoption justifies them.

Formal PLIRIS adoption requires a separate ownership, hosting/commercial-plan, source-of-truth and governance decision. Do not create Trello cards, modify WCS or change department priorities as part of this personal prototype.
