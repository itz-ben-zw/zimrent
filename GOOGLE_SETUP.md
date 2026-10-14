# Google Sign-In Setup (Google Identity Services token flow)

The site uses `google.accounts.oauth2.initTokenClient()` (see `js/auth.js`,
`handleGoogleLogin()`). This flow checks **Authorized JavaScript origins** only —
redirect URIs are not used and do not need to be configured.

## Google Cloud Console steps

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Find the OAuth 2.0 Client ID for the **Web application** whose ID matches
   `GOOGLE_CLIENT_ID` in `js/auth.js`
   (`264173024062-...apps.googleusercontent.com`).
   If you have multiple client IDs, editing the wrong one is the most common
   cause of persistent errors.
3. Under **Authorized JavaScript origins**, add exactly these (no trailing
   slash, no path, `http`/`https` and port must match your address bar):

   | Origin | Used for |
   |---|---|
   | `https://homify-nust.onrender.com` | Live production site |
   | `http://localhost:3001` | Local dev (site served by the Express server) |
   | `http://localhost:5500` | VS Code Live Server (optional) |

4. Click **Save**. Google can take a few minutes to propagate changes.
5. Test in a fresh browser window on the live site (old popups/tab state can
   keep showing the cached error).

## Troubleshooting

- **`Error 400: origin_mismatch`** — the page's origin is not in the authorized
  list above. Expand "Request details" on the Google error screen and compare
  the `origin=` value character-for-character with what's configured
  (scheme, subdomain, port, no trailing slash).
- **`Error 401: invalid_client`** — wrong or deleted client ID, or the client
  belongs to a different Google Cloud project.
- Do not confuse this with redirect-URI errors: this flow never sends a
  redirect URI, so adding one has no effect here.

## Server side

`js/auth.js` posts the Google profile (`email`, `sub`, `name`, `picture`) to
`POST /api/auth/google`, which creates or logs in the user and issues a JWT.
No Google secret is needed on the server for this flow; just make sure the
`FRONTEND_URL`/CORS settings on the server allow the live origin.
