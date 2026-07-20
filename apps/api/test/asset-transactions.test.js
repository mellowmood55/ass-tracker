const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

process.env.DATABASE_URL = "postgres://asset-test:asset-test@localhost:5432/asset-test";

const dbPath = path.resolve(__dirname, "../src/db.js");
const authPath = path.resolve(__dirname, "../src/auth.js");

const transactions = [];
let currentClient = null;
const originalConsoleError = console.error;

function makeAssetRow(overrides = {}) {
  return {
    id: 101,
    category: "software",
    location: null,
    office: null,
    model: null,
    asset_no: null,
    serial_no: null,
    status: "Active",
    details_json: { description: "Payroll", function: "Salary processing" },
    created_at: "2026-07-20T11:00:00.000Z",
    updated_at: "2026-07-20T11:00:00.000Z",
    ...overrides,
  };
}

function makeClient({ failAudit = false, existing = makeAssetRow() } = {}) {
  const state = {
    committed: false,
    rolledBack: false,
    statements: [],
  };

  const client = {
    state,
    async query(text) {
      const compact = String(text).replace(/\s+/g, " ").trim();
      state.statements.push(compact);

      if (compact === "BEGIN" || compact === "COMMIT" || compact === "ROLLBACK") {
        if (compact === "COMMIT") state.committed = true;
        if (compact === "ROLLBACK") state.rolledBack = true;
        return { rows: [] };
      }

      if (compact.startsWith("SELECT * FROM assets")) {
        return { rows: existing ? [existing] : [] };
      }

      if (compact.startsWith("INSERT INTO assets")) {
        return { rows: [makeAssetRow()] };
      }

      if (compact.startsWith("UPDATE assets")) {
        return { rows: [makeAssetRow({ model: "Updated model" })] };
      }

      if (compact.startsWith("DELETE FROM assets")) {
        return { rows: [] };
      }

      if (compact.startsWith("INSERT INTO audit_logs")) {
        if (failAudit) {
          throw new Error("audit log unavailable");
        }
        return { rows: [] };
      }

      throw new Error(`Unexpected SQL in test: ${compact}`);
    },
  };

  return client;
}

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async () => ({ rows: [] }),
    withTransaction: async (work) => {
      if (!currentClient) {
        throw new Error("Test client not configured");
      }

      const client = currentClient;
      transactions.push(client.state);
      await client.query("BEGIN");
      try {
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
    initDb: async () => {},
    isUniqueViolation: () => false,
  },
};

require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    signToken: () => "test-token",
    requireAuth: (req, _res, next) => {
      req.user = { sub: 1, username: "admin", role: "admin" };
      next();
    },
  },
};

const { app } = require("../src/index");

function listen() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(method, pathName, body) {
  const server = await listen();
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${pathName}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = response.status === 204 ? null : await response.json();
    return { response, payload };
  } finally {
    await close(server);
  }
}

const validSoftwarePayload = {
  category: "software",
  status: "Active",
  details: {
    description: "Payroll",
    function: "Salary processing",
  },
};

test.afterEach(() => {
  console.error = originalConsoleError;
  currentClient = null;
  transactions.length = 0;
});

test("create asset rolls back when the audit log write fails", async () => {
  console.error = () => {};
  currentClient = makeClient({ failAudit: true });

  const { response, payload } = await request("POST", "/api/assets", validSoftwarePayload);

  assert.equal(response.status, 500);
  assert.equal(payload.message, "Failed to create asset.");
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].committed, false);
  assert.equal(transactions[0].rolledBack, true);
  assert(transactions[0].statements.some((statement) => statement.startsWith("INSERT INTO assets")));
  assert(transactions[0].statements.some((statement) => statement.startsWith("INSERT INTO audit_logs")));
});

test("update asset rolls back when the audit log write fails", async () => {
  console.error = () => {};
  currentClient = makeClient({ failAudit: true });

  const { response, payload } = await request("PUT", "/api/assets/101", validSoftwarePayload);

  assert.equal(response.status, 500);
  assert.equal(payload.message, "Failed to update asset.");
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].committed, false);
  assert.equal(transactions[0].rolledBack, true);
  assert(transactions[0].statements.some((statement) => statement.startsWith("UPDATE assets")));
  assert(transactions[0].statements.some((statement) => statement.startsWith("INSERT INTO audit_logs")));
});

test("delete asset rolls back when the audit log write fails", async () => {
  console.error = () => {};
  currentClient = makeClient({ failAudit: true });

  const { response, payload } = await request("DELETE", "/api/assets/101");

  assert.equal(response.status, 500);
  assert.equal(payload.message, "Failed to delete asset.");
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].committed, false);
  assert.equal(transactions[0].rolledBack, true);
  assert(transactions[0].statements.some((statement) => statement.startsWith("DELETE FROM assets")));
  assert(transactions[0].statements.some((statement) => statement.startsWith("INSERT INTO audit_logs")));
});
