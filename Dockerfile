# FixFlags web + worker image.
# Debian bookworm has a real `chromium` package at /usr/bin/chromium, so we skip
# Puppeteer's flaky browser download and point it at the system binary instead.
FROM node:20-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
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
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Generate Prisma client, build the Next.js app and compile the worker.
RUN npx prisma generate \
  && npm run build \
  && npm run worker:build

EXPOSE 8080
ENV PORT=8080

# Web service default. The worker service overrides this with its own start command.
CMD ["npm", "run", "start"]
