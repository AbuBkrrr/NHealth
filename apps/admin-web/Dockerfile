FROM node:22-alpine AS builder

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/admin-web/package.json ./apps/admin-web/

RUN pnpm install --frozen-lockfile --ignore-scripts --filter admin-web

COPY apps/admin-web ./apps/admin-web

RUN pnpm --filter admin-web build

FROM nginx:alpine
COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html
COPY apps/admin-web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]