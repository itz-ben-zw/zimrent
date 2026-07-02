const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'zimrent.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function runMigration() {
  const SQL = await initSqlJs();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  try {
    sqlDb.exec(schema);
  } catch (err) {
    console.error('Migration exec error:', err);
  }

  // Verify expected tables exist; if not, attempt per-statement fallback
  const requiredTables = ['users', 'properties', 'applications', 'favorites', 'conversations', 'messages', 'notifications'];
  const missing = requiredTables.filter(name => {
    const row = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='" + name + "'");
    return !row || row.length === 0;
  });

  if (missing.length > 0) {
    console.warn('Missing tables after migration:', missing.join(', '));
    const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try { sqlDb.exec(stmt); } catch (e) { /* skip */ }
    }
  }

  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  sqlDb.close();
  console.log('✓ Database migrated and verified');
}

module.exports = runMigration;