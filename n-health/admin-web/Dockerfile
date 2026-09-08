FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built dist from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npx", "http-server", "dist", "-p", "3000"]
