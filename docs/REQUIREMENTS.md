# Mehwar Flow — Product Requirements

Mehwar Flow is a SaaS dashboard where a person connects their social accounts, writes a post once,
previews it per network, schedules it in their own time zone, and publishes it everywhere, without
needing to know how any social media API works.

**Scope decision (current):** each login is a **personal account** that manages its own channels.
Team features (members, roles, approvals, client workspaces) come in a later phase. Internally every
user already gets one personal _organization_, and all data is keyed by `organization_id`, so teams
can be added later without migrating data.

---

## 1. Corrections to the original (Gemini) specification

The first draft had a few wrong or outdated details about the platform APIs. Build against these instead:

| Area                     | Original draft            | What is actually required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| YouTube scopes           | `https://googleapis.com`  | `https://www.googleapis.com/auth/youtube.upload` and `youtube.readonly` (plus `yt-analytics.readonly` for analytics). Keep `access_type=offline&prompt=consent`. Until Google verifies the app and YouTube audits it, API uploads are forced to **private**. The default quota is 10,000 units/day and an upload costs about 1,600 units, so roughly 6 uploads/day per Google project.                                                                                                                                   |
| X media upload           | v1.1 `upload.twitter.com` | The v1.1 upload endpoint is retired. Use **v2 `POST /2/media/upload`** (INIT/APPEND/FINALIZE/STATUS). Scopes: `tweet.read tweet.write users.read media.write offline.access` (without `offline.access` you get no refresh token). X refresh tokens are **single-use**: store the new one atomically on every refresh. Posting through the API needs a **paid** X API tier.                                                                                                                                               |
| Snapchat                 | Snap _Marketing_ API      | The Marketing API is for **ads**. Organic posting to a Public Profile needs partner-gated access (Public Profile API / Creative Kit). Ship Snapchat **behind a feature flag** until Snap approves the app.                                                                                                                                                                                                                                                                                                               |
| Instagram "ready" status | Webhook                   | There is **no webhook** for container readiness. Poll `GET /{container-id}?fields=status_code` with back-off until `FINISHED` (give up after about 5 min, surface `ERROR`). Images must be JPEG. Limit: **100 API-published posts per 24h** per account. Two connect paths: Facebook Login (IG account linked to a Page) and the newer _Instagram API with Instagram Login_.                                                                                                                                             |
| Facebook token           | 60-day Page token         | Exchange the short-lived user token for a long-lived one. A **Page token derived from a long-lived user token does not expire**, so store that. Scopes: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `business_management`. Multi-photo posts: upload photos with `published=false`, then create the feed post with `attached_media`.                                                                                                                                                               |
| Threads                  | 10 media per card         | Carousels allow up to **20** items. Scopes: `threads_basic`, `threads_content_publish` (+ `threads_manage_insights`). Chain posts with `reply_to_id`. Limit: 250 posts per 24h. Long-lived tokens last 60 days and are refreshed with `th_refresh_token`.                                                                                                                                                                                                                                                                |
| TikTok pull upload       | Any S3 presigned URL      | `PULL_FROM_URL` only accepts URLs under a **domain/URL prefix you verified in the TikTok developer portal**. Serve media from your own domain (e.g. `media.example.com` in front of MinIO). Call `creator_info/query` first and follow TikTok's UX rules: show the creator's nickname, offer only the privacy levels the API returns, never preselect a privacy level, and show the commercial-content disclosure toggles. **Unaudited apps can only post as `SELF_ONLY`.** Offer `FILE_UPLOAD` (chunked) as a fallback. |
| Scheduler                | Poll DB every minute      | Primary trigger: **BullMQ delayed jobs**. Safety net: a 1-minute DB sweep that re-enqueues due targets (covers Redis data loss). `jobId = post_target_id` makes enqueueing idempotent, so posts are never published twice.                                                                                                                                                                                                                                                                                               |
| Encryption               | "AES-256"                 | **AES-256-GCM envelope encryption**: each organization has a random data key (DEK), stored only wrapped by a versioned master key (KEK) kept outside the DB. Ciphertexts are bound to their row with AAD. The KEK can be rotated without re-encrypting any tokens.                                                                                                                                                                                                                                                       |

---

## 2. Functional requirements

### 2.1 Accounts & security

- Sign-up, login, logout; email + password (scrypt hashing). Google sign-in and TOTP 2FA come in a later phase.
- Short-lived JWT access token (15 min) held in memory; refresh token in an **httpOnly cookie**, rotated on every use, with **reuse detection** (replaying an old token revokes the whole session family).
- Changing the password revokes all sessions.
- Profile: name, **time zone** (IANA), X Premium flag (raises the X limit to 25,000 characters).
- Per-IP rate limiting on credential endpoints; a global throttle on all endpoints.
- Audit log of sensitive actions (register, login, password change, channel connect/disconnect, publish).
- GDPR: data export, and account deletion that also revokes platform tokens.

### 2.2 Tenant isolation

- Every tenant row carries `organization_id`. It is enforced three ways:
  1. the JWT carries the organization id, and nothing tenant-scoped comes from request parameters;
  2. services use a tenant-scoped Prisma client;
  3. **Postgres Row-Level Security** with `FORCE ROW LEVEL SECURITY`, and the app connects as a non-owner, non-superuser role. Rows of other tenants are invisible and cannot be written even if a query forgets its `WHERE`.

### 2.3 Token vault & refresh worker

- Access and refresh tokens are encrypted at rest (see §1). They are never returned to the browser and never logged.
- A repeatable worker job (every 5 min) finds credentials inside their refresh window:
  - 2-hour tokens (X, Google): refreshed 15 min before expiry.
  - 60-day tokens (Meta, Threads): refreshed 7 days before expiry.
  - TikTok: refreshed 1 hour before expiry.
- Each refresh takes a per-channel lock. On `invalid_grant` or a revoked token, the channel becomes `NEEDS_RECONNECT`, its scheduled posts pause, and the user is notified.

### 2.4 Channel connection

- One generic OAuth flow for every network: signed `state`, PKCE where supported, verifier kept in Redis with a 10-min TTL.
- After the callback, an **account picker**: Facebook Pages (`/me/accounts`), Instagram business accounts linked to those Pages, YouTube channels.
- Channel health view: status, token expiry, granted scopes, last publish, reconnect button.

### 2.5 Composer

- One base draft plus **per-network tabs** with overrides and live previews.
- Validation rules live in `packages/shared` and run identically in the browser and on the server:

| Network   | Text                         | Media                                    | Notes                                           |
| --------- | ---------------------------- | ---------------------------------------- | ----------------------------------------------- |
| X         | 280 (25,000 with Premium)    | ≤4 images **or** 1 video                 | Thread chaining                                 |
| Facebook  | 63,206                       | ≤10 images or 1 video; text-only OK      | Page selector                                   |
| Instagram | 2,200, ≤30 hashtags          | 1–10 items (carousel), media required    | Warn: links not clickable                       |
| Threads   | 500 per block                | ≤20 items                                | "Add to thread" blocks, auto-split              |
| YouTube   | title 100, description 5,000 | exactly 1 video                          | privacy, **Made for Kids** (required)           |
| TikTok    | 2,200                        | exactly 1 video (tab disabled otherwise) | privacy from `creator_info`, disclosure toggles |
| Snapchat  | short overlay                | 1 vertical **9:16** asset, video ≤60 s   | behind feature flag                             |

- The submit button is locked with a per-network reason when any selected network has an error; warnings (such as non-clickable links or a pending format conversion) don't block.
- Extras: first comment (IG/FB), UTM builder, saved hashtag groups, caption templates, draft autosave.

### 2.6 Media library (MinIO / S3)

- Browsers upload directly to MinIO with presigned PUTs (multipart for large videos). Objects are keyed `org/<organization_id>/...`, with a per-account storage quota.
- A media worker (ffmpeg + sharp) extracts metadata, makes thumbnails, converts formats (HEIC/PNG → JPEG for Instagram, H.264/AAC MP4), and crops or pads to 9:16, 1:1 or 4:5.
- Pull-based platforms (Instagram, Threads, TikTok) get a public URL under `public/` or a short-lived presigned GET.

### 2.7 Scheduling & calendar

- Store the UTC instant **and** the IANA time zone. Conversion is DST-safe; times that fall in a DST gap move forward.
- Post status: `DRAFT → SCHEDULED → PUBLISHING → PUBLISHED | PARTIALLY_FAILED | FAILED`. Each channel is a `post_target` with its own status, external id and URL, and error.
- Calendar with month, week and list views, drag-and-drop rescheduling, posting-slot queues ("next free slot"), publish now, bulk CSV import, and pause-all per channel.

### 2.8 Publishing engine

- One job per `post_target`. Retries use exponential back-off, but only for retryable errors (5xx, 429, network). Permanent errors fail fast with a human-readable message. Per-platform rate limiters. Failed jobs go to a dead-letter queue with a Retry button.
- Every platform connector implements `getAuthUrl`, `exchangeCode`, `refresh`, `listAccounts`, `validate`, `publish`, `getStatus`, `fetchMetrics` and `revoke`:
  - **YouTube:** resumable upload in 8 MB chunks streamed from MinIO; resumes after a dropped connection via a `Content-Range` probe.
  - **Facebook:** feed, photo, multi-photo and video (resumable for large files).
  - **Instagram:** create containers, poll status, then `media_publish`. A carousel is child containers plus a parent.
  - **Threads:** create a container, then publish; chained blocks are published in order via `reply_to_id`.
  - **X:** chunked v2 media upload, then `POST /2/tweets` with the `media_ids`; threads via `reply.in_reply_to_tweet_id`.
  - **TikTok:** `creator_info`, then `video/init` (`PULL_FROM_URL` or `FILE_UPLOAD`), then poll `status/fetch`.
  - **Snapchat:** check duration and aspect ratio, then chunked multipart upload.
- Live status in the UI (WebSocket/SSE); in-app and email notifications on success or failure.

### 2.9 Analytics (MVP)

- A nightly and on-demand metrics job stores time-series snapshots per post (views, likes, comments, shares, reach) and per account (followers).
- Dashboard: totals, trends, top posts, network comparison, date filter, CSV export.

### 2.10 AI assistant (MVP)

- Uses Claude (default `claude-sonnet-5-5`, configurable): write a caption from a prompt, rewrite per network (tone and limits), suggest hashtags, write alt text, translate.
- Monthly AI credits per plan; brand-voice settings per account.

### 2.11 Billing

- Stripe subscriptions (Free / Pro / Business) with limits on channels, scheduled posts, storage and AI credits. Stripe webhooks update an entitlements table, which a guard enforces.

### 2.12 Later phases

Team members, roles and approval workflow, client workspaces, a unified inbox (reply to comments and DMs), LinkedIn, Pinterest, Bluesky and Google Business Profile connectors, RSS auto-post, white-label reports, a public API and outgoing webhooks, a mobile app/PWA, and a link-in-bio page.

---

## 3. Non-functional requirements

- **Security:** helmet headers, CORS allow-list, validation of every input (Zod), secrets redacted from logs, least-privilege OAuth scopes, signed webhooks.
- **Reliability:** idempotent jobs, Redis AOF persistence, a scheduler sweeper, graceful shutdown.
- **Observability:** structured logs, OpenTelemetry traces, Sentry, health endpoints, Bull Board.
- **Compliance before launch:** Meta App Review, Google OAuth verification plus the YouTube API audit, the TikTok app audit, a paid X API tier, Snap partner approval, and published privacy policy, terms and data-deletion URLs.
