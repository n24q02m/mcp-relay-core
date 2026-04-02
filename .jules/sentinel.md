## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## 2026-04-02 - Production Information Leakage via Debug Logs
**Vulnerability:** Debug  statements in production frontend code can leak internal state and diagnostic information (e.g. key lengths, passphrase status) that are only intended for development. While not a direct exploit, this provides unnecessary metadata to potential attackers and clutters the production environment.
**Learning:** Production-ready code must be stripped of all development-only logs.  remains appropriate for reporting runtime failures, but informational diagnostic logs should be removed or conditionally enabled behind a debug flag.
**Prevention:** Use a linter (like Biome or ESLint) with rules to detect or automatically remove  in production builds. Always review and strip debug statements before finalizing a feature or fix.

## 2026-04-02 - Production Information Leakage via Debug Logs
**Vulnerability:** Debug `console.log` statements in production frontend code can leak internal state and diagnostic information (e.g. key lengths, passphrase status) that are only intended for development. While not a direct exploit, this provides unnecessary metadata to potential attackers and clutters the production environment.
**Learning:** Production-ready code must be stripped of all development-only logs. `console.error` remains appropriate for reporting runtime failures, but informational diagnostic logs should be removed or conditionally enabled behind a debug flag.
**Prevention:** Use a linter (like Biome or ESLint) with rules to detect or automatically remove `console.log` in production builds. Always review and strip debug statements before finalizing a feature or fix.
