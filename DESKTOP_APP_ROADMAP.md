# ZimRent Desktop-First Roadmap

## Product direction

ZimRent will serve both public renters and the people managing the marketplace. The desktop app is the next client to plan and build; the native mobile app is intentionally deferred until the web/API and desktop experience are stable.

## Target architecture

```text
Public website ─────┐
Desktop application ├── HTTPS API ── PostgreSQL
Future mobile app ──┘
                         └── Shared authentication, listings,
                             applications, conversations and moderation
```

All clients must use the existing server API. Do not create a second database or duplicate business rules in the desktop app. Keep privileged admin operations on the server and enforce authorization there, not just by hiding UI controls.

## Desktop app scope

### Public and renter experience
- Browse and search approved rental listings.
- Open listing details and view photos/contact information.
- Register and sign in.
- Save favourites and submit rental applications.
- Message landlords through the existing conversations API.
- Manage the renter profile and application status.

### Landlord and management experience
- Create and edit listings, upload photos, and see listing moderation status.
- Review applications and respond to conversations.
- Provide a separate admin-only management area for user moderation, listing verification, reports and marketplace statistics.
- Ensure ordinary landlords cannot access administrator-only functions.

## Delivery sequence

1. **Stabilize the existing product:** inspect API routes, schema/migrations, authorization, uploads, authentication and deployment configuration. Preserve the existing administrator account.
2. **Add repeatable checks:** automated unit/API tests, syntax checks and a CI workflow. Use a dedicated test database, never the production database.
3. **Make the API a reliable contract:** document routes and error responses; ensure query failures are not silently converted to missing records or empty lists.
4. **Finish the web experience:** confirm core flows work end-to-end against a staging deployment.
5. **Build the desktop client:** reuse the existing HTML/CSS/JavaScript where practical, with a thin desktop shell and the same API. Evaluate Electron first for the lowest-friction reuse of the current web stack; compare Tauri before committing to packaging.
6. **Package and test:** signed/reproducible builds where possible, secure update strategy, login/session expiry, deep links, network failure handling and Windows installation testing.
7. **Build mobile later:** prioritize Android first unless product usage or testing shows a strong reason to launch Android and iPhone together.

## Release gates

- No unresolved critical/high security issues.
- Automated tests cover registration/login, admin authorization, listing lifecycle, applications, favourites and conversations.
- Staging smoke test passes against a non-production database.
- No secrets are bundled into the desktop client.
- The original admin account remains intact; no production migration or PR merge happens without explicit approval.

## Current status

- Existing repair work is on `security/hardening-pass-1` and PR #1. It is not merged into `main`.
- Phone OTP verification now normalizes formatted numbers consistently with OTP sending.
- Database read-query failures now propagate to API error handling rather than being disguised as missing rows or empty results.
- Automated tests and CI still need to be established and run. These changes have not yet been validated against a live/staging deployment.
