const { normalizeRole, ROLES } = require("./auth");

const USER_ADMIN_SAFETY_LOCK_KEYS = [20260723, 1];

async function lockUserAdminSafety(client) {
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", USER_ADMIN_SAFETY_LOCK_KEYS);
}

function isActiveAdminRow(row) {
  return normalizeRole(row?.role) === ROLES.ADMIN && row?.is_active !== false;
}

async function countOtherActiveAdmins(client, userId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE lower(trim(role)) = $1
       AND is_active = TRUE
       AND id <> $2`,
    [ROLES.ADMIN, userId]
  );
  return Number(result.rows[0]?.count || 0);
}

async function ensureAnotherActiveAdmin(client, userId, message) {
  const activeAdminCount = await countOtherActiveAdmins(client, userId);
  if (activeAdminCount < 1) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  USER_ADMIN_SAFETY_LOCK_KEYS,
  lockUserAdminSafety,
  isActiveAdminRow,
  countOtherActiveAdmins,
  ensureAnotherActiveAdmin,
};
