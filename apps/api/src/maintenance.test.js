const assert = require("node:assert/strict");
const test = require("node:test");

const dbPath = require.resolve("./db");
const maintenancePath = require.resolve("./maintenance");

function loadMaintenanceWithDb(mockDb) {
  delete require.cache[maintenancePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockDb,
  };
  return require("./maintenance");
}

test("saveTemplate keeps checklist replacement inside a transaction", async () => {
  const calls = [];
  const insertFailure = new Error("template item insert failed");
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT id FROM maintenance_checklist_templates")) {
        return { rows: [{ id: 42 }] };
      }
      if (sql.includes("INSERT INTO maintenance_checklist_template_items")) {
        throw insertFailure;
      }
      return { rows: [] };
    },
  };

  const mockDb = {
    async query() {
      throw new Error("listTemplates should not run after a failed save");
    },
    async withTransaction(work) {
      calls.push({ sql: "BEGIN" });
      try {
        const result = await work(client);
        calls.push({ sql: "COMMIT" });
        return result;
      } catch (error) {
        calls.push({ sql: "ROLLBACK" });
        throw error;
      }
    },
  };

  const { saveTemplate } = loadMaintenanceWithDb(mockDb);

  await assert.rejects(
    () =>
      saveTemplate(
        "quarterly",
        "computer",
        { name: "Computer quarterly checklist", items: [{ label: "Verify backups" }] },
        7
      ),
    /template item insert failed/
  );

  assert.deepEqual(
    calls.map((call) => call.sql),
    [
      "BEGIN",
      `SELECT id FROM maintenance_checklist_templates
       WHERE cadence = $1 AND category = $2`,
      `UPDATE maintenance_checklist_templates
         SET name = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
         WHERE id = $3`,
      "DELETE FROM maintenance_checklist_template_items WHERE template_id = $1",
      `INSERT INTO maintenance_checklist_template_items (template_id, label, sort_order, description_hint)
         VALUES ($1, $2, $3, $4)`,
      "ROLLBACK",
    ]
  );
});
