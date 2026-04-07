## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## 2025-05-15 - Overly Permissive CORS Configuration
**Vulnerability:** The relay server defaulted to `CORS_ORIGIN=*`, allowing any website to make cross-origin requests to the API.
**Learning:** Defaulting to permissive security settings (like `*` for CORS) in middle-tier components can expose them to CSRF and data leakage if not explicitly overridden by the operator.
**Prevention:** Always use secure-by-default configurations (e.g., `origin: false` or a whitelist) and provide explicit warnings when insecure configurations (like `*`) are detected in production environments.
