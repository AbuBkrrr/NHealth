FROM node:20-slim

# Install dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci

RUN npm run build

RUN npx prisma generate

# Run migrations on startup
RUN echo '#!/bin/sh\nnpx prisma migrate deploy\nnpm start' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 4000

CMD ["/app/start.sh"]