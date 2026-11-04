# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Server-side secrets are injected at runtime, but NEXT_PUBLIC_* values are
# baked into the browser bundle at build time, so they must be present
# DURING the build. Render passes the service's env vars as Docker build
# args only when the Dockerfile declares them as ARG — without these lines
# the deployed site cannot see that Google sign-in is configured.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

# ---- run stage ----
FROM node:20-alpine AS runner
WORKDIR /app

# GitHub-URL projects are fetched with a real `git clone` — alpine ships no
# git, and without it every URL analysis died with "spawn git ENOENT" while
# ZIP uploads kept working.
RUN apk add --no-cache git

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Scans write checked-out source here. /data survives restarts on Fly when
# backed by a volume (see fly.toml [mounts]); it's writable regardless.
ENV SCRATCH_DIR=/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080

CMD ["node_modules/.bin/next", "start", "-p", "8080"]
