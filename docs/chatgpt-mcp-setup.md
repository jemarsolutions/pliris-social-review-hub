# ChatGPT connection for the PLIRIS Social Review Hub

The Hub exposes an OAuth-protected MCP endpoint at `https://<production-host>/api/mcp`. ChatGPT can use it to import/update a WCS post and read the review and revision queues. It cannot approve, reject, schedule, or publish posts.

## Production rollout

1. Deploy the code containing the MCP/OAuth routes and Better Auth configuration.
2. Apply `drizzle/0009_chatgpt_mcp_oauth.sql` to the production Neon database. This is separate from the already-applied `0008_external_content_links` migration. The OAuth tables are required before ChatGPT authorization can complete.
3. Confirm `NEXT_PUBLIC_APP_URL` is the canonical HTTPS production origin and that the existing `AUTH_SECRET` remains stable. Do not put `INTERNAL_API_KEY` into ChatGPT; this connection uses user-authorized OAuth.
4. Check that `https://<production-host>/.well-known/oauth-protected-resource/api/mcp` and `https://<production-host>/api/auth/.well-known/oauth-authorization-server` return JSON metadata, and that `POST https://<production-host>/api/mcp` without a token returns an OAuth challenge.
5. In ChatGPT, open **Settings → Apps → Create** (workspace owners/admins may need to enable developer mode), add the deployed MCP endpoint `https://<production-host>/api/mcp`, complete the Hub sign-in and consent screen, scan the tools, then create the app. The server supports OAuth authorization-code with PKCE, CIMD, dynamic client registration for compatibility, and `offline_access` refresh tokens.
6. Test with a WCS post in a non-production/safe test scenario first. Verify the returned action is `CREATED`, `UPDATED`, or `UNCHANGED`, then confirm the record and audit event in the Hub.

## Tools and scopes

- `import_or_update_wcs_post` (`wcs:write`): upserts one post by its stable WCS Content ID. Re-sending an identical payload does not create a duplicate. `submitForReview` defaults to false; review submission still uses Hub validation and human reviewers keep decision authority.
- `list_posts_awaiting_review` (`review:read`): read-only list of PLIRIS posts in `READY_FOR_REVIEW`.
- `list_posts_needing_revision` (`review:read`): read-only list of posts in `CHANGES_REQUESTED`.

The `offline_access` authorization scope lets ChatGPT refresh its OAuth token. The Hub’s current seven-day session lifetime still means an inactive connection may eventually need the user to sign in again.

ChatGPT’s current full MCP support for write actions is available on Business and Enterprise/Edu plans; Pro currently supports custom MCP apps for read/fetch only. The import tool requires a plan/workspace that permits write actions.

The import tool expects the same fields and enums documented in `chatgpt-social-media-hq-openapi.yaml`. Media must already be uploaded to the Hub and referenced by its media IDs.

## Automation boundary

An MCP connection gives ChatGPT tools to call when Social Media HQ runs them; it does not subscribe to Google Sheets change events or wake ChatGPT when a new row appears. For unattended, immediate synchronization, PLIRIS WCS must call the existing `POST /api/v1/integrations/wcs/posts` endpoint on row creation/update (or a scheduled WCS sync must call it). ChatGPT can then use MCP to review Hub status and assist when its workflow runs. Keep WCS as the source of truth.
