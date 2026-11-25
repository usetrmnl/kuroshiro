# An optional admin password guards the admin UI and API

The admin API had no authentication (ADR-0075, `docs/ui/instance.md`), on the assumption that only the admin reaches it. An Instance on a shared network or the internet had no way to say otherwise. Issue #1806.

- **`KUROSHIRO_ADMIN_PASSWORD` turns it on.** Unset or empty, Kuroshiro is open exactly as before. The password is never stored in the database, never an Instance Setting and never in a Configuration Archive; a forgotten one is fixed by editing the environment and restarting. There is no username: there is one admin.
- **The browser signs in on a page of the admin UI.** `POST /api/auth/login` answers a correct password with an HttpOnly, `SameSite=Strict` cookie, `Secure` when the request arrived over HTTPS (or `X-Forwarded-Proto: https`). A wrong password is `401` with the code `wrong-password`. `POST /api/auth/logout` clears the cookie.
- **The cookie is stateless.** It carries its expiry (30 days) and an HMAC signature by a key derived from the password, so it survives a restart and changing the password signs every browser out.
- **A script sends `Authorization: Bearer <password>`**, accepted beside the cookie. There is no separate API token.
- **What stays open is what is marked `OutsideAdminApi`** (ADR-0075): `/api/display`, `/api/current_screen`, `/api/setup`, `/api/log`, `/api/webhook/*`, `/metrics` and `/health`, plus the image files a Device downloads and the admin UI's own bundle, which Express serves outside the Nest guards. Every other route answers `401` with the code `sign-in-required`. The one marker decides this and the cross-site exemption, so a route cannot be outside one and inside the other. `/metrics` stays unauthenticated as ADR-0026 decided. The login and logout routes carry a marker of their own, `OpenToSignIn`, and stay inside the cross-site check.
- **Guessing is slowed in the API's process.** After 5 wrong passwords from one address within a minute, further tries answer `429` with `too-many-sign-in-attempts` until the minute is over, on the login route and on Bearer requests alike. The password is compared in constant time, as Device API keys are. The address is the one Express sees, so behind a reverse proxy without `trust proxy` every client shares the proxy's address.
- **ADR-0075's cross-site guard stays as it is**, password or not. Demo mode has no special case.
- **The Instance facts say whether a password is set** (`adminPasswordSet`), so the UI shows "Sign out" and the Instance page can say the admin UI is open when none is.

## Consequences

- `/api/setup` hands a registered Device's API key to whoever sends its MAC address. That is a firmware-protocol question and stays out of this decision.
- The counters live in memory: a restart forgets them, and two API processes would each count.
- Additive: an Instance that sets nothing behaves as before.
