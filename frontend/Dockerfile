# PixelPaladin frontend — Nuxt 3 (Nitro node-server output)

# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install all deps (incl. dev) — needed to build
COPY package*.json ./
RUN npm ci

# Build the Nuxt app -> produces self-contained .output/
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
# Bind Nitro to all interfaces so it's reachable from outside the container
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
# Reverse-proxy target for /api/cycles (overridden by compose)
ENV BACKEND_URL=http://backend:4000

# The Nitro output bundles its own node_modules — copy only what we need
COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
