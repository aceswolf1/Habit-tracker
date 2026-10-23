# PixelPaladin backend — Express + Mongoose (plain JS, entry: server.js)
#
# Build context MUST be the repo root so `shared/` is available:
#   docker build -f backend/Dockerfile .
#
# Layout inside the image mirrors the monorepo relative paths:
#   /app/backend/utils/scoreCalculator.js → require('../../shared/scoring')
#   /app/backend/routes/cycleRoutes.js    → require('../../shared/progress')
FROM node:22.23.4-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first (better layer caching)
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# Application source + shared domain helpers
WORKDIR /app
COPY backend/ ./backend/
COPY shared/ ./shared/

WORKDIR /app/backend
EXPOSE 4000

CMD ["node", "server.js"]
