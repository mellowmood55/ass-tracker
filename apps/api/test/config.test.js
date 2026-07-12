const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_DEV_ADMIN_PASSWORD,
  DEFAULT_DEV_JWT_SECRET,
  getInitialAdminCredentials,
  getJwtSecret,
} = require("../src/config");

test("development config keeps local bootstrap defaults", () => {
  const env = {};

  assert.equal(getJwtSecret(env), DEFAULT_DEV_JWT_SECRET);
  assert.deepEqual(getInitialAdminCredentials(env), {
    username: DEFAULT_ADMIN_USERNAME,
    password: DEFAULT_DEV_ADMIN_PASSWORD,
  });
});

test("production rejects default JWT secret", () => {
  assert.throws(
    () => getJwtSecret({ NODE_ENV: "production" }),
    /JWT_SECRET must be set/
  );

  assert.throws(
    () => getJwtSecret({ NODE_ENV: "production", JWT_SECRET: DEFAULT_DEV_JWT_SECRET }),
    /JWT_SECRET must be set/
  );
});

test("production rejects missing or default initial admin password", () => {
  assert.throws(
    () => getInitialAdminCredentials({ NODE_ENV: "production" }),
    /ADMIN_PASSWORD must be set/
  );

  assert.throws(
    () =>
      getInitialAdminCredentials({
        NODE_ENV: "production",
        ADMIN_PASSWORD: DEFAULT_DEV_ADMIN_PASSWORD,
      }),
    /ADMIN_PASSWORD must be set/
  );
});

test("production accepts explicit initial admin credentials", () => {
  assert.deepEqual(
    getInitialAdminCredentials({
      NODE_ENV: "production",
      ADMIN_USERNAME: "asset-admin",
      ADMIN_PASSWORD: "replace-me-with-a-real-secret",
    }),
    {
      username: "asset-admin",
      password: "replace-me-with-a-real-secret",
    }
  );

  assert.equal(
    getJwtSecret({
      NODE_ENV: "production",
      JWT_SECRET: "replace-me-with-a-long-random-jwt-secret",
    }),
    "replace-me-with-a-long-random-jwt-secret"
  );
});
