const assert = require("node:assert/strict");
const test = require("node:test");

process.env.JWT_SECRET = "session-version-test-secret";

const { createRequireAuth, signToken } = require("./auth");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invokeRequireAuth(token, verifySessionVersion) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;
  const middleware = createRequireAuth({ verifySessionVersion });

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
}

test("requireAuth accepts a token whose session version matches the database", async () => {
  const token = signToken({
    id: 42,
    username: "admin",
    role: "admin",
    session_version: 3,
  });

  const { req, res, nextCalled } = await invokeRequireAuth(
    token,
    async (userId, sessionVersion) => userId === 42 && sessionVersion === 3
  );

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
  assert.equal(req.user.sub, 42);
  assert.equal(req.user.role, "admin");
  assert.equal(req.user.sessionVersion, 3);
});

test("requireAuth rejects a token whose session version is stale", async () => {
  const token = signToken({
    id: 7,
    username: "operator",
    role: "operator",
    session_version: 1,
  });

  const { res, nextCalled } = await invokeRequireAuth(token, async () => false);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "Session expired. Please sign in again." });
});
