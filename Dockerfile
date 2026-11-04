# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# .env not present in image; build doesn't need it (env injected at runtime)
RUN npm run build

# ---- run stage ----
FROM node:20-alpine AS runner
WORKDIR /app

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
