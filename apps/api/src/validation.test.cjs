const test = require("node:test");
const assert = require("node:assert/strict");

const { CATEGORY_CODES } = require("./catalog");
const { validateAssetPayload } = require("./validation");

function computerPayload(details) {
  return {
    category: CATEGORY_CODES.COMPUTER,
    location: "9TH Floor (A)",
    office: "ICT",
    model: "OptiPlex",
    assetNo: "ICT-001",
    serialNo: "SN-001",
    status: "Functional",
    details: {
      deviceType: "Desktop",
      osInstalled: "Windows 11",
      officeInstalled: true,
      antivirusInstalled: false,
      wirelessCapability: true,
      ...details,
    },
  };
}

test("computer import validation rejects unrecognized boolean text", () => {
  const result = validateAssetPayload(
    computerPayload({
      officeInstalled: "Unknown",
      antivirusInstalled: "N/A",
      wirelessCapability: "pending verification",
    }),
    { mode: "import", allowMissingLocation: true }
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "Detail field 'officeInstalled' must be yes/no for Computer.",
    "Detail field 'antivirusInstalled' must be yes/no for Computer.",
    "Detail field 'wirelessCapability' must be yes/no for Computer.",
  ]);
});

test("computer import validation accepts recognized boolean values", () => {
  const result = validateAssetPayload(
    computerPayload({
      officeInstalled: true,
      antivirusInstalled: false,
      wirelessCapability: false,
    }),
    { mode: "import", allowMissingLocation: true }
  );

  assert.equal(result.valid, true);
  assert.equal(result.data.details.officeInstalled, true);
  assert.equal(result.data.details.antivirusInstalled, false);
  assert.equal(result.data.details.wirelessCapability, false);
});
