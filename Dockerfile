# ─── Stage 1: build ───────────────────────────────────────────────────────────
# All dev tools, build artifacts, and heavy compilation live here.
# They never ship to the registry.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Prisma generates its native client during the build and must resolve OpenSSL correctly.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (layer cache: only re-runs when lockfile changes).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

COPY . .

ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_APP_URL=https://fixflags.com
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NODE_OPTIONS=--max-old-space-size=4096

RUN npx prisma generate \
  && BETTER_AUTH_SECRET="$(openssl rand -hex 32)" npm run build \
  && npm run worker:build

# Prune to production-only node_modules (needed for Prisma CLI at runtime).
RUN npm prune --omit=dev

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
# Chromium + standalone Next.js output + Prisma CLI. No dev tools, no source,
# no full node_modules tree (standalone bundles its own).
FROM node:22-bookworm-slim

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Chromium + fonts (needed by Playwright at runtime) + openssl (needed by Prisma).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium \
       fonts-liberation \
       ca-certificates \
       openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production node_modules (pruned — no dev tools, no TypeScript, no test libs).
COPY --from=builder /app/node_modules ./node_modules

# Prisma schema + migrations (needed by `prisma migrate deploy` at startup).
COPY prisma ./prisma

# Next.js standalone output (self-contained server.js + bundled node_modules).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Compiled worker.
COPY --from=builder /app/dist ./dist

# Runtime helpers. Railway injects configuration; local commands may load .env.local.
COPY --from=builder /app/scripts/db-run.mjs ./scripts/db-run.mjs
COPY --from=builder /app/scripts/runtime-start.mjs ./scripts/runtime-start.mjs
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080
ENV PORT=8080

# Run migrations then start the self-contained server without a shell wrapper.
CMD ["node", "scripts/runtime-start.mjs", "web"]
