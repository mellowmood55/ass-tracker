const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/test";

const { canAutofillDuplicate } = require("./importJobs");

test("duplicate autofill only targets assets in the import category", () => {
  assert.equal(canAutofillDuplicate({ category: "computer" }, "computer"), true);
  assert.equal(canAutofillDuplicate({ category: "printer" }, "computer"), false);
  assert.equal(canAutofillDuplicate(null, "computer"), false);
});
