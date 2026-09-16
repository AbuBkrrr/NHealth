FROM node:22-slim

RUN apt-get update && apt-get install -y \
    openssl libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --no-frozen-lockfile --ignore-scripts

RUN pnpm --filter @nhealth/shared-utils build
RUN pnpm --filter @nhealth/shared-types build

COPY apps/backend ./apps/backend

RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

EXPOSE 4000

CMD ["node", "apps/backend/dist/apps/backend/src/server.js"]