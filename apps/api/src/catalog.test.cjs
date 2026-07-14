const test = require("node:test");
const assert = require("node:assert/strict");

const { CATEGORY_CODES, normalizeImportRow } = require("./catalog");
const { collectBlankRequiredFields } = require("./validation");

function baseComputerPayload(details) {
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
      ...details,
    },
  };
}

test("blank imported computer boolean fields remain missing", () => {
  const row = normalizeImportRow(
    {
      details: {
        deviceType: "Desktop",
        osInstalled: "Windows 11",
        officeInstalled: "",
        antivirusInstalled: "   ",
        wirelessCapability: null,
      },
    },
    CATEGORY_CODES.COMPUTER
  );

  assert.equal(row.details.officeInstalled, "");
  assert.equal(row.details.antivirusInstalled, "");
  assert.equal(row.details.wirelessCapability, null);

  const blankFields = collectBlankRequiredFields(baseComputerPayload(row.details));

  assert.deepEqual(blankFields, [
    "Office Installed",
    "Antivirus Installed",
    "Wireless Connection Capability",
  ]);
});

test("explicit imported false boolean values are retained as valid answers", () => {
  const row = normalizeImportRow(
    {
      details: {
        deviceType: "Laptop",
        osInstalled: "Windows 10",
        officeInstalled: "no",
        antivirusInstalled: "0",
        wirelessCapability: false,
      },
    },
    CATEGORY_CODES.COMPUTER
  );

  assert.equal(row.details.officeInstalled, false);
  assert.equal(row.details.antivirusInstalled, false);
  assert.equal(row.details.wirelessCapability, false);

  const blankFields = collectBlankRequiredFields(baseComputerPayload(row.details));

  assert.deepEqual(blankFields, []);
});
