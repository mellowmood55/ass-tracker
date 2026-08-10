const assert = require("node:assert/strict");
const test = require("node:test");

const dbPath = require.resolve("./db");

function loadImportJobsWithQuery(query) {
  delete require.cache[require.resolve("./importJobs")];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query,
      withTransaction: async (callback) => callback({ query }),
      isUniqueViolation: () => false,
    },
  };
  return require("./importJobs");
}

test("getImportJobForUser scopes import job lookup to the current user", async () => {
  const calls = [];
  const { getImportJobForUser } = loadImportJobsWithQuery(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  });

  const job = await getImportJobForUser(42, 7);

  assert.equal(job, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE id = \$1 AND created_by = \$2/);
  assert.deepEqual(calls[0].params, [42, 7]);
});

test("getImportJobForUser maps owned import jobs without changing response shape", async () => {
  const { getImportJobForUser } = loadImportJobsWithQuery(async () => ({
    rows: [
      {
        id: 42,
        category: "computer",
        status: "completed",
        progress_percent: 100,
        totals_json: JSON.stringify({ total: 1, imported: 1 }),
        error_message: null,
        created_by: 7,
        created_at: "2026-08-10T11:00:00.000Z",
        completed_at: "2026-08-10T11:01:00.000Z",
      },
    ],
  }));

  const job = await getImportJobForUser(42, 7);

  assert.deepEqual(job, {
    id: 42,
    category: "computer",
    status: "completed",
    progressPercent: 100,
    totals: { total: 1, imported: 1 },
    errorMessage: null,
    createdBy: 7,
    createdAt: "2026-08-10T11:00:00.000Z",
    completedAt: "2026-08-10T11:01:00.000Z",
  });
});
