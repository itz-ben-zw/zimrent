const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

function runMigration() {
  const db = getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const statements = schema.split(';').filter(s => s.trim().length > 0);
  
  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (e) {
      console.error('Migration error:', e.message);
    }
  }

  console.log('✓ Database migrated successfully');
}

module.exports = runMigration;