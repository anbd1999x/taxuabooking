# syntax=docker/dockerfile:1
# ---- Base ----
FROM node:22-alpine AS base
# libheif-tools + libde265: giải mã HEIC nén HEVC (ảnh iPhone) qua heif-convert.
RUN apk add --no-cache openssl libc6-compat libheif-tools libde265
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
# Cache tải gói npm giữa các lần build (BuildKit) để npm ci nhanh hơn khi đổi dep.
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* phải có mặt lúc build (được "nướng" vào bundle client).
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# prisma generate + next build. Cache .next/cache giữa các lần build để build tăng tốc.
RUN --mount=type=cache,target=/app/.next/cache npm run build

# ---- Runner (production) ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Copy đầy đủ để chạy app + prisma migrate deploy lúc khởi động
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

# Chạy migration rồi khởi động server. Ảnh upload nằm ở /app/public/uploads (mount volume).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
