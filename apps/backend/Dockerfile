FROM node:20-slim

RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci --ignore-scripts

RUN npm run build

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "start"]
