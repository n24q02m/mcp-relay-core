## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## 2024-05-19 - Hardcoded 'trust proxy' in Relay Server
**Vulnerability:** The Express application had a hardcoded `app.set('trust proxy', 1)`, which blindly trusts the first hop in the `X-Forwarded-For` header. This is dangerous if the server is exposed directly to the internet, as an attacker could spoof their IP address to bypass rate limits.
**Learning:** IP-based rate limiting depends on accurate client IP resolution. Blindly trusting proxy headers without knowing the deployment topology is a security risk.
**Prevention:** Always drive 'trust proxy' configuration from environment variables, defaulting to un-trusted (false) to prevent IP spoofing in non-proxied environments.
