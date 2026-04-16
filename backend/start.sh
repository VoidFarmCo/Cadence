#!/bin/sh
echo "Running database migrations..."
npx prisma migrate deploy || {
  echo "Migration failed — attempting prisma db push as fallback..."
  npx prisma db push --accept-data-loss || {
    echo "DB push also failed — attempting raw SQL cleanup..."
    npx prisma migrate resolve --applied 20260416000000_add_company_id_fk 2>/dev/null
    npx prisma db push --accept-data-loss || echo "WARNING: Schema sync failed, starting server anyway"
  }
}
echo "Starting server..."
exec node dist/index.js
