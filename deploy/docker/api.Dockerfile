# N-Health API image. Build context: repository root.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter "@nhealth/backend..." \
    && pnpm --filter @nhealth/backend build \
    && mkdir -p apps/backend/uploads && chown -R node:node apps/backend/uploads
USER node
WORKDIR /app/apps/backend
ENV PORT=4000 HOME=/tmp npm_config_cache=/tmp/.npm
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Applies pending database migrations (safe, idempotent), loads the Nigerian facility directory when its
# data file changed (seconds; skipped otherwise), then starts the API
CMD ["sh", "-c", "node scripts/migrate.cjs && node scripts/import-facilities.cjs && exec node dist/apps/backend/src/server.js"]
