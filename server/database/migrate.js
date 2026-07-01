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

  sqlDb.exec(schema);
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  sqlDb.close();
  console.log('✓ Database migrated successfully');
}

module.exports = runMigration;