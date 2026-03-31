## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## $(date +%Y-%m-%d) - Rate Limiting IP Spoofing Prevention
**Learning:** Hardcoding `app.set('trust proxy', 1)` in Express exposes the application to IP spoofing via `X-Forwarded-For` headers when it is not deployed behind a reverse proxy. This allows attackers to easily bypass IP-based rate limiting (like `express-rate-limit` or custom session counters).
**Action:** Always configure `trust proxy` dynamically via an environment variable (e.g., `TRUST_PROXY`), defaulting to `false` or un-trusted to ensure secure-by-default behavior across different deployment environments.
