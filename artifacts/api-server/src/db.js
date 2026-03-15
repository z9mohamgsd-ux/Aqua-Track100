import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('No database connection string found. Set NEON_DATABASE_URL or DATABASE_URL.');
}

const isNeon = connectionString.includes('neon.tech');

const pool = new Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

console.log(`[DB] Connected to ${isNeon ? 'Neon (cloud)' : 'local'} database`);

export default pool;
