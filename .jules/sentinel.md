## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## 2025-05-22 - Session Indexing Correctness
**Learning:** When implementing secondary indexes for rate limiting (e.g., sessions per IP), it is critical to ensure expired sessions are correctly excluded and removed. Failure to do so could lead to incorrect rate limiting or memory leaks.
**Action:** Perform opportunistic cleanup of expired entries during index traversal to ensure both accuracy and efficiency.
