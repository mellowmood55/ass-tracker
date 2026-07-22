const assert = require("node:assert/strict");
const test = require("node:test");

const { createRequireAuth, requireAdmin, signToken, ROLES } = require("../src/auth");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runRequireAuth({ token, findCurrentUser }) {
  const req = {
    headers: {
      authorization: token ? `Bearer ${token}` : "",
    },
  };
  const res = createResponse();
  let nextCalled = false;
  const middleware = createRequireAuth({ findCurrentUser });

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
}

test("requireAuth uses the current database role instead of a stale JWT role", async () => {
  const token = signToken({ id: 7, username: "alice", role: ROLES.ADMIN });

  const { req, res, nextCalled } = await runRequireAuth({
    token,
    findCurrentUser: async () => ({
      id: 7,
      username: "alice",
      role: ROLES.OPERATOR,
      is_active: true,
    }),
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(req.user, {
    sub: 7,
    username: "alice",
    role: ROLES.OPERATOR,
  });

  const adminRes = createResponse();
  let adminNextCalled = false;
  requireAdmin(req, adminRes, () => {
    adminNextCalled = true;
  });

  assert.equal(adminNextCalled, false);
  assert.equal(adminRes.statusCode, 403);
});

test("requireAuth rejects a token for a deactivated current user", async () => {
  const token = signToken({ id: 8, username: "bob", role: ROLES.ADMIN });

  const { res, nextCalled } = await runRequireAuth({
    token,
    findCurrentUser: async () => ({
      id: 8,
      username: "bob",
      role: ROLES.ADMIN,
      is_active: false,
    }),
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "This account is deactivated. Contact an admin.");
});
