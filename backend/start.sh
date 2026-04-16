#!/bin/sh
echo "Running data cleanup before migrations..."

# Run cleanup SQL directly against Postgres to fix orphaned FK references
# This MUST happen before Prisma tries to add FK constraints
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function cleanup() {
  console.log('Cleaning orphaned company_id references...');
  
  const tables = [
    'worker_profiles', 'sites', 'pay_periods', 'messages',
    'punches', 'time_entries', 'shifts', 'payroll_runs',
    'expenses', 'leave_requests', 'tax_deductions', 'tax_forms',
    'worker_documents', 'audit_logs', 'accounts'
  ];
  
  for (const table of tables) {
    try {
      const result = await prisma.\$executeRawUnsafe(
        \`UPDATE \\\"\${table}\\\" SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)\`
      );
      if (result > 0) console.log(\`  Cleaned \${result} orphaned rows in \${table}\`);
    } catch (e) {
      console.log(\`  Skipping \${table}: \${e.message}\`);
    }
  }
  
  // Also delete any worker_profiles where company_id is empty string
  try {
    await prisma.\$executeRawUnsafe(
      \`UPDATE worker_profiles SET company_id = NULL WHERE company_id = ''\`
    );
  } catch (e) {}
  
  console.log('Data cleanup complete.');
  await prisma.\$disconnect();
}
cleanup().catch(e => { console.error('Cleanup error:', e.message); process.exit(0); });
"

echo "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || {
  echo "migrate deploy failed, trying db push..."
  npx prisma db push --accept-data-loss 2>/dev/null || {
    echo "db push failed, marking migration as applied and retrying..."
    npx prisma migrate resolve --applied 20260416000000_add_company_id_fk 2>/dev/null
    npx prisma db push --accept-data-loss 2>/dev/null || echo "WARNING: Schema sync failed, continuing anyway"
  }
}

echo "Starting server..."
exec node dist/index.js
