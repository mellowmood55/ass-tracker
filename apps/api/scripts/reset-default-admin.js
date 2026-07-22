/**
 * One-shot helper: reset the seeded admin password to DEFAULT_ADMIN_PASSWORD (or admin123).
 * Usage: node scripts/reset-default-admin.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { query, pool } = require("../src/db");

async function main() {
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    "UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username",
    [hash, "admin"]
  );

  if (result.rows.length === 0) {
    await query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
      ["admin", hash, "admin"]
    );
    console.log("Created admin user with the default password.");
  } else {
    console.log("Updated admin password for user id", result.rows[0].id);
  }

  const check = await query("SELECT password_hash FROM users WHERE username = $1", ["admin"]);
  const ok = await bcrypt.compare(password, check.rows[0].password_hash);
  if (!ok) {
    throw new Error("Password verification failed after update.");
  }
  console.log("Verified: admin can sign in with the configured default password.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
