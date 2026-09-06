# Build and verification receipt

Date: 6 September 2026. Product: PLIRIS Social Review Hub. Owner: Mac/Jemar. Personal prototype only.

## Status

Application source is implemented and builds locally. The PostgreSQL-backed authenticated API workflow has passed local integration testing. **Do not treat live-provider P0 acceptance as finished yet:** Neon, Cloudinary and Vercel credentials have not been supplied, and the full signed-in browser sequence has not been verified.

## P0 checklist

| Requirement                                            | Current state                                                                                 |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Next.js, App Router, strict TypeScript                 | Implemented; production build passes                                                          |
| Tailwind, shadcn/ui/Radix button and dialog primitives | Implemented; themed responsive UI                                                             |
| Neon connectivity                                      | Production adapter configured in code; live connection pending                                |
| Drizzle schema and migrations                          | Implemented; real PostgreSQL migrations pass locally                                          |
| Authentication, no public signup                       | Better Auth; login and denied-signup integration tests pass                                   |
| Admin/Producer and Reviewer roles                      | Implemented; server-side role tests pass                                                      |
| Content items and three platform variants              | Implemented; create, read and metadata update API plus producer UI                            |
| Immutable versions                                     | Implemented; database mutation guards and historical reconstruction tested                    |
| Cloudinary upload and delivery                         | Authenticated server-side integration implemented; live credentials pending                   |
| Local media fallback                                   | Explicit local demo only; upload/delivery API exercised                                       |
| Carousel support and ordering                          | Editor, preview arrows and thumbnails implemented; ordered snapshots tested                   |
| Submit for review and John review queue                | Implemented and API-tested                                                                    |
| Platform preview                                       | Instagram/Facebook/LinkedIn approximate presentations implemented                             |
| Approve / request revision / reject                    | Implemented; required feedback and exact version checks pass                                  |
| New review after payload edits                         | Implemented; previous approval remains historical                                             |
| Independent platform approvals                         | Three-platform test passes                                                                    |
| Weekly calendar and seven-day coverage                 | Implemented; API state and boundary calculations tested                                       |
| Revision queue and history/audit                       | Implemented; feedback and historical comment tests pass                                       |
| API v1 and producer integration token                  | Implemented; authorization and revocation tested                                              |
| Five ideas / 15 sample adaptations                     | Seed script applied successfully locally                                                      |
| Required complete user journey                         | Authenticated API integration passes; signed-in browser journey pending                       |
| Deployment readiness                                   | Build/config/docs provided; live deployment remains blocked by external setup                 |
| Private GitHub repository                              | Repository supplied by Mac; initially public with write access, then returned 404; private visibility/access must be verified before upload |
| Vercel deployment                                      | Not performed; no URL or credentials available                                                |

## Local checks

- TypeScript strict check: passed.
- Production build: passed (Next.js App Router pages and API route handlers).
- Fresh migration and seed: passed; five sample ideas / fifteen variants.
- Automated tests: **18 passed / 18**, including the required three-platform API workflow, integration-key revocation and competing decisions.
- Live browser: protected root redirects to sign-in; login page DOM and desktop appearance verified.
- Full authenticated browser UI and mobile checks: not completed. Browser sign-in uses a secure user credential handoff; automated API sign-in does not establish the browser session. No auth bypass was added.
- Live Neon WebSocket connection, Cloudinary signed upload/delivery and Vercel runtime: not run without account configuration.

## Required end-to-end scenario covered through real API handlers

1. Mac signs in using Better Auth.
2. Creates Monday Educational Content.
3. Uploads two PNG images through authenticated media API.
4. Creates Instagram, Facebook and LinkedIn variants; Instagram has a carousel.
5. Submits all three; John's queue contains all three.
6. John signs in and approves exact Facebook and LinkedIn versions.
7. John requests Instagram revision: “Please revise the first slide and shorten the opening caption.”
8. Mac's revision queue contains Instagram.
9. Mac changes caption and carousel order; Instagram version 2 is Ready for review.
10. Version 1 caption, media order and feedback remain intact.
11. John approves version 2; all three current versions are approved.
12. No scheduling/publication record is created automatically.
13. Calendar and API current state agree; coverage is 3/3, 100%.
14. Unauthorized or stale decision requests cannot alter state.

Additional checks: approved-to-new-version invalidation, blank feedback, producer/admin review denial, reviewer production denial, cross-origin rejection, private media, rejected Instagram independence, invalid destination URL, immutable database history, historical comments, exact coverage window boundaries, public signup denial, scoped service key/revocation and competing review decisions.

## Live-provider acceptance before calling P0 fully complete

1. Configure Neon, Cloudinary, auth secret and canonical HTTPS Vercel origin securely; disable local demo.
2. Apply migrations; intentionally create Mac and John accounts. Seed generic samples if desired.
3. Deploy privately/auth-gated and open a fresh unauthenticated browser: `/` must redirect to `/login`; `/api/v1/content` and a known media URL must return 401.
4. Perform the full 32-step handoff scenario in the browser, including actual Cloudinary upload, carousel ordering, reviewer decisions, version history and no automatic publishing.
5. Open the same variant in two tabs. Approve/edit one, then attempt a stale action in the other; expect a conflict and no overwritten history.
6. Confirm authenticated Cloudinary transformations deliver both thumbnails and full images while originals remain unchanged.
7. Verify mobile/keyboard usability for queue, modal, carousel, caption, actions and editor. Confirm usable rendering at 200% text enlargement.
8. Check Vercel logs for unexpected errors without disclosing secrets. Confirm no public signup, billing upgrade or social publishing integration exists.
9. Mac reviews the final prototype before John is invited. No message has been sent to John.

## Known limitations

- No deployed application yet. GitHub repository supplied by Mac; source upload awaits restored connector access and private visibility verification.
- Live providers and signed-in browser UI still require acceptance.
- Operational metadata changes (title/campaign/reference/planned dates) are audited, not versioned as social payload.
- Local upload metadata uses zero dimensions; Cloudinary supplies actual dimensions in production.
- API currently loads the small prototype dataset without pagination; it is not intended for large-scale ingestion yet.
- User management is a CLI; no email reset/invitation or notification system.
- Archive shows currently published variants; earlier publication records after later edits remain available in variant history.
- No automated outgoing webhook, social scheduling, publishing or analytics.
- Free-tier terms and quotas need reassessment before formal commercial adoption.
