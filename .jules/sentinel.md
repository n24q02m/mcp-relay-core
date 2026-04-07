## 2024-05-18 - Missing Security Headers in Relay Server API
**Vulnerability:** The Express API (`packages/relay-server`) lacked essential HTTP security headers like `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
**Learning:** Despite the unique zero-knowledge architecture (where sensitive data is encrypted by the client and not readable by the server), defense in depth remains important. Even opaque APIs could be subject to MIME sniffing or clickjacking if served without appropriate headers.
**Prevention:** Always use the `helmet` package to apply a baseline set of security headers on Express servers, even those not directly serving HTML pages.
## 2024-05-18 - Unauthenticated CI/CD Publish Steps
**Vulnerability:** The automated release pipeline (`.github/workflows/cd.yml`) included steps to publish packages to npm and PyPI but lacked the necessary authentication tokens (secrets), which would have caused deployments to fail or, if configured with insecure defaults, could have led to unauthorized or failed package distribution.
**Learning:** Automated publishing requires explicit secret injection (e.g., `NODE_AUTH_TOKEN` for npm and `UV_PUBLISH_TOKEN` for PyPI). Relying on environment variables being globally available in the CI environment is insecure and often incorrect for restricted-scope publishing.
**Prevention:** Always verify that every CI job interacting with external registries (npm, PyPI, Docker Hub) has the required secrets explicitly mapped as environment variables in the workflow YAML.
