import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formStateFromAsset, payloadFromForm } from "./assetColumns.js";

const categoryWithCustomSharedField = {
  code: "computer",
  sharedFields: [
    { name: "assetNo", label: "Asset No", type: "text" },
    { name: "countyOffice", label: "County Office", type: "text" },
  ],
  detailFields: [{ name: "deviceType", label: "Computer Type", type: "text" }],
};

describe("dynamic asset field serialization", () => {
  it("hydrates custom shared fields from details_json and submits them back as details", () => {
    const state = formStateFromAsset(
      {
        assetNo: "ICT-001",
        details: {
          countyOffice: "Mombasa",
          deviceType: "Laptop",
        },
      },
      categoryWithCustomSharedField
    );

    assert.equal(state.assetNo, "ICT-001");
    assert.equal(state.countyOffice, "Mombasa");
    assert.equal(state.deviceType, "Laptop");

    const payload = payloadFromForm(state, "computer", categoryWithCustomSharedField);

    assert.equal(payload.assetNo, "ICT-001");
    assert.deepEqual(payload.details, {
      countyOffice: "Mombasa",
      deviceType: "Laptop",
    });
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "countyOffice"), false);
  });
});
