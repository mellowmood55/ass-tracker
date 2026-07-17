const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/assets";

const { buildSslConfig } = require("./db");

test("buildSslConfig verifies certificates for hosted Postgres URLs", () => {
  assert.deepEqual(
    buildSslConfig(
      "postgresql://user:password@ep-small-tree.us-east-2.aws.neon.tech/assets?sslmode=require"
    ),
    { rejectUnauthorized: true }
  );
});

test("buildSslConfig disables SSL only for localhost development URLs", () => {
  assert.equal(
    buildSslConfig("postgresql://user:password@localhost:5432/assets"),
    false
  );
  assert.equal(
    buildSslConfig("postgresql://user:password@127.0.0.1:5432/assets"),
    false
  );
  assert.equal(
    buildSslConfig("postgresql://user:password@[::1]:5432/assets"),
    false
  );
});

test("buildSslConfig honors explicit sslmode=disable", () => {
  assert.equal(
    buildSslConfig(
      "postgresql://user:password@postgres.internal/assets?sslmode=disable"
    ),
    false
  );
});
