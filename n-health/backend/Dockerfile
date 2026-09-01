FROM node:20-alpine

# Install OpenSSL and OpenSSL development libraries (required for Prisma)
RUN apk add --no-cache openssl openssl-dev libssl3

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

# Start the development server
CMD ["npm", "run", "dev"]
