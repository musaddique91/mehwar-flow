# Connecting the social networks

Mehwar Flow talks to each network through **your own developer app**. A network appears as
"Connect" in the app as soon as its two env vars are set in `.env`. Restart the stack after editing:

```bash
docker compose up -d api worker
```

## Before you start: two public URLs

Two URLs must work before you connect any network.

### 1. OAuth callback URL

Every network redirects back to:

```
<WEB_ORIGIN>/api/channels/callback/<platform>
```

On a normal local install, both `http://localhost:3000` and `https://localhost:3000` work simultaneously.
Many networks refuse `http://` or plain `localhost` callbacks (Meta, Threads and TikTok all require HTTPS).
For those, Mehwar Flow serves both HTTP and HTTPS on port 3000:
- You can use `https://localhost:3000/api/channels/callback/threads` directly in the developer portal!
- Or, if you need a publicly accessible tunnel from the internet, you can use a Cloudflare tunnel:
  ```bash
  cloudflared tunnel --url http://localhost:3000     # prints https://<random>.trycloudflare.com
  ```
Mehwar Flow automatically handles CORS and cookies dynamically for both HTTP and HTTPS origins.

### 2. Public media URL

Instagram, Facebook, Threads and TikTok download your photos and videos from our storage. So
`S3_PUBLIC_URL` must be reachable **from the internet**, not just from your browser.

- For local testing, run a second tunnel to `http://localhost:9000` and put that URL in
  `S3_PUBLIC_URL`.
- In production, use your own HTTPS domain, e.g. `https://media.example.com` in front of MinIO.
- TikTok only pulls from a **verified domain**. Add your media domain under
  _TikTok developer portal → your app → URL properties_ and verify it.

MinIO accepts browser uploads from any origin by default. If you tightened MinIO CORS, allow your
`WEB_ORIGIN`.

---

## X (Twitter)

1. Go to <https://developer.x.com> → Projects & Apps and create an app. Posting through the API
   needs a **paid** plan (Basic or higher).
2. Open _User authentication settings_:
   - App permissions: **Read and write**.
   - Type of app: **Web App** (confidential client).
   - Callback URI: `<WEB_ORIGIN>/api/channels/callback/x`.
3. Open _Keys and tokens_, then the _OAuth 2.0 Client ID and Client Secret_ section, and copy
   them into `.env`:
   ```
   X_CLIENT_ID=...
   X_CLIENT_SECRET=...
   ```

Scopes requested: `tweet.read tweet.write users.read media.write offline.access`.

## Facebook Pages and Instagram (one Meta app)

1. Go to <https://developers.facebook.com>, create an app of type **Business**, and add the
   **Facebook Login for Business** product.
2. _Facebook Login → Settings → Valid OAuth Redirect URIs_: add both
   - `<WEB_ORIGIN>/api/channels/callback/facebook`
   - `<WEB_ORIGIN>/api/channels/callback/instagram`
3. Copy _App settings → Basic → App ID / App secret_ into `.env`:
   ```
   META_CLIENT_ID=...
   META_CLIENT_SECRET=...
   ```
4. Permissions used:
   - Facebook: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
     `business_management`.
   - Instagram adds: `instagram_basic`, `instagram_content_publish`,
     `instagram_manage_comments`, `instagram_manage_insights`.

   In development mode only people with a role on the app can connect. Going public requires
   **App Review** for each permission.

5. Your Instagram account must be a **Business or Creator** account **linked to a Facebook Page**
   you manage.

## Threads

1. Create a Meta app with the **Threads API** use case. It is separate from the Facebook/Instagram
   app above.
2. Redirect callback URL: `<WEB_ORIGIN>/api/channels/callback/threads`.
3. Copy the Threads app ID and secret into `.env`:
   ```
   THREADS_CLIENT_ID=...
   THREADS_CLIENT_SECRET=...
   ```

Scopes requested: `threads_basic`, `threads_content_publish`, `threads_manage_insights`.

## YouTube (Google)

1. In <https://console.cloud.google.com>, create a project and enable **YouTube Data API v3**.
2. Set up the _OAuth consent screen_:
   - User type: External.
   - Add the scopes `youtube.upload` and `youtube.readonly`.
   - Add your Google account as a test user.
3. Create credentials: _OAuth client ID_, type **Web application**, with the authorized redirect
   URI `<WEB_ORIGIN>/api/channels/callback/youtube`.
4. Copy them into `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

Notes:

- Until Google verifies the app and YouTube's API audit passes, uploaded videos are forced to
  **private**.
- The default quota (10,000 units/day) allows about 6 uploads per day.

## TikTok

1. Go to <https://developers.tiktok.com>, create an app, and add the **Login Kit** and
   **Content Posting API** products (with _Direct Post_).
2. Redirect URI: `<WEB_ORIGIN>/api/channels/callback/tiktok`.
3. Scopes: `user.info.basic`, `user.info.stats`, `video.publish`, `video.upload`, `video.list`.
4. Verify your media domain (see "Public media URL" above).
5. Copy them into `.env`. TikTok calls the ID the "client key":
   ```
   TIKTOK_CLIENT_ID=<client key>
   TIKTOK_CLIENT_SECRET=...
   ```

Until TikTok audits the app, only **"Only me" (SELF_ONLY)** posts are allowed. Mehwar Flow shows
this in the composer.

## LinkedIn

1. Go to <https://www.linkedin.com/developers/apps> and click **Create App**.
2. Enter your App name, link your LinkedIn Company Page, and upload an app logo.
3. Open the **Products** tab and request access to:
   - **Share on LinkedIn** (enables publishing member updates via `w_member_social`).
   - **Sign In with LinkedIn using OpenID Connect** (enables user profile info via `openid`, `profile`, `email`).
4. Open the **Auth** tab, expand **OAuth 2.0 settings**, and add your Authorized Redirect URL:
   ```
   <WEB_ORIGIN>/api/channels/callback/linkedin
   ```
   (e.g. `http://localhost:3000/api/channels/callback/linkedin` for local development).
5. Copy the Client ID and Primary Client Secret into your `.env`:
   ```env
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   ```
6. Restart the stack (`api` and `worker`). Both personal member profiles and organization company pages (where you have administrator access) will be discovered and connectable.

## Snapchat (partner access only)

Normal posting to a Snapchat Public Profile needs Snap's partner-only Public Profile API. Snap Kit
Login works for anyone, but publishing needs Snap to grant access and give you an endpoint.

```
FEATURE_SNAPCHAT=true
SNAPCHAT_CLIENT_ID=...
SNAPCHAT_CLIENT_SECRET=...
SNAPCHAT_PUBLISH_URL=<endpoint provided by Snap>
```

Redirect URI: `<WEB_ORIGIN>/api/channels/callback/snapchat`.

---

## AI assistant

Set `ANTHROPIC_API_KEY` (from <https://console.anthropic.com>). The default model is
`claude-opus-5-5`; change it with `AI_MODEL`. Each generation uses one AI credit from your plan.

## Billing (Stripe)

Leave these empty for a self-hosted install; every account then gets unlimited usage.

To charge for plans:

1. Create two recurring **Prices** in Stripe (Pro and Business) and set `STRIPE_PRICE_PRO` and
   `STRIPE_PRICE_BUSINESS`.
2. Set `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint `<WEB_ORIGIN>/api/billing/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

4. Enable the **Customer portal** in Stripe settings.

For local testing: `stripe listen --forward-to localhost:4000/billing/webhook`.

## Troubleshooting

| Symptom                                                                  | Fix                                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| "Not set up on this server yet" on a network                             | Both `*_CLIENT_ID` and `*_CLIENT_SECRET` must be set; restart `api` and `worker`.                        |
| Redirected back with "redirect_uri mismatch"                             | The callback in the developer portal must match `<WEB_ORIGIN>/api/channels/callback/<platform>` exactly. |
| Instagram, TikTok or Threads post fails: "media could not be downloaded" | `S3_PUBLIC_URL` isn't reachable from the internet (or the domain isn't verified for TikTok).             |
| Channel shows "Needs reconnecting"                                       | The token expired or was revoked. Click **Reconnect** on the Channels page.                              |
| Any "Something went wrong" error                                         | `docker compose logs api worker` shows the full error with a request id.                                 |
| Watching the job queues                                                  | Set `ADMIN_USER` and `ADMIN_PASSWORD`, then open <http://localhost:4000/admin/queues>.                   |
