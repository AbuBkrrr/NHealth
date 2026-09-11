# Multi-stage build for N-Health Backend
# Stage 1: Build dependencies and application
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo files
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/backend ./apps/backend
COPY apps/backend/prisma ./prisma

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Generate Prisma client
RUN cd apps/backend && pnpm run prisma:generate

# Build backend application
RUN cd apps/backend && pnpm run build

# Stage 2: Runtime image
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application and node_modules from builder stage
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Create uploads directory for file storage
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 4000

# Run migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
