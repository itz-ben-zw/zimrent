// Thin wrapper around sql.js to provide better-sqlite3 compatible API
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'zimrent.db');

let sqlDb = null;
let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }
  
  sqlDb.run('PRAGMA foreign_keys = ON');
  
  // Create a wrapped db object with better-sqlite3 compatible API
  db = {
    prepare(sql) {
      return new Statement(sql, sqlDb);
    },
    exec(sql) {
      sqlDb.exec(sql);
    },
    run(sql, params) {
      sqlDb.run(sql, params);
      saveDb();
    },
    transaction(fn) {
      return function(...args) {
        try {
          sqlDb.run('BEGIN TRANSACTION');
          const result = fn(...args);
          sqlDb.run('COMMIT');
          saveDb();
          return result;
        } catch (e) {
          sqlDb.run('ROLLBACK');
          throw e;
        }
      };
    },
    close() {
      saveDb();
      if (sqlDb) sqlDb.close();
    }
  };
  
  return db;
}

class Statement {
  constructor(sql, sqlDb) {
    this.sql = sql;
    this.sqlDb = sqlDb;
  }
  
  get(...params) {
    try {
      const stmt = this.sqlDb.prepare(this.sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return undefined;
    } catch (e) {
      console.error('SQL get error:', this.sql, params, e.message);
      return undefined;
    }
  }
  
  all(...params) {
    try {
      const results = [];
      const stmt = this.sqlDb.prepare(this.sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('SQL all error:', this.sql, params, e.message);
      return [];
    }
  }
  
  run(...params) {
    try {
      this.sqlDb.run(this.sql, params);
      saveDb();
      return { changes: this.sqlDb.getRowsModified() };
    } catch (e) {
      console.error('SQL run error:', this.sql, params, e.message);
      throw e;
    }
  }
}

function saveDb() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDb, getDb };