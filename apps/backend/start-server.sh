#!/bin/bash
set -e

echo "Starting N-Health Backend..."
echo "DATABASE_URL: $DATABASE_URL"

# Wait for database to be ready
echo "Waiting for database..."
for i in {1..30}; do
  if nc -z ${DATABASE_URL#*@} 2>/dev/null; then
    echo "Database is ready!"
    break
  fi
  echo "Attempt $i/30: Waiting for database..."
  sleep 2
done

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy --skip-generate || true

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Start the app
echo "Starting application..."
exec npm start
