process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { patchCategoryConfig } = require("./categoryConfig");

function getField(config, name) {
  return config.detailFields.find((field) => field.name === name);
}

test("startup category patch preserves saved antivirus admin settings", () => {
  const savedConfig = {
    groups: [],
    sharedFields: [],
    detailFields: [
      {
        name: "antivirusInstalled",
        label: "Antivirus Installed",
        type: "boolean",
        required: true,
        locked: true,
      },
      {
        name: "antivirusType",
        label: "Antivirus Type",
        type: "text",
        required: true,
        locked: true,
      },
      {
        name: "remainingSubscriptionDays",
        label: "Remaining Subscription Days",
        type: "number",
        required: true,
        locked: true,
      },
    ],
  };

  const patched = patchCategoryConfig("computer", savedConfig);

  assert.deepEqual(getField(patched, "antivirusInstalled"), {
    name: "antivirusInstalled",
    label: "Antivirus Installed",
    type: "boolean",
    required: true,
    locked: true,
  });
  assert.deepEqual(getField(patched, "antivirusType"), {
    name: "antivirusType",
    label: "Antivirus Type",
    type: "text",
    required: true,
    locked: true,
  });
  assert.deepEqual(getField(patched, "remainingSubscriptionDays"), {
    name: "remainingSubscriptionDays",
    label: "Remaining Subscription Days",
    type: "number",
    required: true,
    locked: true,
  });
});
