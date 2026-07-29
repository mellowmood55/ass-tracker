const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");

const dbPath = path.join(__dirname, "..", "src", "db.js");

function loadDbWithMockPool({ duplicateUsername } = {}) {
  const queries = [];
  const originalLoad = Module._load;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDefaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  const originalResetDefaultAdminPassword = process.env.RESET_DEFAULT_ADMIN_PASSWORD;

  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/assets";
  process.env.DEFAULT_ADMIN_PASSWORD = "strong-admin-password";
  delete process.env.RESET_DEFAULT_ADMIN_PASSWORD;
  delete require.cache[dbPath];

  class MockPool {
    query(text, params = []) {
      const queryText = String(text);
      queries.push({ text: queryText, params });

      if (queryText.includes("GROUP BY lower(username)")) {
        return Promise.resolve({
          rows: duplicateUsername
            ? [{ normalized_username: duplicateUsername }]
            : [],
        });
      }

      if (queryText.includes("SELECT id FROM users WHERE lower(username) = lower($1)")) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    }
  }

  Module._load = function mockLoad(request, parent, isMain) {
    if (request === "pg") {
      return { Pool: MockPool };
    }
    if (request === "bcryptjs") {
      return { hash: async () => "hashed-password" };
    }
    if (request === "./categoryConfig" && parent?.filename === dbPath) {
      return {
        seedCategoryFieldConfigs: async () => {},
        patchStoredCategoryDefaults: async () => {},
        refreshConfigCache: async () => {},
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const db = require(dbPath);

  function restore() {
    Module._load = originalLoad;
    delete require.cache[dbPath];

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalDefaultAdminPassword === undefined) {
      delete process.env.DEFAULT_ADMIN_PASSWORD;
    } else {
      process.env.DEFAULT_ADMIN_PASSWORD = originalDefaultAdminPassword;
    }

    if (originalResetDefaultAdminPassword === undefined) {
      delete process.env.RESET_DEFAULT_ADMIN_PASSWORD;
    } else {
      process.env.RESET_DEFAULT_ADMIN_PASSWORD = originalResetDefaultAdminPassword;
    }
  }

  return { db, queries, restore };
}

test("initDb enforces case-insensitive username uniqueness in Postgres", async () => {
  const { db, queries, restore } = loadDbWithMockPool();
  try {
    await db.initDb();
  } finally {
    restore();
  }

  const queryTexts = queries.map((entry) => entry.text);
  const duplicateCheckIndex = queryTexts.findIndex((text) =>
    text.includes("GROUP BY lower(username)")
  );
  const uniqueIndexIndex = queryTexts.findIndex((text) =>
    text.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique")
  );
  const adminLookup = queries.find((entry) =>
    entry.text.includes("SELECT id FROM users WHERE lower(username) = lower($1)")
  );

  assert.notEqual(duplicateCheckIndex, -1);
  assert.notEqual(uniqueIndexIndex, -1);
  assert.ok(
    duplicateCheckIndex < uniqueIndexIndex,
    "duplicate case-variant usernames should be detected before creating the index"
  );
  assert.match(queryTexts[uniqueIndexIndex], /ON users \(lower\(username\)\)/);
  assert.deepEqual(adminLookup?.params, ["admin"]);
});

test("initDb fails closed when existing usernames differ only by case", async () => {
  const { db, queries, restore } = loadDbWithMockPool({ duplicateUsername: "admin" });
  try {
    await assert.rejects(
      () => db.initDb(),
      /multiple usernames differ only by case \(admin\)/
    );
  } finally {
    restore();
  }

  assert.equal(
    queries.some((entry) =>
      entry.text.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique")
    ),
    false
  );
});
