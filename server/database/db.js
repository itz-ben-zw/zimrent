// Postgres-backed database wrapper. Exposes the same prepare().get/all/run
// shape the route files already use, but every call is now async (returns a
// Promise) since node-postgres is inherently async. Call sites must `await`.
const { Pool } = require('pg');

let pool = null;

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set. Add a Render Postgres instance and set DATABASE_URL.');
  }

  pool = new Pool({
    connectionString,
    // Render's managed Postgres requires SSL but uses a self-signed chain
    // for its internal cert, so we don't verify against a CA here.
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  // Fail fast if the connection is bad, rather than on the first query.
  const client = await pool.connect();
  client.release();

  return getDb();
}

// Converts '?' positional placeholders (SQLite style, used throughout the
// route files) into Postgres's $1, $2, ... style.
// Postgres lowercases unquoted identifiers, but the route files and
// frontend expect camelCase keys (fullName, createdAt, etc.) exactly as
// written in schema.sql and in SELECT ... AS aliases. This map restores the
// original camelCase casing on every row returned from a query.
const CAMEL_CASE_COLUMNS = [
  'fullName', 'passwordHash', 'profileImage', 'emailVerified', 'phoneVerified',
  'authProvider', 'providerId', 'createdAt', 'updatedAt', 'landlordId', 'bedrooms',
  'bathrooms', 'customAdditions', 'propertyId', 'tenantId', 'userId', 'conversationId',
  'senderId', 'expiresAt', 'userAgent',
  'favId', 'favoritedAt', 'landlordEmail', 'landlordName', 'propertyCity',
  'propertySuburb', 'propertyTitle', 'receiverEmail', 'receiverName',
  'senderEmail', 'senderName', 'tenantEmail', 'tenantName', 'tenantPhone'
];
const CASE_MAP = Object.fromEntries(CAMEL_CASE_COLUMNS.map(c => [c.toLowerCase(), c]));

function restoreCase(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[CASE_MAP[key] || key] = value;
  }
  return out;
}

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function getDb() {
  if (!pool) throw new Error('Database not initialized');
  return {
    prepare(sql) {
      return new Statement(sql);
    },
    async exec(sql) {
      await pool.query(sql);
    },
    // Transaction helper matching existing call sites (fn takes no client
    // arg). Uses a dedicated client with BEGIN/COMMIT/ROLLBACK for atomicity.
    transaction(fn) {
      return async function (...args) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(...args);
          await client.query('COMMIT');
          return result;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      };
    },
    async close() {
      if (pool) await pool.end();
    }
  };
}

class Statement {
  constructor(sql) {
    this.sql = toPgSql(sql);
    this.originalSql = sql;
  }

  async get(...params) {
    try {
      const result = await pool.query(this.sql, params);
      return restoreCase(result.rows[0]);
    } catch (e) {
      console.error('SQL get error:', this.originalSql, params, e.message);
      return undefined;
    }
  }

  async all(...params) {
    try {
      const result = await pool.query(this.sql, params);
      return result.rows.map(restoreCase);
    } catch (e) {
      console.error('SQL all error:', this.originalSql, params, e.message);
      return [];
    }
  }

  async run(...params) {
    try {
      const result = await pool.query(this.sql, params);
      return { changes: result.rowCount };
    } catch (e) {
      console.error('SQL run error:', this.originalSql, params, e.message);
      throw e;
    }
  }
}

function saveDb() {
  // No-op: Postgres persists automatically. Kept as a stub so existing
  // callers (which called saveDb() after writes under sql.js) don't error.
}

module.exports = { initDb, getDb, saveDb };
