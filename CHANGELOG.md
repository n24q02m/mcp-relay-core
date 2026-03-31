# CHANGELOG

<!-- version list -->

## v1.2.0 (2026-03-31)

### Bug Fixes

- Improve relay form error handling ([#43](https://github.com/n24q02m/mcp-relay-core/pull/43),
  [`14a2dbf`](https://github.com/n24q02m/mcp-relay-core/commit/14a2dbf7b220402baa8e781ac91db49d8da94eb3))

- Improve relay form error handling for empty error messages
  ([#43](https://github.com/n24q02m/mcp-relay-core/pull/43),
  [`14a2dbf`](https://github.com/n24q02m/mcp-relay-core/commit/14a2dbf7b220402baa8e781ac91db49d8da94eb3))

- Improve relay page error handling and add submit retry
  ([`8487e50`](https://github.com/n24q02m/mcp-relay-core/commit/8487e500d3f4fd52878281554b2cb274576d5c11))

- Reduce static file cache from 30d to 1h, no-cache for HTML
  ([`7aa33b3`](https://github.com/n24q02m/mcp-relay-core/commit/7aa33b398a28f0eff8e942770a43fc138cea85d0))

- Remove app-level credentials from Telegram relay form
  ([#43](https://github.com/n24q02m/mcp-relay-core/pull/43),
  [`14a2dbf`](https://github.com/n24q02m/mcp-relay-core/commit/14a2dbf7b220402baa8e781ac91db49d8da94eb3))

- Remove app-level credentials from Telegram relay form
  ([#42](https://github.com/n24q02m/mcp-relay-core/pull/42),
  [`f85b4cd`](https://github.com/n24q02m/mcp-relay-core/commit/f85b4cd81512b634ab6572526c218ea56857c41e))

- Robust key import with validation and atob fallback
  ([#44](https://github.com/n24q02m/mcp-relay-core/pull/44),
  [`28dae9e`](https://github.com/n24q02m/mcp-relay-core/commit/28dae9e33bad81d7c53c9c80ac6951a2b79e7499))

### Chores

- Add SECURITY.md
  ([`d2359c5`](https://github.com/n24q02m/mcp-relay-core/commit/d2359c5f5db68908c0dded6afc9e7b74e0651780))

### Continuous Integration

- Fix Qodo vertex_ai config, VERTEXAI_LOCATION, and renovate rules
  ([`60dbdd0`](https://github.com/n24q02m/mcp-relay-core/commit/60dbdd00acbd43e3f92af22d64b26864cf426a9f))

### Features

- Make rate limits configurable via env vars
  ([`b73a67b`](https://github.com/n24q02m/mcp-relay-core/commit/b73a67bd5e0249b1094a0ff27a1fb7f1bc916ef8))


## v1.2.0-beta.3 (2026-03-31)

### Chores

- **deps**: Update dependency @biomejs/biome to ^2.4.10
  ([#25](https://github.com/n24q02m/mcp-relay-core/pull/25),
  [`b280263`](https://github.com/n24q02m/mcp-relay-core/commit/b280263aa198289498b402724828c6dd9ce6a746))

- **deps**: Update vitest monorepo to ^4.1.2
  ([#28](https://github.com/n24q02m/mcp-relay-core/pull/28),
  [`00dc102`](https://github.com/n24q02m/mcp-relay-core/commit/00dc102297c9e3e68482c135e0aaed0c12728259))

### Features

- Add renderCapabilityInfo to shared UI for priority-chain display
  ([`078e852`](https://github.com/n24q02m/mcp-relay-core/commit/078e8525b394c099fc040d71040d23eba849c72b))

- **crg**: Add capability info to relay form
  ([`51ab5db`](https://github.com/n24q02m/mcp-relay-core/commit/51ab5db8ae80ca79928a8533b34d797059dea81c))

- **mnemo**: Capability-based relay form with priority info
  ([`dc1a1fd`](https://github.com/n24q02m/mcp-relay-core/commit/dc1a1fddec0cbe73f2b43b22d1844e62d20dfc5f))

- **wet**: Capability-based relay form with priority info
  ([`fa17b06`](https://github.com/n24q02m/mcp-relay-core/commit/fa17b064b4fca2b1b892b2aca5aaf9304c74fa53))


## v1.2.0-beta.2 (2026-03-30)

### Bug Fixes

- **relay-server**: Enable trust proxy for correct rate limiting behind reverse proxy
  ([`f26ec1a`](https://github.com/n24q02m/mcp-relay-core/commit/f26ec1abd5b8e4af27f5241225b08c2bce29346d))


## v1.2.0-beta.1 (2026-03-30)

### Bug Fixes

- Improve accessibility of dynamically generated inputs in UI
  ([#23](https://github.com/n24q02m/mcp-relay-core/pull/23),
  [`b82cefe`](https://github.com/n24q02m/mcp-relay-core/commit/b82cefef3bcee35da4712753d0a8d6f33570fd67))

- **ci**: Pin action SHAs, upgrade codecov v6, setup-uv v7, semgrep SHA
  ([`b962596`](https://github.com/n24q02m/mcp-relay-core/commit/b96259642394dc4f4f2b9e26ce8fd63f4397cdd0))

### Chores

- Add Infisical project configuration
  ([`d46ca15`](https://github.com/n24q02m/mcp-relay-core/commit/d46ca1589fbd3d561bb519b842d0d3e1dd161f04))

- Remove godot relay page (relay removed from godot-mcp)
  ([`693d256`](https://github.com/n24q02m/mcp-relay-core/commit/693d256c7ee3b4160a1afae159b3d69adb388c55))

- **deps**: Update dependency @biomejs/biome to ^2.4.9
  ([#15](https://github.com/n24q02m/mcp-relay-core/pull/15),
  [`9ac7e0d`](https://github.com/n24q02m/mcp-relay-core/commit/9ac7e0d3602961cc9d5355db2f2b6607019173f7))

- **deps**: Update dependency pytest to >=9.0.2
  ([#16](https://github.com/n24q02m/mcp-relay-core/pull/16),
  [`a4d6682`](https://github.com/n24q02m/mcp-relay-core/commit/a4d6682a0a0eb29d2f6539fc812b4bf68fb6d872))

- **deps**: Update dependency pytest-asyncio to >=1.3.0
  ([#17](https://github.com/n24q02m/mcp-relay-core/pull/17),
  [`aa9cc3e`](https://github.com/n24q02m/mcp-relay-core/commit/aa9cc3ec77313240fd8efc5760872eaf1ad2bc5b))

- **deps**: Update dependency ruff to >=0.15.8
  ([#19](https://github.com/n24q02m/mcp-relay-core/pull/19),
  [`7c03b51`](https://github.com/n24q02m/mcp-relay-core/commit/7c03b51630fc60868a67adf1335f75be772eb8a3))

### Documentation

- Fix CLAUDE.md discrepancies
  ([`7caad84`](https://github.com/n24q02m/mcp-relay-core/commit/7caad84212b5da1f4bf4df9a006b7d11c28de42b))

- Fix root-level commands and session limit in CLAUDE.md
  ([`ef6172d`](https://github.com/n24q02m/mcp-relay-core/commit/ef6172d14a4ab752605f4851a758598ba2dd050a))

### Features

- Add Helmet to relay-server API for baseline security headers
  ([#24](https://github.com/n24q02m/mcp-relay-core/pull/24),
  [`76a3a2e`](https://github.com/n24q02m/mcp-relay-core/commit/76a3a2e7170e3fbe7298f58e956da51a5967c333))

- Process large arrays in chunks for base64 encoding
  ([#22](https://github.com/n24q02m/mcp-relay-core/pull/22),
  [`2384686`](https://github.com/n24q02m/mcp-relay-core/commit/23846864e2c91bc19bba46ff78c4a1866bb026e8))


## v1.1.0 (2026-03-28)

### Chores

- **deps**: Update dependency cryptography to v46.0.6 [security]
  ([`c6638c8`](https://github.com/n24q02m/mcp-relay-core/commit/c6638c8010a5b7a641f86b28229d7832aa05c296))

### Features

- Optimize base64 decoding ([#11](https://github.com/n24q02m/mcp-relay-core/pull/11),
  [`50becc5`](https://github.com/n24q02m/mcp-relay-core/commit/50becc5287e8ed9e2963826617cda0ea8ad22678))

- Optimize base64 encoding and decoding for large payloads
  ([#11](https://github.com/n24q02m/mcp-relay-core/pull/11),
  [`50becc5`](https://github.com/n24q02m/mcp-relay-core/commit/50becc5287e8ed9e2963826617cda0ea8ad22678))

### Testing

- Update session IP limit test to match MAX_SESSIONS_PER_IP=10
  ([`11dcf31`](https://github.com/n24q02m/mcp-relay-core/commit/11dcf31668d3d69bebe3b96969995eb9804625c6))


## v1.0.8 (2026-03-28)

### Bug Fixes

- **pages**: Fetch form fields from session schema for wet/mnemo/notion
  ([`fcf8b34`](https://github.com/n24q02m/mcp-relay-core/commit/fcf8b3402c343f14bab0a9b109b382de947cdde0))


## v1.0.7 (2026-03-28)

### Bug Fixes

- **pages**: Fetch CRG form fields from session schema instead of hardcoding
  ([`06f4fa8`](https://github.com/n24q02m/mcp-relay-core/commit/06f4fa87d9b81acf8205cfa67157e3d4a9ef8c26))


## v1.0.6 (2026-03-28)

### Bug Fixes

- Resolve CI failures — ty types, biome lint, semgrep XSS
  ([`73be17c`](https://github.com/n24q02m/mcp-relay-core/commit/73be17c202fb98d20cb8a0940d69388d60ba70a7))

- Ruff import sort + TS test for no-delete-on-success behavior
  ([`6025661`](https://github.com/n24q02m/mcp-relay-core/commit/6025661d528472402b5389c580228f42b3ac7c9a))

- Update tests for no-delete-on-success and split rate limits
  ([`2b759ce`](https://github.com/n24q02m/mcp-relay-core/commit/2b759ce061907c09a4b6e8744a6ab6c8d5a63e42))

- **pages**: Hide number input spinner/scrollbar on relay forms
  ([`1dd5791`](https://github.com/n24q02m/mcp-relay-core/commit/1dd5791f917f9a464d75f70496f1de1201b51dbd))

- **pages**: Improve input_required handling in message polling
  ([`2b8c13a`](https://github.com/n24q02m/mcp-relay-core/commit/2b8c13ab2479f79eec1251d04f0e9e44bd53a179))

- **pages**: Improve input_required UX — collapse after submit
  ([`76fc579`](https://github.com/n24q02m/mcp-relay-core/commit/76fc5796d9451a3be009e52de0bda753887433cd))

- **relay-server**: Increase max sessions per IP from 5 to 10
  ([`5049548`](https://github.com/n24q02m/mcp-relay-core/commit/5049548996598fa456cf356756f7aadd411a0bfc))

### Documentation

- Add comprehensive relay audit plan
  ([`c9bf97c`](https://github.com/n24q02m/mcp-relay-core/commit/c9bf97cd4a0c8338b0597a1c217c81fc9b572b73))

- Add E2E test results for notion-mcp and email-mcp
  ([`ee0ba3c`](https://github.com/n24q02m/mcp-relay-core/commit/ee0ba3c2a20db968394028bcbe3c280a8b6f543d))

- Complete E2E test results for all 7 MCP servers
  ([`3b6bc06`](https://github.com/n24q02m/mcp-relay-core/commit/3b6bc06f88910b925a8b77e8e168e7f176f2b5e0))


## v1.0.5 (2026-03-27)

### Bug Fixes

- **cd**: Add Docker Hub login to PSR job to avoid rate limits
  ([`63998b3`](https://github.com/n24q02m/mcp-relay-core/commit/63998b3339fe47640047af40f4d7af6aaf73e3db))

- **relay-server**: Add message/response limits per session
  ([`867f189`](https://github.com/n24q02m/mcp-relay-core/commit/867f18943d72f05c26aced83c756d77596cd0cd0))

### Chores

- Remove .env.example exception from .gitignore
  ([`796ca7b`](https://github.com/n24q02m/mcp-relay-core/commit/796ca7b107dd953189e7d702c7c4f5509830945a))

### Documentation

- Update CLAUDE.md with bidirectional messaging and version injection
  ([`d4135de`](https://github.com/n24q02m/mcp-relay-core/commit/d4135deaa886579f58a5c1af79b8c0d14baab55e))


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
