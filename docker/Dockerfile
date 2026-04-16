# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js (standalone) + dual Prisma clients.

ARG NODE_VERSION=22-alpine

# ────────────────────────────────────────────────────────────
# 1. deps — install dependencies with pnpm
# ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ────────────────────────────────────────────────────────────
# 2. builder — generate prisma + next build
# ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate needs the env at generate time only for sym (introspect-time URL).
# We provide a placeholder; runtime URL comes from container env.
ENV SYM_DATABASE_URL="mysql://placeholder:placeholder@staging-placeholder/sym"
ENV AUDIT_DATABASE_URL="file:/tmp/build-placeholder.db"
ENV ALLOW_NON_STAGING="true"

RUN pnpm prisma:generate
RUN pnpm build

# ────────────────────────────────────────────────────────────
# 3. runner — minimal runtime image
# ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PORT=3000

# Non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma generated clients (standalone trace already includes them, but be explicit)
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/sym/client ./lib/db/sym/client
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/audit/client ./lib/db/audit/client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# audit DB volume mount target
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
