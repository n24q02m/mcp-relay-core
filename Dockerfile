# Stage 1: Build TypeScript
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/core-ts/package.json packages/core-ts/
COPY packages/relay-server/package.json packages/relay-server/
RUN bun install --production --frozen-lockfile
COPY packages/core-ts/ packages/core-ts/
COPY packages/relay-server/ packages/relay-server/
RUN cd packages/core-ts && bun run build
RUN cd packages/relay-server && bun run build

# Stage 2: Runtime
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/packages/relay-server/build/ ./build/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY pages/ ./pages/
ENV PORT=8080
ENV PAGES_DIR=/app/pages
EXPOSE 8080
USER node
CMD ["node", "build/index.js"]
