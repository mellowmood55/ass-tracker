const DEFAULT_DEV_JWT_SECRET = "change-this-secret-in-production";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_DEV_ADMIN_PASSWORD = "admin123";

function isProduction(env = process.env) {
  return env.NODE_ENV === "production";
}

function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

  if (isProduction(env) && secret === DEFAULT_DEV_JWT_SECRET) {
    throw new Error("JWT_SECRET must be set to a non-default value in production.");
  }

  return secret;
}

function getInitialAdminUsername(env = process.env) {
  const username = String(env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
  return username || DEFAULT_ADMIN_USERNAME;
}

function getInitialAdminCredentials(env = process.env) {
  const username = getInitialAdminUsername(env);
  const password = env.ADMIN_PASSWORD || DEFAULT_DEV_ADMIN_PASSWORD;

  if (isProduction(env) && password === DEFAULT_DEV_ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_PASSWORD must be set to a non-default value before creating the initial admin account in production."
    );
  }

  return { username, password };
}

module.exports = {
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_DEV_ADMIN_PASSWORD,
  DEFAULT_DEV_JWT_SECRET,
  getInitialAdminCredentials,
  getInitialAdminUsername,
  getJwtSecret,
};
