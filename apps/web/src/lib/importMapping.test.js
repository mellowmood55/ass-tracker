import test from "node:test";
import assert from "node:assert/strict";

import { applyMapping } from "./importMapping.js";

const computerCategory = {
  code: "computer",
  sharedFields: [],
  detailFields: [
    { name: "officeInstalled", label: "Office Installed", type: "boolean" },
    { name: "antivirusInstalled", label: "Antivirus Installed", type: "boolean" },
    { name: "wirelessCapability", label: "Wireless Connection Capability", type: "boolean" },
  ],
};

test("applyMapping preserves unrecognized boolean text instead of coercing it to true", () => {
  const [asset] = applyMapping(
    [
      {
        "Office Installed": "Unknown",
        "Antivirus Installed": "N/A",
        "Wireless Connection Capability": "pending verification",
      },
    ],
    {
      "Office Installed": "officeInstalled",
      "Antivirus Installed": "antivirusInstalled",
      "Wireless Connection Capability": "wirelessCapability",
    },
    computerCategory
  );

  assert.deepEqual(asset.details, {
    officeInstalled: "Unknown",
    antivirusInstalled: "N/A",
    wirelessCapability: "pending verification",
  });
});

test("applyMapping keeps recognized boolean aliases as booleans", () => {
  const [asset] = applyMapping(
    [
      {
        "Office Installed": "Yes",
        "Antivirus Installed": "0",
        "Wireless Connection Capability": false,
      },
    ],
    {
      "Office Installed": "officeInstalled",
      "Antivirus Installed": "antivirusInstalled",
      "Wireless Connection Capability": "wirelessCapability",
    },
    computerCategory
  );

  assert.deepEqual(asset.details, {
    officeInstalled: true,
    antivirusInstalled: false,
    wirelessCapability: false,
  });
});
