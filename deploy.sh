#!/bin/bash
set -e

# FlowForge deploy script — run from project root on VPS
# Usage: bash deploy.sh

echo "=== FlowForge Deploy ==="

echo "1. Pulling latest code..."
git pull origin main

echo "2. Installing dependencies..."
pnpm install --frozen-lockfile

echo "3. Building..."
pnpm build

echo "4. Running migrations..."
cd apps/backend
npx prisma migrate deploy
npx prisma generate
cd ../..

echo "5. Restarting services..."
if command -v pm2 &> /dev/null; then
  pm2 restart all
  echo "PM2 restarted"
elif [ -f docker-compose.prod.yml ]; then
  docker-compose -f docker-compose.prod.yml up -d --build
  echo "Docker restarted"
else
  echo "No PM2 or Docker found — restart services manually"
fi

echo "=== Deploy complete ==="
