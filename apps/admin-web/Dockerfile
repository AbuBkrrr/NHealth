FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# --ignore-scripts skips Husky prepare hook
RUN npm ci --ignore-scripts

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["npx", "serve", "-s", "dist", "-l", "3000"]
