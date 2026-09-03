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

# Create startup script
RUN echo '#!/bin/sh\nset -e\necho "Running database migrations..."\nnpx prisma db push --skip-generate || true\necho "Database ready!"\nexec npm start' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 4000

CMD ["/app/entrypoint.sh"]
