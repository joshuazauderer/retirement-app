#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy && echo "Migrations complete." || echo "WARNING: Migrations failed, continuing startup..."

echo "Starting application..."
exec node server.js
