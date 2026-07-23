const assert = require("node:assert/strict");
const test = require("node:test");

const {
  USER_ADMIN_SAFETY_LOCK_KEYS,
  lockUserAdminSafety,
  isActiveAdminRow,
  countOtherActiveAdmins,
  ensureAnotherActiveAdmin,
} = require("../src/userAdminSafety");

test("lockUserAdminSafety acquires the shared transaction advisory lock", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return { rows: [] };
    },
  };

  await lockUserAdminSafety(client);

  assert.deepEqual(calls, [
    {
      text: "SELECT pg_advisory_xact_lock($1, $2)",
      params: USER_ADMIN_SAFETY_LOCK_KEYS,
    },
  ]);
});

test("isActiveAdminRow recognizes only active admin rows", () => {
  assert.equal(isActiveAdminRow({ role: "admin", is_active: true }), true);
  assert.equal(isActiveAdminRow({ role: " ADMIN ", is_active: true }), true);
  assert.equal(isActiveAdminRow({ role: "admin", is_active: false }), false);
  assert.equal(isActiveAdminRow({ role: "operator", is_active: true }), false);
  assert.equal(isActiveAdminRow(null), false);
});

test("countOtherActiveAdmins trims and normalizes roles in its query", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return { rows: [{ count: 2 }] };
    },
  };

  const count = await countOtherActiveAdmins(client, 7);

  assert.equal(count, 2);
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /lower\(trim\(role\)\) = \$1/);
  assert.deepEqual(calls[0].params, ["admin", 7]);
});

test("ensureAnotherActiveAdmin throws a 400 when no other active admin remains", async () => {
  const client = {
    async query() {
      return { rows: [{ count: 0 }] };
    },
  };

  await assert.rejects(
    () => ensureAnotherActiveAdmin(client, 3, "Cannot remove the last active admin."),
    (error) => {
      assert.equal(error.message, "Cannot remove the last active admin.");
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});

test("ensureAnotherActiveAdmin allows the mutation when another active admin exists", async () => {
  const client = {
    async query() {
      return { rows: [{ count: 1 }] };
    },
  };

  await assert.doesNotReject(() =>
    ensureAnotherActiveAdmin(client, 3, "Cannot remove the last active admin.")
  );
});
