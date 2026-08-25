# PixelPaladin backend — Express + Mongoose (plain JS, entry: server.js)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
