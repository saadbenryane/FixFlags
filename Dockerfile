# FixFlags web + worker image.
# Debian bookworm has Chromium at /usr/bin/chromium. Playwright launches that
# system binary (see lib/audit/screenshot.ts) instead of downloading browsers.
FROM node:20-bookworm-slim

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Chromium (pulls in all the X/font/audio libs it needs) + prisma's openssl.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium \
       fonts-liberation \
       ca-certificates \
       openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all deps (dev deps are needed for `next build` / `tsc`).
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# NEXT_PUBLIC_* vars must exist at build time for Next.js to inline them.
# Defaults keep `next build` valid when Railway/local omit build args.
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_APP_URL=https://fixflags.com
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Generate Prisma client, build the Next.js app and compile the worker.
# Next build is memory-hungry; Railway/local Docker often need a larger heap.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npx prisma generate \
  && npm run build \
  && npm run worker:build

EXPOSE 8080
ENV PORT=8080

# Web service default. The worker service overrides this with its own start command.
CMD ["npm", "run", "start"]
