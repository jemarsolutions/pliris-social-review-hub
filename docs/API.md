# API v1

All paths begin with `/api/v1`. Responses are `{ "data": ... }` on success and `{ "error": { "message": "...", "details": [...] } }` on failure. `details` is supplied for validation errors. GET/PATCH return 200; POST returns 201. No unauthenticated data access is allowed.

## Authentication

Browser requests use the Better Auth session cookie. POST/PATCH require an Origin header equal to `NEXT_PUBLIC_APP_URL`. Login is `POST /api/auth/sign-in/email` with email/password; logout is `POST /api/auth/sign-out`. No public signup.

Optional server-to-server callers pass `Authorization: Bearer <INTERNAL_API_KEY>`. Set a random key with 32+ characters and an existing producer `INTERNAL_API_USER_ID`. Integration writes are audited and are always restricted to producer actions. The key cannot grant reviewer authority; removing/rotating the environment key revokes it. Never put it in browser code.

## Endpoints

| Method | Path                                      | Permission / meaning                                                       |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/me`                                     | Current actor                                                              |
| GET    | `/dashboard`                              | Active items, current variants, counts and coverage                        |
| GET    | `/content`                                | List active content with platform adaptations                              |
| POST   | `/content`                                | Producer creates idea                                                      |
| GET    | `/content/:id`                            | Content with all current variants                                          |
| PATCH  | `/content/:id`                            | Producer edits operational metadata                                        |
| POST   | `/content/:id/platform-variants`          | Producer creates one platform/format draft                                 |
| PATCH  | `/platform-variants/:id`                  | Producer creates a new payload version if changed                          |
| POST   | `/platform-variants/:id/plan`             | Producer changes operational planned time                                  |
| POST   | `/platform-variants/:id/submit-review`    | Producer submits draft/in-production version                               |
| POST   | `/platform-variants/:id/approve`          | Reviewer approves exact current pending version                            |
| POST   | `/platform-variants/:id/request-revision` | Reviewer; reason required                                                  |
| POST   | `/platform-variants/:id/reject`           | Reviewer; reason required                                                  |
| POST   | `/platform-variants/:id/comments`         | Authenticated user; exact version comment                                  |
| GET    | `/platform-variants/:id/history`          | All immutable versions, decisions, comments, events and publishing records |
| POST   | `/platform-variants/:id/publishing`       | Producer records an external scheduling/publication action                 |
| GET    | `/review-queue`                           | Current Ready for review variants, sorted by planned time                  |
| GET    | `/revisions`                              | Current Changes requested variants                                         |
| GET    | `/calendar?start=ISO&end=ISO`             | Planned variants in inclusive-start/exclusive-end range                    |
| GET    | `/coverage`                               | Next 168 hours coverage and earliest unapproved adaptation                 |
| POST   | `/media`                                  | Producer multipart image upload; local demo also accepts small videos      |
| POST   | `/media/sign-upload`                      | Producer requests a signed direct Cloudinary video upload                  |
| POST   | `/media/complete-video`                   | Producer verifies and records a completed Cloudinary video                 |

Media is read through authenticated `GET /api/media/:id`; append `?thumb=1` for an image thumbnail or video poster. Image payloads are streamed, while authorized production video requests redirect to authenticated Cloudinary delivery. Ordered `version.media`, `version.video` and `version.thumbnail` entries contain immutable metadata snapshots.

Supported platform/format combinations:

| Platform  | Formats                                       |
| --------- | --------------------------------------------- |
| Instagram | Image post, carousel, short video             |
| Facebook  | Image post, carousel, short video, long video |
| LinkedIn  | Image post, carousel, long video              |
| YouTube   | Short video, long video                       |
| TikTok    | Short video                                   |

## Payloads

Create content:

```json
{
  "title": "Monday Educational Content",
  "contentDate": "2026-09-07",
  "campaign": "Sample",
  "conceptSummary": "A short concept summary"
}
```

The server assigns each content item a unique internal reference in the form
`PLIRIS-0001`. References increment automatically and cannot be changed during
an edit.

Create variant:

```json
{
  "platform": "INSTAGRAM",
  "contentFormat": "CAROUSEL",
  "plannedPublishAt": "2026-09-07T16:00:00.000Z",
  "caption": "Final caption",
  "ctaText": "Learn more",
  "ctaUrl": "https://example.com/",
  "mediaIds": ["asset-id-1", "asset-id-2"]
}
```

Create a YouTube podcast video:

```json
{
  "platform": "YOUTUBE",
  "contentFormat": "LONG_VIDEO",
  "plannedPublishAt": "2026-09-09T16:00:00.000Z",
  "headline": "Final podcast episode title",
  "caption": "Final YouTube description",
  "script": "Final transcript or approved script...",
  "chapters": "00:00 Introduction\n01:42 Main topic",
  "tags": "PLIRIS, podcast",
  "ctaText": "Subscribe",
  "ctaUrl": "https://example.com/",
  "mediaIds": [],
  "videoId": "video-asset-id",
  "thumbnailId": "thumbnail-asset-id"
}
```

Edit variant (all payload fields are submitted; ordered `mediaIds` are authoritative):

```json
{
  "expectedVersionId": "current-version-id",
  "caption": "Revised caption",
  "headline": "",
  "script": "",
  "chapters": "",
  "tags": "",
  "ctaText": "Learn more",
  "ctaUrl": "https://example.com/",
  "mediaIds": ["asset-id-2", "asset-id-1"],
  "videoId": null,
  "thumbnailId": null
}
```

Review / submission:

```json
{
  "expectedVersionId": "current-version-id",
  "reason": "Please revise the first slide and shorten the opening caption."
}
```

`reason` is optional for approval; required/nonblank for request-revision and reject. Submit-review only requires `expectedVersionId`. Image formats require at least one image; video formats require a video. YouTube requires a title, and YouTube long-form requires a thumbnail. Each version gets one final decision; revisiting a rejected/approved/changes-requested version requires a genuinely changed new version.

### Direct video upload

1. Request upload authorization from `/media/sign-upload` with `filename`, `mimeType` and `bytes`.
2. In production, send the file directly to the returned Cloudinary URL using the returned signed fields. Files over 20 MB may be sent in sequential chunks sharing one upload ID.
3. Send Cloudinary's final `public_id`, `version`, `signature`, dimensions, duration and file metadata to `/media/complete-video`.
4. The server verifies Cloudinary's response signature before recording the asset. A forged or incomplete completion response is rejected.

The production limit is 1 GB and accepted MIME types are MP4, QuickTime/MOV and WebM. The API secret is server-only.

Comment:

```json
{
  "versionId": "current-or-historical-version-id",
  "body": "This feedback refers to this exact version."
}
```

Manual publishing:

```json
{
  "expectedVersionId": "approved-current-version-id",
  "status": "PUBLISHED",
  "publishedAt": "2026-09-07T16:00:00.000Z",
  "publishedUrl": "https://example.com/actual-post"
}
```

Supported publishing states: UNSCHEDULED, READY_TO_SCHEDULE, SCHEDULED, PUBLISHED. SCHEDULED requires `scheduledAt`; PUBLISHED requires actual `publishedAt` and `publishedUrl`. A current approval is required except to mark Unscheduled. This endpoint **does not call any social network**.

## Errors and concurrency

- 400 malformed JSON.
- 401 missing/invalid authentication.
- 403 incorrect role or origin.
- 404 missing resource/endpoint.
- 409 stale version, invalid workflow state, duplicate platform/reference/decision.
- 413 body too large or direct-upload limit exceeded.
- 422 invalid input, missing media or required reason.
- 503 Cloudinary configuration unavailable.
- 500 generic internal failure; database credentials/details are not returned.

Every review/edit uses `expectedVersionId`. On 409, reload the current record and review it; do not blindly retry using a newly fetched ID. Transactions serialize competing changes to a variant. A Facebook approval never changes an Instagram or LinkedIn record. History has no update/delete endpoint.

Future integrations should use this API rather than direct database writes. API pagination, per-service credentials, idempotency keys and outgoing webhook delivery are deferred until a concrete integration requires them.
