# Build and verification receipt

Date: 7 September 2026. Product: PLIRIS Social Review Hub. Owner: Mac/Jemar. Personal prototype only.

## Status

Application source is implemented and builds locally. The PostgreSQL-backed authenticated API workflow has passed local integration testing. **Do not treat live-provider P0 acceptance as finished yet:** Neon, Cloudinary and Vercel credentials have not been supplied, and the full signed-in browser sequence has not been verified.

## P0 checklist

| Requirement                                            | Current state                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Next.js, App Router, strict TypeScript                 | Implemented; production build passes                                                       |
| Tailwind, shadcn/ui/Radix button and dialog primitives | Implemented; themed responsive UI                                                          |
| Neon connectivity                                      | Production adapter configured in code; live connection pending                             |
| Drizzle schema and migrations                          | Implemented; real PostgreSQL migrations pass locally                                       |
| Authentication, no public signup                       | Better Auth; login and denied-signup integration tests pass                                |
| Admin/Producer and Reviewer roles                      | Implemented; server-side role tests pass                                                   |
| Five platforms and four content formats                | Instagram, Facebook, LinkedIn, YouTube and TikTok with platform-valid format choices       |
| Immutable versions                                     | Implemented; database mutation guards and historical reconstruction tested                 |
| Cloudinary image/video upload and delivery             | Authenticated images plus signed direct video upload implemented; live video check pending |
| Local media fallback                                   | Explicit local demo only; upload/delivery API exercised                                    |
| Carousel support and ordering                          | Editor, preview arrows and thumbnails implemented; ordered snapshots tested                |
| Submit for review and John review queue                | Implemented and API-tested                                                                 |
| Platform preview                                       | Five-platform image/video playback, metadata and script review implemented                 |
| Approve / request revision / reject                    | Implemented; required feedback and exact version checks pass                               |
| New review after payload edits                         | Implemented; previous approval remains historical                                          |
| Independent platform approvals                         | Image and video cross-platform tests pass                                                  |
| Weekly calendar and seven-day coverage                 | Implemented; API state and boundary calculations tested                                    |
| Revision queue and history/audit                       | Implemented; feedback and historical comment tests pass                                    |
| API v1 and producer integration token                  | Implemented; authorization and revocation tested                                           |
| Five ideas / 15 sample adaptations                     | Seed script applied successfully locally                                                   |
| Required complete user journey                         | Authenticated API integration passes; signed-in browser journey pending                    |
| Deployment readiness                                   | Build/config/docs provided; live deployment remains blocked by external setup              |
| GitHub repository                                      | Existing repository supplied by Mac; feature branch upload is tracked separately           |
| Vercel deployment                                      | Existing app reported deployed by Mac; this feature still needs a preview/live acceptance  |

## Local checks

- TypeScript strict check: passed.
- Production build: passed (Next.js App Router pages and API route handlers).
- Fresh migration and seed: passed; five sample ideas / fifteen variants.
- Automated tests: **20 passed / 20**, including the original three-platform workflow, YouTube/TikTok video independence, platform/format validation, integration-key revocation and competing decisions.
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

Additional video scenario: Mac uploads a YouTube long-form review video and thumbnail plus a TikTok short. John approves both. Mac revises only the YouTube title and exact transcript; YouTube returns to review while TikTok remains approved, and YouTube version 1 stays reconstructable. An invalid YouTube image-post adaptation is rejected.

Additional checks: approved-to-new-version invalidation, blank feedback, producer/admin review denial, reviewer production denial, cross-origin rejection, private media, rejected Instagram independence, invalid destination URL, immutable database history, historical comments, exact coverage window boundaries, public signup denial, scoped service key/revocation and competing review decisions.

## Live-provider acceptance before calling P0 fully complete

1. Configure Neon, Cloudinary, auth secret and canonical HTTPS Vercel origin securely; disable local demo.
2. Apply migrations; intentionally create Mac and John accounts. Seed generic samples if desired.
3. Deploy privately/auth-gated and open a fresh unauthenticated browser: `/` must redirect to `/login`; `/api/v1/content` and a known media URL must return 401.
4. Perform the full 32-step handoff scenario in the browser, including actual Cloudinary upload, carousel ordering, reviewer decisions, version history and no automatic publishing.
5. Open the same variant in two tabs. Approve/edit one, then attempt a stale action in the other; expect a conflict and no overwritten history.
6. Confirm authenticated Cloudinary transformations deliver thumbnails, full images, video posters and playable portrait/landscape videos while originals remain unchanged.
7. Verify mobile/keyboard usability for queue, modal, carousel, caption, actions and editor. Confirm usable rendering at 200% text enlargement.
8. Check Vercel logs for unexpected errors without disclosing secrets. Confirm no public signup, billing upgrade or social publishing integration exists.
9. Mac reviews the final prototype before John is invited. No message has been sent to John.

## Known limitations

- Existing main deployment predates the video feature; verify the feature preview before promoting it.
- Live providers and signed-in browser UI still require acceptance.
- Operational metadata changes (title/campaign/reference/planned dates) are audited, not versioned as social payload.
- The local demo accepts only small video fixtures and reports detected media with limited metadata; Cloudinary supplies production dimensions and duration.
- A single content item currently supports one adaptation per platform/format. Model separate clips as separate content items until podcast episode bundles are added.
- API currently loads the small prototype dataset without pagination; it is not intended for large-scale ingestion yet.
- User management is a CLI; no email reset/invitation or notification system.
- Archive shows currently published variants; earlier publication records after later edits remain available in variant history.
- No automated outgoing webhook, social scheduling, publishing or analytics.
- Free-tier terms and quotas need reassessment before formal commercial adoption.
