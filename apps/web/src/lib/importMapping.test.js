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

test("applyMapping preserves blank boolean cells as missing values", () => {
  const [asset] = applyMapping(
    [
      {
        "Office Installed": "",
        "Antivirus Installed": "   ",
        "Wireless Connection Capability": null,
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
    officeInstalled: "",
    antivirusInstalled: "",
    wirelessCapability: "",
  });
});

test("applyMapping keeps explicit false boolean cells as false", () => {
  const [asset] = applyMapping(
    [
      {
        "Office Installed": "No",
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
    officeInstalled: false,
    antivirusInstalled: false,
    wirelessCapability: false,
  });
});
