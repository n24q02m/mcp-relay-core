# AGENTS.md - mcp-relay-core

## For Implementation Agents

This is a monorepo. When working on a task:
- TypeScript packages: use bun for package management, vitest for tests
- Python package: use uv for package management, pytest for tests
- Pre-commit hooks enforce: biome (TS), ruff (Python), gitleaks, conventional commits
- Coverage target: >= 95%
- Commit prefix: feat: or fix: only

## Package Boundaries

- core-ts and core-py MUST produce identical crypto output for same inputs
- Test vectors in packages/core-ts/tests/fixtures/crypto-vectors.json are the parity contract
- relay-server is independent -- only shares types with core-ts
- pages/ are static HTML/JS -- no build step, use WebCrypto API directly
