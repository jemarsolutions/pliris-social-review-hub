# PLIRIS Social Review Hub

A private, personal prototype owned by Mac/Jemar. Producers prepare social and podcast content; reviewers approve an exact Instagram, Facebook, LinkedIn, YouTube or TikTok version. No social network is connected, and approval never schedules or publishes content.

This is not an official PLIRIS operational system. No Trello, WCS, HubSpot, HQ workflow or priority register is modified. All supplied artwork and seed copy are generic samples.

## Stack and architecture

Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui-style Radix components, Better Auth, Zod, Drizzle ORM, Neon PostgreSQL and Cloudinary. The production application runs entirely in Next.js on Vercel's Node runtime. No separate backend, paid service, AI generation, or publishing API is required.

The authenticated interface calls `/api/v1/`. Route handlers authenticate and validate requests, then call the same transactional domain services exercised by integration tests. Producers never write directly to database tables from the browser.

- Content items contain the overall idea and operational metadata.
- Platform adaptations belong to one item and are unique per platform and format. Supported formats are image post, carousel, short video and long video, with platform-appropriate choices.
- Immutable versions snapshot the final caption/description, title, script/transcript, chapters, tags, CTA, destination, images, video and thumbnail.
- Decisions reference the exact version and reviewer. There is one final decision per version.
- Comments, audit events and manual publishing records preserve their version context.
- Media metadata lives in PostgreSQL. Production images and videos are authenticated Cloudinary assets.

Drizzle schema: `src/db/schema.ts`. Migrations include relational constraints, review-queue indexes and triggers preventing edits/deletes to historical records. The production driver uses Neon WebSockets for interactive transactions and row locks. Local development uses explicitly enabled PGlite (embedded PostgreSQL) with the **same schema and services**, not SQLite or an in-memory mock. It is not used on Vercel.

## Quick local demo

Requires Node.js 22 or newer and npm. From a fresh checkout:

```sh
npm ci
npm run demo:setup
npm run dev
```

Open `http://localhost:3000`. Setup creates a local database, applies the checked-in migrations, creates five sample ideas with 15 variants, and generates distinct random passwords. Login details are saved only in `.local/demo-accounts.txt` (ignored by Git, private file permissions). No credentials are printed or committed.

| Local account       | Role                           |
| ------------------- | ------------------------------ |
| `mac@example.test`  | ADMIN (production permissions) |
| `john@example.test` | REVIEWER                       |

Setup refuses to overwrite an existing `.env`. To use an existing configuration, run `npm run db:migrate` and `npm run db:seed`. Seed data is idempotent by internal reference; it does not overwrite existing items or rotate passwords. The seed week is the next Monday–Friday. It includes ready-for-review, approved, changes-requested, rejected and manually recorded published examples, plus a three-slide carousel. All publication records are clearly sample records and do not correspond to real posts.

The local upload fallback saves small images and videos in `.local/media`, delivers them through the protected media route, and is disabled when `DATABASE_URL` exists or on Vercel. Back up `.local` only for local demo continuity; do not deploy it. Only one local process should open the same PGlite directory at a time.

## Production configuration

Copy `.env.example` to `.env` for trusted local administrative commands. Store real production values in Vercel's environment settings; never in source or chat.

| Variable                                        | Purpose                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                  | Neon pooled PostgreSQL connection string; required on Vercel          |
| `AUTH_SECRET`                                   | Cryptographically random secret, at least 32 characters               |
| `NEXT_PUBLIC_APP_URL`                           | Exact canonical application origin, HTTPS in production               |
| `CLOUDINARY_CLOUD_NAME`                         | Your Cloudinary environment name                                      |
| `CLOUDINARY_API_KEY`                            | Cloudinary API key, server only                                       |
| `CLOUDINARY_API_SECRET`                         | Cloudinary API secret, server only                                    |
| `LOCAL_DEMO`                                    | Set to `0` or omit in production; `1` only for local demo             |
| `LOCAL_DB_PATH`                                 | Local PGlite path, ignored when Neon is configured                    |
| `SEED_ADMIN_EMAIL`, `SEED_REVIEWER_EMAIL`       | Accounts intentionally provisioned by seed                            |
| `SEED_ADMIN_PASSWORD`, `SEED_REVIEWER_PASSWORD` | Unique passwords of at least 12 characters for seed provisioning      |
| `INTERNAL_API_KEY`                              | Optional random producer integration token, at least 32 characters    |
| `INTERNAL_API_USER_ID`                          | Existing ADMIN/PRODUCER user used as the integration's audit identity |

### Neon and Drizzle

1. Create/select a project on Neon's available free plan. Do not enable a paid plan.
2. Copy its PostgreSQL connection string into `DATABASE_URL` through secure environment settings. Keep SSL enabled.
3. Set `LOCAL_DEMO=0`, the auth variables and seed account variables in your local `.env`.
4. Run `npm run db:migrate`. The runner records migrations and applies each inside a transaction with an advisory lock.
5. Run `npm run db:seed` if sample content is desired. With Neon configured, this also requires Cloudinary.
6. For future schema changes: `npm run db:generate`; review the generated SQL and commit it, then run migrations from a controlled environment.

Migrations are never silently run on page requests or on every Vercel build. Do not replace migrations with `drizzle-kit push`: custom immutable-history triggers and ownership constraints are intentional.

### Authentication and roles

Better Auth provides email/password sign-in, database-backed sessions and authentication rate limiting. Public signup is disabled. Passwords are hashed with Better Auth's password implementation. The server checks roles for every mutation.

ADMIN and PRODUCER can create/edit/upload/submit and manually record external scheduling/publication. REVIEWER can approve, request revision, reject and comment, but cannot edit production content. ADMIN intentionally does **not** approve. The MVP has no user-management web console or automatic invitations.

Provision an additional account with the administrative CLI. Set `NEW_USER_NAME`, `NEW_USER_EMAIL`, `NEW_USER_ROLE` and `NEW_USER_PASSWORD` in a private local environment, then:

```sh
npm run user:create
```

Roles must be ADMIN, PRODUCER or REVIEWER. Existing email addresses are preserved. This command sends no message or invitation. Share account details with the intended person through your normal secure channel. Password reset email and account revocation UI are deferred; an administrator must handle those through a controlled maintenance workflow. Do not invite John until Mac has tested the prototype.

### Cloudinary

1. Create/select a Cloudinary environment with an available free plan. Do not upgrade or enable billable add-ons.
2. Configure the three Cloudinary environment variables on the server.
3. Images upload server-side. Videos obtain a short-lived, server-signed upload request and upload directly from the browser to Cloudinary in 20 MB chunks, avoiding Vercel request-size limits. No unsigned upload preset is needed and the API secret never reaches the browser.
4. Uploads use `type: authenticated`, random immutable public IDs and `overwrite: false`. Media metadata and versioned references are persisted in PostgreSQL; binaries are never stored in Neon.
5. `/api/media/[id]` authenticates delivery. Images are streamed through the protected route; videos redirect to an authenticated signed Cloudinary delivery URL after authorization. Responses use `private, no-store`.
6. Original assets remain untouched. Thumbnail, poster and preview transformations use bounded dimensions and automatic format/quality. Confirm authenticated transformations are enabled for your Cloudinary environment before the live acceptance test.

JPEG, PNG and WebP uploads are limited to 3 MB per image and 20 images per adaptation. MP4, MOV and WebM review videos are limited to 1 GB in production. The local fallback intentionally accepts only files under 3 MB. SVG and arbitrary URLs are not accepted. Uploads require a producer identity and descriptive text. Cloudinary supplies production dimensions and video duration.

## Review workflow

1. Sign in as Mac and open Content studio → Create content.
2. Add a platform adaptation and select a supported format. For image posts/carousels, add images and set carousel order. For video, upload a portrait or landscape review copy, optional/required thumbnail, final description, script/transcript, and YouTube metadata where applicable.
3. Save the draft, open it and select Submit for review.
4. Sign in as John. The review queue lists only current versions needing review, ordered by planned time.
5. Inspect the full caption, carousel, destination, planned date and version. Approve, or provide required feedback for revision/rejection.
6. Mac opens Revisions and edits the variant. A substantive change creates a new immutable version. A reviewed adaptation returns to Ready for review; it never inherits approval. Previous feedback stays with the previous version.
7. Re-approve the new version. Other platforms remain untouched.

Changing any approved payload field—including caption, title, script, chapters, tags, CTA, URL, image order, video or thumbnail—creates a version. A no-op save does not. Draft edits also create immutable versions but remain draft until submission. Planned posting time, content title, campaign, concept summary and reference are operational metadata and do not change the approved payload. Every reviewed asset and field is reconstructable historically.

Approval and publishing states are separate. Manual scheduling/publication records require current approval and an explicit producer action. Editing approved content resets the current publishing state to Unscheduled, while the prior publishing record stays in history. Published content is not edited on a social network by this app.

Approval coverage includes overdue active variants and all active variants planned before the next **168-hour** cutoff. The numerator is current approved platform variants; the denominator is all included active variants. All variants require review. The dashboard cannot report 100% while an overdue review remains open. Empty windows show no coverage percentage rather than imply 100%. The calendar is Monday–Sunday and uses UTC; its previous/current/next controls do not change content dates.

## Security and integrity

- Authenticated page, API and media routes; no public signup or default production password.
- Database session lookup and server-side role enforcement; no client-side role trust.
- Same-origin checks for session-authenticated API mutations and Better Auth's origin protection on sign-in endpoints.
- Integration bearer keys use constant-time comparison. The key grants producer capability only and cannot approve. Rotate/remove the environment key to revoke access; use a dedicated producer account for a clear audit identity.
- Zod input validation, HTTPS-only destination URLs and React text rendering.
- Per-variant transaction/row lock plus optimistic `expectedVersionId` checks. Stale edits and decisions fail with 409.
- Immutable database history, version ownership foreign keys and required feedback constraint.
- Media routes return private, non-cacheable responses and do not reveal signed delivery URLs.
- No secrets committed; `.env`, `.local`, dependencies and build output are excluded.

This is a small trusted-team prototype, not a completed security audit. There is no external publishing, billing, telemetry product, outgoing webhook delivery or analytics sync. The API loads the current dataset without pagination; add pagination before large-scale ingestion. Orphan media cleanup after an interrupted upload is deferred, because deleting a historically referenced asset must never be automated casually. Cloudinary account administrators can still delete provider assets, so provider retention/backups remain an operational responsibility.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Tests use isolated embedded PostgreSQL and the **real migrations, Better Auth handlers and API handlers**. They cover the original Instagram/Facebook/LinkedIn workflow plus YouTube long-form and TikTok short-form video. The video scenario verifies upload authorization, thumbnails, exact scripts and titles, independent approval, revision history and invalid platform/format rejection. The suite also exercises stale requests, missing reasons, unauthorized roles, cross-origin writes, protected media, historical comments, database mutation guards and disabled signup.

See `docs/VERIFICATION.md` for the actual run results and outstanding live-provider/browser checks. Passing local API integration tests does not claim a live Neon/Cloudinary/Vercel test passed.

## GitHub and Vercel

Repository: `pliris-social-review-hub`. Keep `main` deployable; use feature branches for changes after initial adoption. Commit the lockfile, migrations and tests, never `.env` or `.local`. No GitHub Actions workflow is enabled automatically, avoiding unintended minutes consumption; run the verification commands locally or add a budget-controlled workflow later. If the repository is temporarily public for collaboration, return it to private after the branch is available.

1. Push the reviewed source to a **private** GitHub repository.
2. Import it in Vercel as a Next.js project; use Node.js 22+ and the default build/output settings. `vercel.json` explicitly selects Next.js and the build command.
3. Configure Neon, auth and Cloudinary environment variables. Ensure `NEXT_PUBLIC_APP_URL` exactly matches the stable HTTPS deployment URL. Omit `LOCAL_DEMO` or set `0`.
4. Apply migrations and provision accounts from a trusted local environment before first sign-in.
5. Deploy and complete the live-provider acceptance test in `docs/VERIFICATION.md`.

For an existing deployment, run `npm run db:migrate` against its Neon database before promoting this video-capability branch. The migration preserves old approvals, identifies existing multi-image variants as carousels and enriches their historical image snapshots.

No paid plan has been enabled or requested. This is a personal prototype. If PLIRIS formally adopts it, reassess Vercel's then-current commercial-use/plan requirements and all provider quotas before production use. No guarantee is made about future free-tier availability.

## Documentation and Phase 2

- `docs/API.md`: versioned endpoints, auth, examples, error contract.
- `docs/VERIFICATION.md`: tests, P0 checklist and limits.
- `docs/ROADMAP.md`: bounded P1/P2 work.

Official implementation references: [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Better Auth options](https://better-auth.com/docs/reference/options), [Drizzle Neon connections](https://orm.drizzle.team/docs/connect-neon), [Neon driver](https://neon.com/docs/serverless/serverless-driver).
