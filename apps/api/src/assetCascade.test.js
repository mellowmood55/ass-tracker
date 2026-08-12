const test = require("node:test");
const assert = require("node:assert/strict");

const { applyAssignmentCascade, getDepartment } = require("./assetCascade");

test("getDepartment prefers the active office field over legacy department details", () => {
  assert.equal(
    getDepartment({
      office: "ICT",
      details: { department: "Finance" },
    }),
    "ICT"
  );
});

test("applyAssignmentCascade migrates legacy department details into office", () => {
  const result = applyAssignmentCascade(
    {
      location: "9TH Floor (A)",
      office: null,
      details: { department: "Finance", assignedRoom: "Alice" },
    },
    {
      location: "9TH Floor (A)",
      office: null,
      details: { department: "Finance", assignedRoom: "Alice" },
    }
  );

  assert.equal(result.office, "Finance");
  assert.equal(result.details.department, undefined);
  assert.equal(result.details.assignedRoom, "Alice");
  assert.deepEqual(result.warnings, []);
});

test("applyAssignmentCascade clears assignee when only location changes", () => {
  const result = applyAssignmentCascade(
    {
      location: "9TH Floor (A)",
      office: "Finance",
      details: { assignedRoom: "Alice" },
    },
    {
      location: "10th floor",
      office: "Finance",
      details: {},
    }
  );

  assert.equal(result.office, "Finance");
  assert.equal(result.details.assignedRoom, "");
  assert.equal(result.warnings.length, 1);
});

test("applyAssignmentCascade clears unchanged assignee when office changes", () => {
  const result = applyAssignmentCascade(
    {
      location: "9TH Floor (A)",
      office: "Finance",
      details: { assignedRoom: "Alice" },
    },
    {
      location: "9TH Floor (A)",
      office: "ICT",
      details: { assignedRoom: "Alice" },
    }
  );

  assert.equal(result.office, "ICT");
  assert.equal(result.details.assignedRoom, "");
  assert.equal(result.warnings.length, 1);
});

test("applyAssignmentCascade preserves a newly supplied assignee when office changes", () => {
  const result = applyAssignmentCascade(
    {
      location: "9TH Floor (A)",
      office: "Finance",
      details: { assignedRoom: "Alice" },
    },
    {
      location: "9TH Floor (A)",
      office: "ICT",
      details: { assignedRoom: "Bob" },
    }
  );

  assert.equal(result.office, "ICT");
  assert.equal(result.details.assignedRoom, "Bob");
  assert.deepEqual(result.warnings, []);
});
