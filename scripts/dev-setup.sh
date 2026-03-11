#!/usr/bin/env bash
set -euo pipefail

echo "=== TechD PrivacyOps — Development Setup ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install v20+."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Run: npm install -g pnpm@9"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required."; exit 1; }

# Step 1: Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "  -> Edit .env.local with your settings before running the app."
fi

# Step 2: Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install

# Step 3: Start infrastructure services
echo ""
echo "Starting Docker services..."
docker compose up -d

# Step 4: Wait for PostgreSQL to be ready
echo ""
echo "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U privacyops 2>/dev/null; do
  sleep 1
done
echo "  -> PostgreSQL is ready."

# Step 5: Generate Prisma client
echo ""
echo "Generating Prisma client..."
pnpm db:generate

# Step 6: Run database migrations
echo ""
echo "Running database migrations..."
pnpm db:migrate

# Step 7: Seed the database
echo ""
echo "Seeding database..."
pnpm db:seed

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start development servers:"
echo "  pnpm dev"
echo ""
echo "Services:"
echo "  API:          http://localhost:4000 (Swagger: /api/docs)"
echo "  Web:          http://localhost:3000"
echo "  Keycloak:     http://localhost:8080 (admin:admin)"
echo "  Temporal UI:  http://localhost:8233"
echo "  MinIO:        http://localhost:9001 (privacyops:privacyops_dev)"
echo ""
