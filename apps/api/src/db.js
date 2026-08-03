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

    CREATE TABLE IF NOT EXISTS asset_categories (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('importing', 'completed', 'failed')),
      progress_percent INTEGER NOT NULL DEFAULT 0,
      totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_message TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS maintenance_checklist_templates (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      cadence TEXT NOT NULL DEFAULT 'quarterly'
        CHECK (cadence IN ('quarterly', 'monthly')),
      name TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id),
      UNIQUE (cadence, category)
    );

    CREATE TABLE IF NOT EXISTS maintenance_checklist_template_items (
      id SERIAL PRIMARY KEY,
      template_id INTEGER NOT NULL REFERENCES maintenance_checklist_templates(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      description_hint TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      cadence TEXT NOT NULL DEFAULT 'quarterly'
        CHECK (cadence IN ('quarterly', 'monthly')),
      quarter INTEGER CHECK (quarter IS NULL OR quarter BETWEEN 1 AND 4),
      month INTEGER CHECK (month IS NULL OR month BETWEEN 1 AND 12),
      status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'complete')),
      hardware_type TEXT NOT NULL DEFAULT '',
      hardware_part TEXT NOT NULL DEFAULT '',
      hardware_reports TEXT NOT NULL DEFAULT '',
      hardware_description TEXT NOT NULL DEFAULT '',
      software_type TEXT NOT NULL DEFAULT '',
      software_programs TEXT NOT NULL DEFAULT '',
      software_reports TEXT NOT NULL DEFAULT '',
      software_description TEXT NOT NULL DEFAULT '',
      solution TEXT NOT NULL DEFAULT '',
      prepared_by TEXT NOT NULL DEFAULT '',
      done_by TEXT NOT NULL DEFAULT '',
      completed_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maintenance_record_items (
      id SERIAL PRIMARY KEY,
      record_id INTEGER NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
      template_item_id INTEGER REFERENCES maintenance_checklist_template_items(id) ON DELETE SET NULL,
      label_snapshot TEXT NOT NULL,
      checked BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT NOT NULL DEFAULT '',
      completed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  // Allow dynamic category codes (e.g. admin-added VoIP).
  await pool.query(`
    ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_category_check;
  `);

  // Maintenance schema upgrades for quarterly/monthly cadence + issue fields.
  await pool.query(`
    ALTER TABLE maintenance_checklist_templates
      ADD COLUMN IF NOT EXISTS cadence TEXT;

    UPDATE maintenance_checklist_templates
    SET cadence = 'quarterly'
    WHERE cadence IS NULL OR trim(cadence) = '';

    ALTER TABLE maintenance_checklist_templates
      ALTER COLUMN cadence SET DEFAULT 'quarterly';

    ALTER TABLE maintenance_checklist_templates
      DROP CONSTRAINT IF EXISTS maintenance_checklist_templates_category_key;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'maintenance_checklist_templates_cadence_category_key'
      ) THEN
        ALTER TABLE maintenance_checklist_templates
          ADD CONSTRAINT maintenance_checklist_templates_cadence_category_key UNIQUE (cadence, category);
      END IF;
    END $$;

    ALTER TABLE maintenance_records
      ADD COLUMN IF NOT EXISTS cadence TEXT,
      ADD COLUMN IF NOT EXISTS month INTEGER,
      ADD COLUMN IF NOT EXISTS hardware_type TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS hardware_part TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS hardware_reports TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS hardware_description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS software_type TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS software_programs TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS software_reports TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS software_description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS solution TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS prepared_by TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS done_by TEXT NOT NULL DEFAULT '';

    UPDATE maintenance_records
    SET cadence = 'quarterly'
    WHERE cadence IS NULL OR trim(cadence) = '';

    ALTER TABLE maintenance_records
      ALTER COLUMN cadence SET DEFAULT 'quarterly';

    UPDATE maintenance_records
    SET status = 'complete'
    WHERE status = 'managed';

    ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_status_check;
    ALTER TABLE maintenance_records
      ADD CONSTRAINT maintenance_records_status_check
      CHECK (status IN ('in_progress', 'complete'));

    ALTER TABLE maintenance_records ALTER COLUMN quarter DROP NOT NULL;

    ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_asset_id_year_quarter_key;
    ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_period_key;
    DROP INDEX IF EXISTS maintenance_records_period_uidx;
    CREATE UNIQUE INDEX IF NOT EXISTS maintenance_records_period_uidx
      ON maintenance_records (
        asset_id,
        year,
        cadence,
        COALESCE(quarter, 0),
        COALESCE(month, 0)
      );
  `);

  await pool.query(`
    INSERT INTO asset_categories (code, label, is_builtin)
    VALUES
      ('computer', 'Computer', TRUE),
      ('software', 'Software', TRUE),
      ('ups', 'UPS', TRUE),
      ('network', 'Network Infrastructure', TRUE),
      ('other', 'Other Assets', TRUE),
      ('mobile', 'Mobile Devices', TRUE),
      ('printer', 'Printer', TRUE)
    ON CONFLICT (code) DO NOTHING;
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

  const { seedMaintenanceTemplates } = require("./maintenance");
  await seedMaintenanceTemplates();
}

module.exports = {
  pool,
  query,
  withTransaction,
  initDb,
  isUniqueViolation,
};
