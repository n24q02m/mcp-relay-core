# syntax=docker/dockerfile:1

# Stage 1: Build TypeScript
FROM oven/bun:1-alpine@sha256:7ed9f74c326d1c260abe247ac423ccbf5ac92af62bb442d515d1f92f21e8ea9b AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/core-ts/package.json packages/core-ts/
COPY packages/relay-server/package.json packages/relay-server/
RUN bun install --frozen-lockfile
COPY packages/core-ts/ packages/core-ts/
COPY packages/relay-server/ packages/relay-server/
RUN cd packages/core-ts && bun run build
RUN cd packages/relay-server && bun run build

# Stage 2: Runtime (bun for compatible node_modules resolution)
FROM oven/bun:1-alpine@sha256:7ed9f74c326d1c260abe247ac423ccbf5ac92af62bb442d515d1f92f21e8ea9b
LABEL org.opencontainers.image.source="https://github.com/n24q02m/mcp-relay-core"
LABEL org.opencontainers.image.description="Zero-config MCP credential relay server — ECDH P-256 + AES-256-GCM, rate-limited, zero-knowledge"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/core-ts/package.json packages/core-ts/
COPY packages/relay-server/package.json packages/relay-server/
RUN bun install --production --frozen-lockfile
COPY --from=builder /app/packages/relay-server/build/ ./packages/relay-server/build/
COPY pages/ ./pages/
ENV PORT=8080
ENV PAGES_DIR=/app/pages
EXPOSE 8080
USER bun
CMD ["bun", "run", "packages/relay-server/build/index.js"]
