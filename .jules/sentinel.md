## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.## 2025-05-14 - Insufficient Rate Limiting IP Resolution
**Vulnerability:** Rate limiting can be bypassed if the server does not correctly resolve the client's real IP address when deployed behind a proxy.
**Learning:** Hardcoding `app.set('trust proxy', 1)` only works for a single-hop proxy and may be incorrect for other environments (e.g., direct internet exposure or multi-hop proxies).
**Prevention:** Make the `trust proxy` configuration adjustable via environment variables to match the specific deployment architecture.
