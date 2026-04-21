# Multi-stage Dockerfile for NestJS + Prisma
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native modules if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Copy package files and install all dependencies (including dev for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and generate build
COPY . .

# Generate Prisma Client before building
RUN npx prisma generate

# Build NestJS app
RUN npm run build

# Remove devDependencies
RUN npm prune --omit=dev


# ----------- Runner Stage -----------
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what is needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/src/main.js"]