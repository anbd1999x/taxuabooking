# ---- Base ----
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate + next build (xem script "build" trong package.json)
RUN npm run build

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
