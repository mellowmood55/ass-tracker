const assert = require("node:assert/strict");
const test = require("node:test");

const authModulePath = require.resolve("./auth");

function loadAuthWithSecret(secret) {
  delete require.cache[authModulePath];

  if (secret == null) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = secret;
  }

  return require("./auth");
}

test.afterEach(() => {
  delete require.cache[authModulePath];
  delete process.env.JWT_SECRET;
});

test("auth module fails fast when JWT_SECRET is missing", () => {
  assert.throws(
    () => loadAuthWithSecret(null),
    /JWT_SECRET is required and must be set to a private, non-placeholder value/
  );
});

test("auth module rejects the public example JWT secret", () => {
  assert.throws(
    () => loadAuthWithSecret("change-this-secret-in-production"),
    /JWT_SECRET is required and must be set to a private, non-placeholder value/
  );
});

test("auth module signs and accepts tokens with a private secret", () => {
  const { signToken, requireAuth } = loadAuthWithSecret(
    "test-only-private-jwt-secret-value"
  );
  const token = signToken({ id: 7, username: "admin", role: "admin" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    statusCode: null,
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
  let calledNext = false;

  requireAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, null);
  assert.equal(req.user.sub, 7);
  assert.equal(req.user.username, "admin");
  assert.equal(req.user.role, "admin");
});
