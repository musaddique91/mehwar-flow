# Mehwar Flow Mobile: Connect to Production Backend + Full Feature Parity

Target backend: `https://mehwar.maverickignite.com/api` (Next.js rewrites `/api/*` to the NestJS API, so the API sees paths without `/api`).
App: Flutter, `apps/mobile` (provider + dio + flutter_secure_storage). About 5.9k lines today.
Audience: Antigravity (or any agent). Work phase by phase. Every phase ends with `flutter analyze` clean and a manual smoke test against production.

---

## 0. Current state (audit)

**Exists:** login/register, dashboard feed, composer (text, media, channels, AI sheet), calendar, channels list, analytics, settings (profile), media upload service, 4 providers.
**Base URL** already defaults to production (`AppConfig.defaultRemoteUrl`).

**Bugs that stop it working against the real backend (fix first, Phase 1):**

| # | Problem | Evidence | Fix |
|---|---------|----------|-----|
| B1 | **Token refresh can never work.** Backend reads the refresh token only from the httpOnly cookie `mf_refresh` (`auth.controller.ts` `refresh`). Dio has no cookie jar, so every refresh returns 401 and the user is logged out when the 15-min access token expires. | `api_client.dart` `_refreshToken` uses bare `Dio().post` | Backend: also accept the refresh token in the JSON body / `X-Refresh-Token` header and return `refreshToken` in the auth response when the request has `X-Client: mobile`. App: store it in secure storage and send it on refresh. (Alternative: `dio_cookie_manager` + `cookie_jar` persisted. Simpler and no backend change, but cookie `Secure`/`Path` rules are fragile. Prefer the explicit token.) Also rotate: save the new refresh token on each refresh, and make refreshes single-flight (a lock) so parallel 401s don't race. |
| B2 | Channel connect calls `GET /channels/:platform/auth-url`, which doesn't exist. Real route is `POST /channels/connect/:platform` returning `{url}`. | `channels_service.dart` | Switch to the POST. |
| B3 | OAuth callback redirects a browser to `WEB_ORIGIN/channels?connected=…`. The app never gets control back. | `channels.service.ts` `handleCallback`, `channels.controller.ts` `callback` | Add deep link `mehwar://oauth` (see Phase 3). Backend: `connect` accepts `?client=mobile`, and the callback redirects to `mehwar://channels?connected=x` or `mehwar://channels/select?session=..&platform=..`. |
| B4 | Schedule payload is wrong. API `POST /posts/:id/schedule` expects `{localDateTime:"YYYY-MM-DDTHH:mm", timezone}`; the app sends `{scheduledAt}`. `postInputSchema` has no `scheduledAt`, so scheduling from create/update is silently dropped. | `posts_service.dart`, `shared/posts.ts` | Create the post, then call `/schedule` with the local time and an IANA timezone (use `flutter_timezone`). |
| B5 | Media upload `PUT` sends `Stream.fromIterable([bytes])`, which is memory-heavy and breaks for big videos (limit is 4 GB). The presigned URL may point at an internal MinIO host. | `media_service.dart` | Stream from the file with `file.openRead()` and a progress callback. Verify `uploadUrl` is publicly reachable in production, and fix the S3 public endpoint in the backend env if it isn't. |
| B6 | `createPost` takes `targets` as raw maps and ignores `options` (YouTube title/privacy, IG media type, TikTok flags, thread blocks, WhatsApp recipient). | `posts_service.dart` | Typed `TargetInput` model mirroring `targetInputSchema`. |
| B7 | `main.dart` shows the Dashboard and gates inside it. There is no splash or session-restore state, no router, and no deep-link handling. | `main.dart` | Introduce `go_router` plus an auth redirect (Phase 2). |
| B8 | `usesCleartextTraffic="true"` in release; no iOS ATS config issues expected (https), but a debug-only flag should not ship. | `AndroidManifest.xml` | Move it to the debug manifest only. |
| B9 | Only one widget test. Models are hand-parsed with no typing for most DTOs. | `test/` | Add model parsing tests from real JSON fixtures (Phase 9). |

---

## 1. Phase 1: Foundation and auth (blocker work)

1. **Backend change (small, in `apps/api/src/auth`)**
   - `respond()` also returns `refreshToken` in the body when header `X-Client: mobile` is present (never for web).
   - `refresh` reads the token from cookie, else body `{refreshToken}` when `X-Client: mobile`. Logout does the same.
   - Add tests alongside the existing auth tests. Keep web behavior byte-identical.
2. **`ApiClient` rewrite**
   - Send `X-Client: mobile` and an `Accept-Language` header.
   - Single-flight refresh using a `Completer`. On refresh failure: clear tokens, emit a "session expired" event, and `AuthProvider` returns to login.
   - Add a retry for idempotent GETs on network errors (max 2, backoff).
   - Unified `ApiException` parser: handles `message` as a string or list, `statusCode`, and plan limit errors (402/403 from `EntitlementsService`) as a typed `PlanLimitException` that shows an upgrade sheet.
   - Timeouts: 15 s default, 120 s for AI endpoints, none for the S3 upload.
3. **Environment config**: `--dart-define=API_URL`, `--dart-define-from-file=env/prod.json` and `env/dev.json`. Android emulator → `10.0.2.2:4000`. Document in `apps/mobile/README.md` (replace the Flutter boilerplate; reconcile with the root `FLUTTER_README.md`).
4. **Session restore**: on launch read the token → `GET /auth/me` → route. Show a branded splash while it loads.
5. **Auth screens** (extend the existing ones): show server validation errors (password rules come from `passwordSchema`), add the timezone auto-detect (`flutter_timezone`), plus biometric unlock (`local_auth`) as an optional lock in Settings.

**Done when:** log in on a phone against production, wait over 15 min (or force a short JWT TTL on staging), and the app silently refreshes. Kill and reopen the app and the session persists. Logout revokes it server-side.

## 2. Phase 2: App architecture

- Add **`go_router`** with a shell route (bottom nav) and named routes for every screen below. Auth redirect guard. Deep-link scheme `mehwar://` (Android intent-filter, iOS `CFBundleURLTypes`) plus an optional universal link on `mehwar.maverickignite.com`.
- Keep `provider`, but add a generic `AsyncResource<T>` (loading, data, error, refresh) so each list screen stops hand-rolling state. Add pull-to-refresh and skeleton loaders everywhere (the design tokens already exist in `core/theme`).
- Models: generate them with `freezed` + `json_serializable` from the DTOs in `packages/shared/src/*.ts` (PostDto, PostTargetDto, MediaDto, ChannelDto, UserDto, Notification, Customer, Group, Scheduler, Run, Lead, Billing). One model file per DTO. Copy the field names exactly. Treat `sizeBytes` as a number and dates as ISO strings.
- Add `connectivity_plus` and an offline banner. Cache the last successful GET of the feed and channels (`shared_preferences` or `drift`) so the app opens instantly offline.
- Error and empty states are consistent widgets.
- Navigation mirrors the web nav groups. Bottom bar: **Home, Schedules, + (composer), Inbox (Comments), More**. "More" lists: Calendar, Customers, Automation, Channels, Media, Analytics, Notifications, Settings. This matches the web sidebar (Publish / Engage / Library / Workspace).

## 3. Phase 3: Channels and OAuth (all 9 platforms)

Platforms (from `PLATFORMS`): x, facebook, instagram, threads, youtube, tiktok, snapchat, linkedin, whatsapp.

- `GET /channels` and `GET /channels/available` (which platforms the server has credentials for). Show unavailable ones disabled, with a "not configured by admin" hint.
- **Connect flow:** `POST /channels/connect/:platform?client=mobile` → `{url}` → open with `flutter_web_auth_2` (`callbackUrlScheme: mehwar`). Backend returns to `mehwar://channels?connected=x` or `mehwar://channels/select?session=…&platform=…`.
  - Backend change: `startConnect` stores `client: 'mobile'` in the Redis state, and `handleCallback`/`callback` redirects to the custom scheme instead of the web origin. Do not change the web path.
- **Account picker** (the web `channels/select` page): `GET /channels/pending/:session` then `POST /channels/pending/:session {externalIds}`. Multi-select list with avatars.
- **Channel detail** (web `channels/[id]`, about 1,460 lines): `GET /channels/:id/details` (profile, stats, recent videos/posts), per-video comments (`GET/POST /channels/:id/videos/:videoId/comments`, `DELETE …/comments/:commentId`), like (`POST …/like`), retweet (`POST …/retweet`). Avatar via `GET /channels/:id/avatar` (public, use `CachedNetworkImage`).
- Disconnect: `DELETE /channels/:id` with a confirm dialog.
- Reconnect / token-expired badge (channel status in the DTO).
- **WhatsApp**: `GET /whatsapp/status`, `POST /whatsapp/connect` (QR code or pairing; render with `qr_flutter`; poll status or listen to SSE), `POST /whatsapp/disconnect`, `POST /whatsapp/status/profile`. Match the behavior of the web `WhatsAppModal` and `WhatsAppSection`.

## 4. Phase 4: Composer (full parity with web `Composer.tsx`)

The current composer only does text, media, and channel selection. Add:

- Per-channel text override (`textOverride`) and a live preview per platform (`PostPreview.tsx`).
- **Validation from the shared rules.** Port `packages/shared/src/platforms.ts` and `validation.ts` to Dart (`PlatformRules`, `validatePost`). Show char counters (X 280 vs extended 25k), media count and type limits, video duration, aspect ratio, and "text-only not allowed". Add a Dart test that loads the same JSON cases as `validation.test.ts`. (Better: export the rules as JSON at build time with a script in `packages/shared` and commit `assets/platform_rules.json` so there is one source of truth.)
- **Per-target options** (`targetOptionsSchema`): YouTube (title, description, privacy, madeForKids, tags, thumbnail from the media library), TikTok (privacy, disableComment/Duet/Stitch, brandContent/brandOrganic), Instagram (FEED/REELS/STORIES), X/Threads thread blocks (explicit split editor), WhatsApp (MESSAGE/STATUS, recipient).
- First comment (`firstComment`, max 2,200).
- **Media tray**: pick from the library or the device (`image_picker`, `file_picker`, camera and video capture). Upload with progress, then cancel and retry, and poll `GET /media/:id` until `READY` (status UPLOADING → PROCESSING → READY/FAILED) or react to the SSE `media.updated` event. Reorder, remove, and set a thumbnail. Request permissions on both platforms (Info.plist `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`; Android 13 media permissions).
- **Schedule:** date/time picker, timezone-aware (`/schedule` with `localDateTime` + `timezone`, see B4), "Next free slot" (`GET /slots/next-free`), Publish now (`POST /posts/:id/publish-now`), Save as draft, plan limit handling.
- **AI panel** (use the existing `ai_service.dart` and `ai_writing_sheet.dart`, verify the paths): `/ai/caption`, `/ai/rewrite`, `/ai/hashtags`, `/ai/ideas`, `/ai/hooks`, `/ai/alt-text`, `/ai/status` (credits and whether it's configured). Longer timeout; insert/replace actions.
- Emoji picker (the system keyboard is fine; add a small `emoji_picker_flutter` for parity).
- **Video editor** (web `VideoEditorModal.tsx`; last commit added it): start with trim only (`video_editor` or `video_trimmer` plugin). Decide whether the web does it client-side (ffmpeg.wasm) or server-side, and read the web implementation before deciding. This is the lowest-priority sub-item. Put it behind Phase 10 if it is hard.
- Edit existing post (`PATCH /posts/:id`), duplicate, **cross-post** a published post to more channels (`POST /posts/:id/cross-post {channelIds, textOverride}`), and **import** (`POST /posts/import`, check what the web `Feed` uses it for).
- Draft autosave locally (`shared_preferences`) so an interrupted compose is not lost.
- **Share/intent receive:** accept images/videos/text from the OS share sheet (`receive_sharing_intent`) and open the composer prefilled.

## 5. Phase 5: Feed, Schedules, Calendar, Post details

- **Home/dashboard** (web `dashboard/page.tsx`): stats cards, upcoming, recent, failures. Status filter chips (DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, PARTIALLY_FAILED, FAILED), channel filter, search, infinite scroll (`GET /posts?status&from&to&limit`; check for cursor support in `posts.controller.ts`).
- **My Schedules** (web `schedules/page.tsx`, 1,250 lines): list/queue view, reschedule (drag in the calendar or a picker), cancel (`/cancel`), retry failed (`/retry`), delete. **Posting slots** CRUD (`GET/POST /slots`, `DELETE /slots/:id`): weekday + minute-of-day picker.
- **Calendar** (existing `calendar_screen.dart`): month/week/agenda; tap a day to compose; long-press a post to reschedule. Show slots as ghost entries.
- **Post detail** (web `posts/[id]`): per-target status and error text, external link to the live post (`url_launcher`), video player (`video_player` + `chewie`) for video posts, comments on that post, actions (retry target, cancel, cross-post, edit, delete). Handle the Instagram video playback work from the recent commit.
- Status badges, color-coded per `platform_brand.dart`.

## 6. Phase 6: Comments inbox, Customers, Automation

- **Comments** (web `comments/page.tsx`, 1,150 lines): `GET /channels/all-comments` (unified inbox, filter by channel/platform/unread), reply, like, retweet, delete; AI "analyze comments" (`POST /ai/analyze-comments`) with a sentiment summary card.
- **Customers** (web `users/page.tsx`): customers CRUD (`/customers`), groups CRUD (`/customers/groups`), import from device contacts (`flutter_contacts`, optional), **share post to customers** by EMAIL/WHATSAPP (`POST /customers/share-post`) with the `CustomerMessagePreviewModal` equivalent (message preview before sending).
- **Automation** (web `automation/page.tsx`, `SchedulersManager`, `ExecutionHistoryViewer`): `GET /automation/overview`, schedulers list + enable/edit (`PATCH /automation/schedulers/:id`), run now (`POST …/run`), run history (`GET /automation/runs`), leads list + status update (`GET/PATCH /automation/leads`). Read `packages/shared/src/automation.ts` for the DTOs.

## 7. Phase 7: Analytics, Media library, Notifications, Real-time

- **Analytics** (existing screen + web `charts.tsx`): ranges 7/30/90 days, `GET /analytics/summary?days=`, `POST /analytics/sync`, per-platform breakdown, top posts, followers over time. **CSV export** `GET /analytics/export.csv` → save with `path_provider` and `share_plus`.
- **Media library** (web `media/page.tsx`): grid with thumbnails, filters (images/videos), detail with the processing status/error, delete (`DELETE /media/:id`), storage usage bar (from billing), "use in composer".
- **Notifications:** list (`GET /notifications`), mark all read (`POST /notifications/read`), unread badge in nav.
- **Live updates via SSE** (`GET /events`): `dio` with `ResponseType.stream`, or `flutter_client_sse`. The Bearer header is required (the web reads it with fetch for the same reason). Port the logic from `web/src/lib/events.ts`: events `post.updated`, `media.updated`, `channel.updated`, `notification`. Reconnect with backoff, pause in the background, resume on foreground (`WidgetsBindingObserver`). The `notification` event shows an in-app banner.
- **Push notifications (new, needs a backend add):** FCM (`firebase_messaging`) + APNs. Backend: `POST /me/devices {token, platform}` stores device tokens, and `NotificationsService` sends a push when it creates a notification (post published/failed, channel needs reconnect, new comment). Mark it as phase 7b so it can ship after everything else.

## 8. Phase 8: Settings, Billing, Account

(Web `settings/page.tsx`, 1,950 lines, has these sections: Billing, AI settings, Networks, WhatsApp, Schedulers, plus Profile, Security, and Privacy modals.)

- **Profile:** `PATCH /me` (name, timezone, avatar if supported). **Security:** `POST /me/password`, list/revoke sessions if the backend exposes them. **Privacy:** data export `GET /me/export` (download and share the JSON file), **delete account** `DELETE /me` (double confirm, typed email).
- **AI settings:** `GET/POST /ai/settings` (provider, model, API key; mask the key), `POST /ai/test-connection`, credits remaining.
- **Billing:** `GET /billing` (plan, usage: channels, scheduled posts, storage, AI credits). Upgrade via `POST /billing/checkout` / manage via `POST /billing/portal` → open the returned URL in an external browser. **Do not use in-app purchases.** Be careful about App Store rules: link out to web billing, or hide the upgrade button on iOS (guideline 3.1.1). Decide with the owner before submission.
- Theme: light/dark/system (the web has `ThemeToggle`). Language and RTL are possible later since "Mehwar" suggests Arabic; keep strings in ARB files (`flutter_localizations`, `intl`) from the start, with English first and Arabic as a stretch.
- About, version, privacy policy and terms links, sign out of all devices.

## 9. Phase 9: Quality

- `flutter analyze` with no warnings; stricter lints.
- Unit tests: models from JSON fixtures captured from production responses, `ApiClient` refresh single-flight, validation port, schedule time conversion (DST edges, same cases as `time.test.ts`).
- Widget tests for the composer states and the auth gate. Integration test (`integration_test`) for login → compose → schedule against a local backend.
- Accessibility: 48dp targets, semantic labels, dynamic type to 200%, contrast (the design doc says WCAG AAA).
- Performance: image caching, list virtualization, no rebuild storms (`Selector`/`context.select`).
- Crash reporting (`sentry_flutter`) and basic analytics opt-in.
- Security: tokens only in `flutter_secure_storage`; no logging of the Authorization header; certificate pinning optional; `android:allowBackup="false"`; obfuscated release builds (`--obfuscate --split-debug-info`).
- CI: GitHub Actions or Jenkins job: `flutter analyze && flutter test`, build the APK/AAB. Repo already has Jenkins config; add a mobile stage.

## 10. Phase 10: Release

- App identifiers: `com.mehwar.flow` (check the Android `applicationId` and the iOS bundle id are consistent), icons and splash (`flutter_launcher_icons`, `flutter_native_splash`), signing configs (keystore and iOS provisioning, which the owner provides).
- Store listings, privacy policy URL, data-safety forms (account deletion in-app is required by both stores; Phase 8 covers it).
- TestFlight and Play internal testing first. Then the video editor if deferred, push notifications (7b), Arabic localization.

---

## Backend change list (collect for one PR on `apps/api`)

1. Mobile refresh token in body/header (`X-Client: mobile`), including logout. (B1)
2. OAuth return to `mehwar://` for `client=mobile` in `startConnect` / `handleCallback`. (B3)
3. Confirm the presigned S3 URL is reachable from the public internet in production. (B5)
4. Optional: `/me/devices` plus push sending. (7b)
5. Optional: expose a cursor on `GET /posts` if it has none. Check first.
CORS is irrelevant for native clients; the bearer token is the only auth.

## Suggested order and sizing

| Phase | Size | Notes |
|-------|------|-------|
| 1 Foundation/auth | M | Do first. It unblocks everything. |
| 2 Architecture | M | Router + models. Do before building screens. |
| 3 Channels/OAuth | L | Needs the backend change B3. |
| 4 Composer | XL | Biggest piece. Split into 4a core (text, media, schedule), 4b per-platform options, 4c AI, 4d editor. |
| 5 Feed/Schedules/Calendar/Post | L | |
| 6 Comments/Customers/Automation | L | |
| 7 Analytics/Media/Notifications/SSE | M | Push is optional (7b). |
| 8 Settings/Billing | M | App Store billing policy decision. |
| 9–10 Quality/Release | M | Run in parallel from Phase 2. |

## Ground rules for the implementing agent

- Read the matching web page and the API controller before building each screen; web is the behavioral spec. The DTOs in `packages/shared/src` are the contract. Do not guess field names.
- Verify each endpoint with `curl` against production (using a test account) before wiring it, and save a sample JSON as a test fixture.
- Never hard-code credentials or tokens. Use test accounts only.
- Keep web behavior unchanged when touching `apps/api`; run `pnpm --filter @mehwar/api test`.
- Don't edit `packages/shared` for mobile reasons without checking web compatibility.
