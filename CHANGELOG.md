# CHANGELOG

<!-- version list -->

## v1.0.4 (2026-03-27)

### Bug Fixes

- **cd**: Inject npm version from PSR outputs instead of version_pattern
  ([`1203da4`](https://github.com/n24q02m/mcp-relay-core/commit/1203da48009fbdfb7049176f53ee5d1b02a42240))


## v1.0.3 (2026-03-27)

### Bug Fixes

- **cd**: Add config_file to PSR action + sync versions to 1.0.2
  ([`2098246`](https://github.com/n24q02m/mcp-relay-core/commit/209824636b2cf2e0b57233cda57bbbc17e2c2789))

- **ci**: Consolidate SMTP_USERNAME+PASSWORD into SMTP_CREDENTIAL
  ([`ca49c29`](https://github.com/n24q02m/mcp-relay-core/commit/ca49c294b496a52a0e355790aa94abf38ff3102d))


## v1.0.2 (2026-03-27)

### Bug Fixes

- **ci**: Replace GEMINI_API_KEY with Vertex AI WIF + remove CODECOV_TOKEN
  ([`809c016`](https://github.com/n24q02m/mcp-relay-core/commit/809c016dbf5522eb082dfda2ae333edfb09cdd19))

- **release**: Fix PSR version_pattern for JSON files + sync versions to 1.0.1
  ([`c2dd330`](https://github.com/n24q02m/mcp-relay-core/commit/c2dd330d9c1afd71db6bd7121b7fd8ec683f30fe))


## v1.0.1 (2026-03-27)

### Bug Fixes

- **cd**: Make npm publish idempotent for re-runs
  ([`1313e1e`](https://github.com/n24q02m/mcp-relay-core/commit/1313e1e8aeac7f97e2a7ca3e6b484d15d87bb0f3))


## v1.0.0 (2026-03-27)

### Bug Fixes

- Code block styling for light mode relay pages
  ([`2472f1e`](https://github.com/n24q02m/mcp-relay-core/commit/2472f1e65332e2439756b136fe9567dc4d3e95b0))

- Keep relay session alive for bidirectional messaging
  ([`2e0f577`](https://github.com/n24q02m/mcp-relay-core/commit/2e0f5770d0aebf0345333ee975660f9664861e38))

- Match OAuth device code field names in UI renderer
  ([`5bb77b8`](https://github.com/n24q02m/mcp-relay-core/commit/5bb77b808b57e97b73638a06985c3b4c45030619))

- Pin Docker base images to SHA digests
  ([`a71cbb8`](https://github.com/n24q02m/mcp-relay-core/commit/a71cbb8bbcb54ce049c04e92c97b8c41f4b29276))

- Pin pre-commit hooks to commit SHA
  ([`a240efd`](https://github.com/n24q02m/mcp-relay-core/commit/a240efd6db0f95ba3958adc7740a14da5586967d))

- Read encrypted result from body.result in relay clients
  ([`3a8497a`](https://github.com/n24q02m/mcp-relay-core/commit/3a8497a373398d78900b15cdfb15170d9e6618e4))

- Replace atob with pure JS base64 decoder
  ([`3b25af2`](https://github.com/n24q02m/mcp-relay-core/commit/3b25af2c47efc31845d5620134720db23d4f2208))

- Split rate limits — relaxed for polling, strict for mutations
  ([`c6cb7ff`](https://github.com/n24q02m/mcp-relay-core/commit/c6cb7ff6aad2b85a98fa28d9fc7e2b8fe9e80be5))

- **cd**: Remove empty env blocks from OIDC migration
  ([`bfeda4d`](https://github.com/n24q02m/mcp-relay-core/commit/bfeda4d1577c3579cb6e755d08e5a1a5740481a2))

- **cd**: Replace GH_PAT/NPM_TOKEN/PYPI_TOKEN with GitHub App + OIDC
  ([`bbab64b`](https://github.com/n24q02m/mcp-relay-core/commit/bbab64bd215cd70ec8b5b49c068b7fbd7bfbecb9))

### Chores

- Standardize package metadata, READMEs, Docker config
  ([`5c579c8`](https://github.com/n24q02m/mcp-relay-core/commit/5c579c8da36f384fa9d6a4fc4fc0c58b5c40315c))

### Continuous Integration

- Add PSR, ty check, Semgrep SAST, best practices
  ([`8b56d4b`](https://github.com/n24q02m/mcp-relay-core/commit/8b56d4b0186bf2193323ea03963364a430b157a0))

### Features

- Add skip button to relay setup pages
  ([`c0bf292`](https://github.com/n24q02m/mcp-relay-core/commit/c0bf2920cd5b90188e1bec0e0168389955a88a18))

- Bidirectional relay messaging for OAuth and 2FA flows
  ([`162a5d3`](https://github.com/n24q02m/mcp-relay-core/commit/162a5d30df8af56aa68c8124c4ad145ecca2ec50))

- **email**: Multi-account relay setup form
  ([`cc15b76`](https://github.com/n24q02m/mcp-relay-core/commit/cc15b76069b3019262bb4889edc1cb9c3f9af430))


## v0.1.0 (2026-03-25)

- Initial Release
