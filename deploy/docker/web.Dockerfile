# N-Health web app (PWA) + admin console, served by Nginx. Build context: repository root.
FROM node:22-slim AS build
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/landing ./apps/landing
COPY apps/admin-web ./apps/admin-web
RUN pnpm install --frozen-lockfile --filter "@nhealth/landing..." --filter "@nhealth/admin-web..."
# The public API address is built into the apps
ARG API_ORIGIN=https://api.nhealth.com.ng
RUN VITE_API_URL=$API_ORIGIN pnpm --filter @nhealth/landing build \
 && VITE_API_URL=$API_ORIGIN/api pnpm --filter @nhealth/admin-web build

FROM nginx:1.27-alpine
COPY deploy/docker/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/landing/dist /srv/web
COPY --from=build /app/apps/admin-web/dist /srv/admin
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
