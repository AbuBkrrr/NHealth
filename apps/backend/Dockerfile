FROM node:22-slim

RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/

# Install with pnpm (resolves workspace:*)
RUN pnpm install --frozen-lockfile --ignore-scripts --filter backend

# Copy source
COPY apps/backend ./apps/backend

# Generate Prisma client
RUN pnpm --filter backend exec prisma generate

# Build
RUN pnpm --filter backend build

EXPOSE 4000

CMD ["node", "apps/backend/dist/server.js"]