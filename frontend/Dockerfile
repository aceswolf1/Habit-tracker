# PixelPaladin frontend — Nuxt 3 (Nitro node-server output)
#
# Build context MUST be the repo root so `shared/` is available:
#   docker build -f frontend/Dockerfile .
#
# Layout mirrors monorepo paths so Nuxt alias `#shared` → `../shared` works:
#   /app/frontend/nuxt.config.ts
#   /app/shared/{progress,scoring}.js

# ---- Build stage ----
FROM node:22.23.4-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

WORKDIR /app
COPY frontend/ ./frontend/
COPY shared/ ./shared/

WORKDIR /app/frontend
RUN npm run build

# ---- Runtime stage ----
FROM node:22.23.4-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
# Bind Nitro to all interfaces so it's reachable from outside the container
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
# Reverse-proxy target for /api/cycles (overridden by compose)
ENV BACKEND_URL=http://backend:4000

# The Nitro output bundles its own node_modules — copy only what we need
COPY --from=build /app/frontend/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
