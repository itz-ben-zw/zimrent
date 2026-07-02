# Google Sign-In Setup

1. Open Google Cloud Console → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** for a **Web application**.
3. Add **Authorized JavaScript origins**:
   - `https://zimrent.onrender.com`
4. In `website/js/auth.js`, replace the Google client ID in `handleGoogleLogin()` with your real client ID.
5. Redeploy the site.

If you see `Error 401: invalid_client`, the most common cause is an origin or redirect mismatch on Google’s side.