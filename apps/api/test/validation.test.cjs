const assert = require("node:assert/strict");
const test = require("node:test");

const { validateAssetPayload } = require("../src/validation");

function makePrinterPayload(overrides = {}) {
  return {
    category: "printer",
    location: "9TH Floor (A)",
    office: "ICT",
    model: "HP LaserJet",
    assetNo: "PRN-001",
    serialNo: "SN-001",
    status: "Functional",
    details: {},
    ...overrides,
  };
}

test("validation trims asset and serial identifiers before persistence", () => {
  const result = validateAssetPayload(
    makePrinterPayload({
      assetNo: "  PRN-001  ",
      serialNo: "\tSN-001\n",
    })
  );

  assert.equal(result.valid, true);
  assert.equal(result.data.assetNo, "PRN-001");
  assert.equal(result.data.serialNo, "SN-001");
});

test("validation treats whitespace-only identifiers as missing", () => {
  const result = validateAssetPayload(
    makePrinterPayload({
      assetNo: "   ",
      serialNo: "\n\t",
    })
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Field 'assetNo' is required/);
  assert.match(result.errors.join(" "), /Field 'serialNo' is required/);
});
