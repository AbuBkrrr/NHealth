FROM node:20-slim

# Install dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]