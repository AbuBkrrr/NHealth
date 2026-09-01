FROM node:20-alpine

# Install OpenSSL (required for Prisma)
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

# Use a simpler start command for development
CMD ["npm", "run", "dev"]