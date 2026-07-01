const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "asset-tracker.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      location TEXT,
      office TEXT,
      model TEXT,
      asset_no TEXT,
      serial_no TEXT,
      status TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(updated_by) REFERENCES users(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_no_unique
    ON assets(asset_no)
    WHERE asset_no IS NOT NULL AND trim(asset_no) <> '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_serial_no_unique
    ON assets(serial_no)
    WHERE serial_no IS NOT NULL AND trim(serial_no) <> '';

    CREATE TRIGGER IF NOT EXISTS trg_assets_category_insert
    BEFORE INSERT ON assets
    WHEN NEW.category NOT IN ('computer', 'software', 'ups', 'network', 'other', 'mobile', 'printer')
    BEGIN
      SELECT RAISE(ABORT, 'Invalid asset category');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_assets_category_update
    BEFORE UPDATE OF category ON assets
    WHEN NEW.category NOT IN ('computer', 'software', 'ups', 'network', 'other', 'mobile', 'printer')
    BEGIN
      SELECT RAISE(ABORT, 'Invalid asset category');
    END;

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      action TEXT NOT NULL,
      actor_id INTEGER,
      actor_username TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(actor_id) REFERENCES users(id)
    );
  `);

  const auditFkList = db.prepare("PRAGMA foreign_key_list(audit_logs)").all();
  const hasAssetForeignKey = auditFkList.some((row) => row.table === "assets");

  if (hasAssetForeignKey) {
    db.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE IF NOT EXISTS audit_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER,
        action TEXT NOT NULL,
        actor_id INTEGER,
        actor_username TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(actor_id) REFERENCES users(id)
      );

      INSERT INTO audit_logs_new (id, asset_id, action, actor_id, actor_username, before_json, after_json, created_at)
      SELECT id, asset_id, action, actor_id, actor_username, before_json, after_json, created_at
      FROM audit_logs;

      DROP TABLE audit_logs;
      ALTER TABLE audit_logs_new RENAME TO audit_logs;

      PRAGMA foreign_keys = ON;
    `);
  }

  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("admin");

  if (!existingAdmin) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
    ).run("admin", hash, "admin");
  }
}

module.exports = {
  db,
  initDb,
};
