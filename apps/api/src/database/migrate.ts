import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { Pool } from 'pg';

dotenv.config({
  path: resolve(process.cwd(), '../../.env'),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[irec-db] DATABASE_URL no esta definido.');
  process.exit(1);
}

const migrationsFolder = resolve(process.cwd(), 'drizzle');
const pool = new Pool({
  connectionString,
  max: 2,
});

try {
  console.log('[irec-db] Verificando PostgreSQL...');
  await pool.query('select 1');
  console.log('[irec-db] PostgreSQL OK.');

  console.log(`[irec-db] Aplicando migraciones desde: ${migrationsFolder}`);
  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder,
  });

  console.log('[irec-db] Migraciones aplicadas correctamente.');
} catch (error) {
  console.error('');
  console.error('[irec-db] MIGRATION FAILED');
  console.error(error);

  if (error instanceof Error && error.cause) {
    console.error('');
    console.error('[irec-db] Cause:');
    console.error(error.cause);
  }

  process.exitCode = 1;
} finally {
  await pool.end();
}
