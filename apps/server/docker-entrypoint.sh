#!/bin/sh
set -e

echo "🔄 Running database migrations (main)..."
./node_modules/.bin/prisma migrate deploy --config prisma.main.config.ts

echo "🚀 Starting application..."
exec node dist/src/main.js
