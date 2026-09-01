FROM node:20-slim

# Install OpenSSL and required dependencies for Prisma and native modules
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --no-optional

# Copy the entire source including prisma files
COPY . .

# Clear prisma cache and regenerate - this forces Prisma to rebuild binaries
RUN rm -rf node_modules/.prisma && npx prisma generate

EXPOSE 4000

# Start the development server
CMD ["npm", "run", "dev"]
