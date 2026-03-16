# ---- Build frontend ----
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Build server ----
FROM node:20-slim AS server-builder
WORKDIR /app/server
COPY server/package.json ./
RUN npm install
COPY server/ .
RUN npm run build

# ---- Runtime ----
FROM node:20-slim
WORKDIR /app

COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=frontend-builder /app/dist ./frontend

# Install Playwright Chromium + all required system libraries.
# playwright-extra + stealth plugin bypasses Akamai bot detection by running a
# real (patched) Chromium instance, matching browser TLS + JS fingerprints exactly.
RUN node_modules/.bin/playwright install --with-deps chromium

RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "/app/dist/index.js"]
