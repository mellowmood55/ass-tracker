import { describe, expect, it } from "vitest";

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

    expect(state.assetNo).toBe("ICT-001");
    expect(state.countyOffice).toBe("Mombasa");
    expect(state.deviceType).toBe("Laptop");

    const payload = payloadFromForm(state, "computer", categoryWithCustomSharedField);

    expect(payload.assetNo).toBe("ICT-001");
    expect(payload.details).toEqual({
      countyOffice: "Mombasa",
      deviceType: "Laptop",
    });
    expect(Object.prototype.hasOwnProperty.call(payload, "countyOffice")).toBe(false);
  });
});
