## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## 2025-05-15 - [SECURITY] Weak PBKDF2 Iteration Count
**Vulnerability:** Use of 100,000 PBKDF2 iterations for key derivation, which is below modern recommended standards (e.g., OWASP recommends 600,000 for SHA-256).
**Learning:** Hardcoded cryptographic parameters should be periodically reviewed against current industry standards. While 100,000 was once acceptable, increasing compute power makes it vulnerable to brute-force attacks on modern hardware.
**Prevention:** Increase default iteration count to 1,000,000. Implement robust multi-tier fallback and automatic migration logic in the storage layer to allow security upgrades without breaking user access to legacy encrypted data.
