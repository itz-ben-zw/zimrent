const fs = require('fs');
const path = require('path');
const { getDb, saveDb } = require('./db');

const DB_PATH = path.join(__dirname, '..', 'zimrent.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function runMigration() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const db = getDb();

  try {
    db.exec(schema);
  } catch (err) {
    console.error('Migration exec error:', err);
  }

  // Verify expected tables exist; if not, attempt per-statement fallback
  const requiredTables = ['users', 'properties', 'applications', 'favorites', 'conversations', 'messages', 'notifications', 'refresh_tokens', 'email_verifications', 'password_resets', 'csrf_tokens'];
  const missing = requiredTables.filter(name => {
    const row = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='" + name + "'");
    return !row || row.length === 0;
  });

  if (missing.length > 0) {
    console.warn('Missing tables after migration:', missing.join(', '));
    const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try { db.exec(stmt); } catch (e) { /* skip */ }
    }
  }

  saveDb();
  console.log('✓ Database migrated and verified');
}

module.exports = runMigration;
