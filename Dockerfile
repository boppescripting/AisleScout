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

# Install curl-impersonate — patches curl to produce Chrome's exact TLS fingerprint,
# bypassing Akamai bot detection that blocks standard Node.js / curl requests.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget \
    && mkdir -p /tmp/ci \
    && wget -qO /tmp/ci.tar.gz \
        "https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-chrome.x86_64-linux-gnu.tar.gz" \
    && tar -xf /tmp/ci.tar.gz -C /tmp/ci \
    && cp /tmp/ci/curl_chrome* /usr/local/bin/ \
    && (cp /tmp/ci/*.so* /usr/local/lib/ 2>/dev/null || true) \
    && ldconfig \
    && rm -rf /tmp/ci /tmp/ci.tar.gz \
    && apt-get purge -y wget \
    && apt-get autoremove -y && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=frontend-builder /app/dist ./frontend

RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "/app/dist/index.js"]
