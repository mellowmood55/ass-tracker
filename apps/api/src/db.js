const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Set it in apps/api/.env (see apps/api/.env.example)."
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

function isUniqueViolation(error) {
  return error && error.code === "23505";
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      location TEXT,
      office TEXT,
      model TEXT,
      asset_no TEXT,
      serial_no TEXT,
      status TEXT NOT NULL,
      details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT assets_category_check CHECK (
        category IN ('computer', 'software', 'ups', 'network', 'other', 'mobile', 'printer')
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_no_unique
    ON assets(asset_no)
    WHERE asset_no IS NOT NULL AND trim(asset_no) <> '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_serial_no_unique
    ON assets(serial_no)
    WHERE serial_no IS NOT NULL AND trim(serial_no) <> '';

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER,
      action TEXT NOT NULL,
      actor_id INTEGER REFERENCES users(id),
      actor_username TEXT NOT NULL,
      before_json JSONB,
      after_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS category_field_configs (
      category_code TEXT PRIMARY KEY,
      config_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id)
    );
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    UPDATE users
    SET role = 'operator'
    WHERE lower(trim(role)) NOT IN ('admin', 'operator')
  `);

  const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  const resetDefaultAdmin =
    String(process.env.RESET_DEFAULT_ADMIN_PASSWORD || "").toLowerCase() === "true";

  const existingAdmin = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    ["admin"]
  );

  if (existingAdmin.rows.length === 0) {
    const hash = await bcrypt.hash(defaultAdminPassword, 10);
    await pool.query(
      "INSERT INTO users (username, password_hash, role, is_active) VALUES ($1, $2, $3, TRUE)",
      ["admin", hash, "admin"]
    );
  } else if (resetDefaultAdmin) {
    const hash = await bcrypt.hash(defaultAdminPassword, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2",
      [hash, "admin"]
    );
  }

  const {
    seedCategoryFieldConfigs,
    patchStoredCategoryDefaults,
    refreshConfigCache,
  } = require("./categoryConfig");
  await seedCategoryFieldConfigs();
  await patchStoredCategoryDefaults();
  await refreshConfigCache();
}

module.exports = {
  pool,
  query,
  withTransaction,
  initDb,
  isUniqueViolation,
};
