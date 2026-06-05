# syntax=docker/dockerfile:1
#
# Single shared image for the COSYL Video Engine monorepo.
# docker-compose runs it twice: once as the API (node), once as the web (next start).
#
#   - Node 22 + system ffmpeg (the renderer shells out to the `ffmpeg` binary)
#   - npm ci installs the whole workspace once (hoisted node_modules)
#   - the Next.js web app is built at image-build time (NEXT_PUBLIC_* are baked in)
#
FROM node:22-slim

# ffmpeg / ffprobe are required by apps/api/src/media for composition & probing.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Install dependencies from lockfile. Copy every workspace manifest first so
#    npm can resolve the full workspace graph and cache this layer.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/agents/package.json ./packages/agents/
COPY packages/config/package.json ./packages/config/
COPY packages/factory/package.json ./packages/factory/
COPY packages/media/package.json ./packages/media/
COPY packages/orchestrator/package.json ./packages/orchestrator/
COPY packages/renderer/package.json ./packages/renderer/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# 2) Copy the source (node_modules / .next / data excluded via .dockerignore).
COPY . .

# 3) Build the web app. NEXT_PUBLIC_* values are compiled into the client bundle,
#    so they must be supplied as build args (the browser uses NEXT_PUBLIC_API_URL
#    to reach the API directly).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build:web

ENV NODE_ENV=production

# Local content lives here; mount a persistent volume at this path in production.
RUN mkdir -p apps/api/data

# API → 4000, Web → 3000 (the compose file selects the command per service).
EXPOSE 4000 3000

CMD ["node", "apps/api/index.js"]
