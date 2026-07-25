process.env.DATABASE_URL ||= "postgresql://user:password@localhost:5432/asset_tracker_test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDefaultCategoryConfig,
  validateCategoryConfigPayload,
} = require("./categoryConfig");
const { pool } = require("./db");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findField(config, name) {
  return [...(config.sharedFields || []), ...(config.detailFields || [])].find(
    (field) => field.name === name
  );
}

test.after(async () => {
  await pool.end();
});

test("default-locked category fields stay locked when clients submit them unlocked", () => {
  const existingConfig = getDefaultCategoryConfig("computer");
  const incomingConfig = clone(existingConfig);

  findField(incomingConfig, "deviceType").locked = false;
  findField(incomingConfig, "office").locked = false;

  const result = validateCategoryConfigPayload("computer", incomingConfig, incomingConfig);

  assert.equal(result.valid, true);
  assert.equal(findField(result.data, "deviceType").locked, true);
  assert.equal(findField(result.data, "office").locked, true);
});

test("default-locked category fields cannot be removed after a previous unlock save", () => {
  const existingConfig = clone(getDefaultCategoryConfig("computer"));
  findField(existingConfig, "deviceType").locked = false;

  const incomingConfig = clone(existingConfig);
  incomingConfig.detailFields = incomingConfig.detailFields.filter(
    (field) => field.name !== "deviceType"
  );

  const result = validateCategoryConfigPayload("computer", incomingConfig, existingConfig);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Computer Type.*deviceType.*cannot be removed/);
});
