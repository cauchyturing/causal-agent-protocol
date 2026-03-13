# deploy/Dockerfile
# Multi-stage build for Abel CAP Server

# ── Build stage ──────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ src/
RUN npx tsc

# ── Production stage ─────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=build /app/dist/ dist/
COPY docs/ docs/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
