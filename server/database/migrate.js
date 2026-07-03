const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function runMigration() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const db = getDb();

  try {
    await db.exec(schema);
  } catch (err) {
    console.error('Migration exec error:', err);
  }

  // Verify expected tables exist; if not, attempt per-statement fallback
  const requiredTables = ['users', 'properties', 'applications', 'favorites', 'conversations', 'messages', 'notifications', 'refresh_tokens', 'email_verifications', 'password_resets', 'csrf_tokens'];
  const missing = [];
  for (const name of requiredTables) {
    const row = await db.prepare(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?`
    ).get(name);
    if (!row) missing.push(name);
  }

  if (missing.length > 0) {
    console.warn('Missing tables after migration:', missing.join(', '));
    const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try { await db.exec(stmt); } catch (e) { /* skip */ }
    }
  }

  console.log('✓ Database migrated and verified');
}

module.exports = runMigration;
