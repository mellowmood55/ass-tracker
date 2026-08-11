const { query, withTransaction } = require("./db");

const CADENCES = ["quarterly", "monthly"];
const MAINT_CATEGORIES = ["computer", "printer"];

const DEFAULT_COMPUTER_ITEMS = [
  "Dust cleaning and physical inspection",
  "Verify OS updates and patches",
  "Check antivirus status and subscription",
  "Test keyboard, mouse, and display",
  "Verify network connectivity",
  "Backup confirmation / user data check",
];

const DEFAULT_PRINTER_ITEMS = [
  "Clean paper path and rollers",
  "Check toner / ink levels",
  "Print test page",
  "Verify network / USB connectivity",
  "Inspect for paper jams and wear",
  "Update firmware if available",
];

function currentCalendarQuarter(date = new Date()) {
  const month = date.getMonth();
  return Math.floor(month / 3) + 1;
}

function currentCalendarMonth(date = new Date()) {
  return date.getMonth() + 1;
}

function currentCalendarYear(date = new Date()) {
  return date.getFullYear();
}

function normalizeCadence(value) {
  const cadence = String(value || "quarterly").toLowerCase().trim();
  return CADENCES.includes(cadence) ? cadence : "quarterly";
}

function parseDetails(raw) {
  if (typeof raw === "object" && raw) return raw;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function issueFieldsFromRow(row = {}) {
  return {
    hardwareType: row.hardware_type || "",
    hardwarePart: row.hardware_part || "",
    hardwareReports: row.hardware_reports || "",
    hardwareDescription: row.hardware_description || "",
    softwareType: row.software_type || "",
    softwarePrograms: row.software_programs || "",
    softwareReports: row.software_reports || "",
    softwareDescription: row.software_description || "",
    solution: row.solution || "",
    preparedBy: row.prepared_by || "",
    doneBy: row.done_by || "",
  };
}

function isCompleteRecord(items, fields) {
  const allChecked = items.length > 0 && items.every((item) => item.checked);
  return allChecked && hasText(fields.solution) && hasText(fields.doneBy);
}

async function seedMaintenanceTemplates() {
  const existing = await query(
    `SELECT category, COALESCE(cadence, 'quarterly') AS cadence
     FROM maintenance_checklist_templates`
  );
  const have = new Set(existing.rows.map((row) => `${row.cadence}:${row.category}`));

  async function seed(cadence, category, items) {
    const key = `${cadence}:${category}`;
    if (have.has(key)) return;
    const template = await query(
      `INSERT INTO maintenance_checklist_templates (category, cadence, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (cadence, category) DO NOTHING
       RETURNING id`,
      [category, cadence, `${category} ${cadence} checklist`]
    );
    const templateId = template.rows[0]?.id;
    if (!templateId) return;
    for (let i = 0; i < items.length; i += 1) {
      await query(
        `INSERT INTO maintenance_checklist_template_items (template_id, label, sort_order)
         VALUES ($1, $2, $3)`,
        [templateId, items[i], i]
      );
    }
  }

  for (const cadence of CADENCES) {
    await seed(cadence, "computer", DEFAULT_COMPUTER_ITEMS);
    await seed(cadence, "printer", DEFAULT_PRINTER_ITEMS);
  }
}

async function listTemplates() {
  const templates = await query(
    `SELECT id, category, COALESCE(cadence, 'quarterly') AS cadence, name, updated_at
     FROM maintenance_checklist_templates
     ORDER BY cadence, category`
  );
  const items = await query(
    `SELECT id, template_id, label, sort_order, description_hint
     FROM maintenance_checklist_template_items
     ORDER BY sort_order, id`
  );

  return templates.rows.map((template) => ({
    id: template.id,
    category: template.category,
    cadence: template.cadence,
    name: template.name,
    updatedAt: template.updated_at,
    items: items.rows
      .filter((item) => item.template_id === template.id)
      .map((item) => ({
        id: item.id,
        label: item.label,
        sortOrder: item.sort_order,
        descriptionHint: item.description_hint,
      })),
  }));
}

async function saveTemplate(cadence, category, { name, items }, actorId) {
  const normalizedCadence = normalizeCadence(cadence);
  if (!MAINT_CATEGORIES.includes(category)) {
    throw new Error("Checklist category must be computer or printer.");
  }

  const defaultName = `${category} ${normalizedCadence} checklist`;
  const list = Array.isArray(items) ? items : [];

  await withTransaction(async (client) => {
    const templateResult = await client.query(
      `SELECT id FROM maintenance_checklist_templates
       WHERE cadence = $1 AND category = $2`,
      [normalizedCadence, category]
    );

    let templateId;
    if (templateResult.rows[0]) {
      templateId = templateResult.rows[0].id;
      await client.query(
        `UPDATE maintenance_checklist_templates
         SET name = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
         WHERE id = $3`,
        [name || defaultName, actorId, templateId]
      );
      await client.query(`DELETE FROM maintenance_checklist_template_items WHERE template_id = $1`, [
        templateId,
      ]);
    } else {
      const created = await client.query(
        `INSERT INTO maintenance_checklist_templates (category, cadence, name, updated_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [category, normalizedCadence, name || defaultName, actorId]
      );
      templateId = created.rows[0].id;
    }

    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      await client.query(
        `INSERT INTO maintenance_checklist_template_items (template_id, label, sort_order, description_hint)
         VALUES ($1, $2, $3, $4)`,
        [templateId, item.label, i, item.descriptionHint || null]
      );
    }
  });

  const all = await listTemplates();
  return all.find(
    (entry) => entry.cadence === normalizedCadence && entry.category === category
  );
}

async function getTemplate(cadence, category) {
  const templates = await listTemplates();
  return (
    templates.find(
      (entry) => entry.cadence === normalizeCadence(cadence) && entry.category === category
    ) || null
  );
}

async function findRecordRow(assetId, { year, cadence, quarter, month }) {
  const normalized = normalizeCadence(cadence);
  if (normalized === "monthly") {
    const result = await query(
      `SELECT * FROM maintenance_records
       WHERE asset_id = $1 AND year = $2 AND cadence = 'monthly' AND month = $3`,
      [assetId, year, month]
    );
    return result.rows[0] || null;
  }
  const result = await query(
    `SELECT * FROM maintenance_records
     WHERE asset_id = $1 AND year = $2 AND cadence = 'quarterly' AND quarter = $3`,
    [assetId, year, quarter]
  );
  return result.rows[0] || null;
}

async function ensureRecord(assetId, { year, cadence, quarter, month }, userId) {
  const normalized = normalizeCadence(cadence);
  const targetYear = year || currentCalendarYear();
  const targetQuarter =
    normalized === "quarterly" ? Number(quarter) || currentCalendarQuarter() : null;
  const targetMonth =
    normalized === "monthly" ? Number(month) || currentCalendarMonth() : null;

  if (normalized === "quarterly" && (targetQuarter < 1 || targetQuarter > 4)) {
    throw new Error("Quarter must be between 1 and 4.");
  }
  if (normalized === "monthly" && (targetMonth < 1 || targetMonth > 12)) {
    throw new Error("Month must be between 1 and 12.");
  }

  const existing = await findRecordRow(assetId, {
    year: targetYear,
    cadence: normalized,
    quarter: targetQuarter,
    month: targetMonth,
  });
  if (existing) {
    return loadRecord(existing.id);
  }

  const assetResult = await query("SELECT category FROM assets WHERE id = $1", [assetId]);
  if (!assetResult.rows[0]) {
    return null;
  }
  const category = assetResult.rows[0].category;
  const template = await getTemplate(normalized, category);
  if (!template) {
    throw new Error(
      `No ${normalized} maintenance checklist template for category '${category}'.`
    );
  }

  const created = await query(
    `INSERT INTO maintenance_records (
       asset_id, year, cadence, quarter, month, status, created_by
     ) VALUES ($1, $2, $3, $4, $5, 'in_progress', $6)
     RETURNING *`,
    [assetId, targetYear, normalized, targetQuarter, targetMonth, userId]
  );
  const recordId = created.rows[0].id;

  for (const item of template.items) {
    await query(
      `INSERT INTO maintenance_record_items (
         record_id, template_item_id, label_snapshot, checked, description
       ) VALUES ($1, $2, $3, FALSE, '')`,
      [recordId, item.id, item.label]
    );
  }

  return loadRecord(recordId);
}

async function loadRecord(recordId) {
  const recordResult = await query("SELECT * FROM maintenance_records WHERE id = $1", [recordId]);
  if (!recordResult.rows[0]) return null;
  const row = recordResult.rows[0];
  const itemsResult = await query(
    `SELECT * FROM maintenance_record_items WHERE record_id = $1 ORDER BY id`,
    [recordId]
  );

  const items = itemsResult.rows.map((item) => ({
    id: item.id,
    templateItemId: item.template_item_id,
    label: item.label_snapshot,
    checked: item.checked,
    description: item.description || "",
    completedAt: item.completed_at,
  }));

  const fields = issueFieldsFromRow(row);
  const complete = isCompleteRecord(items, fields);
  const status = complete ? "complete" : "in_progress";

  return {
    id: row.id,
    assetId: row.asset_id,
    year: row.year,
    cadence: row.cadence || "quarterly",
    quarter: row.quarter,
    month: row.month,
    status,
    statusLabel: status === "complete" ? "complete" : "in progress",
    completedAt: row.completed_at,
    items,
    ...fields,
  };
}

async function updateRecord(recordId, payload, userId) {
  const record = await loadRecord(recordId);
  if (!record) return null;

  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const incoming of items) {
    const checked = Boolean(incoming.checked);
    await query(
      `UPDATE maintenance_record_items
       SET checked = $1,
           description = $2,
           completed_at = CASE WHEN $1 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END
       WHERE id = $3 AND record_id = $4`,
      [checked, incoming.description || "", incoming.id, recordId]
    );
  }

  const fields = {
    hardwareType: payload.hardwareType ?? record.hardwareType,
    hardwarePart: payload.hardwarePart ?? record.hardwarePart,
    hardwareReports: payload.hardwareReports ?? record.hardwareReports,
    hardwareDescription: payload.hardwareDescription ?? record.hardwareDescription,
    softwareType: payload.softwareType ?? record.softwareType,
    softwarePrograms: payload.softwarePrograms ?? record.softwarePrograms,
    softwareReports: payload.softwareReports ?? record.softwareReports,
    softwareDescription: payload.softwareDescription ?? record.softwareDescription,
    solution: payload.solution ?? record.solution,
    preparedBy: payload.preparedBy ?? record.preparedBy,
    doneBy: payload.doneBy ?? record.doneBy,
  };

  await query(
    `UPDATE maintenance_records SET
       hardware_type = $1,
       hardware_part = $2,
       hardware_reports = $3,
       hardware_description = $4,
       software_type = $5,
       software_programs = $6,
       software_reports = $7,
       software_description = $8,
       solution = $9,
       prepared_by = $10,
       done_by = $11,
       updated_by = $12,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $13`,
    [
      String(fields.hardwareType || ""),
      String(fields.hardwarePart || ""),
      String(fields.hardwareReports || ""),
      String(fields.hardwareDescription || ""),
      String(fields.softwareType || ""),
      String(fields.softwarePrograms || ""),
      String(fields.softwareReports || ""),
      String(fields.softwareDescription || ""),
      String(fields.solution || ""),
      String(fields.preparedBy || ""),
      String(fields.doneBy || ""),
      userId,
      recordId,
    ]
  );

  const refreshed = await loadRecord(recordId);
  const complete = isCompleteRecord(refreshed.items, {
    solution: refreshed.solution,
    doneBy: refreshed.doneBy,
  });

  await query(
    `UPDATE maintenance_records
     SET status = $1,
         completed_at = CASE WHEN $2 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
         updated_by = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [complete ? "complete" : "in_progress", complete, userId, recordId]
  );

  return loadRecord(recordId);
}

async function listMaintenanceAssets({ year, category, cadence } = {}) {
  const targetYear = year || currentCalendarYear();
  const normalizedCadence = normalizeCadence(cadence || "quarterly");
  const params = [];
  let categoryClause = "";
  if (category) {
    params.push(category);
    categoryClause = `AND a.category = $${params.length}`;
  } else {
    categoryClause = `AND a.category IN ('computer', 'printer')`;
  }

  const assetsResult = await query(
    `SELECT a.*
     FROM assets a
     WHERE 1=1 ${categoryClause}
     ORDER BY a.office NULLS LAST, a.asset_no NULLS LAST, a.id`,
    params
  );

  const recordsResult = await query(
    `SELECT * FROM maintenance_records
     WHERE year = $1 AND COALESCE(cadence, 'quarterly') = $2`,
    [targetYear, normalizedCadence]
  );

  const byAsset = new Map();
  for (const row of recordsResult.rows) {
    if (!byAsset.has(row.asset_id)) byAsset.set(row.asset_id, []);
    byAsset.get(row.asset_id).push(row);
  }

  return assetsResult.rows.map((row) => {
    const details = parseDetails(row.details_json);
    const periods =
      normalizedCadence === "monthly"
        ? Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, false]))
        : { 1: false, 2: false, 3: false, 4: false };
    const periodStatuses =
      normalizedCadence === "monthly"
        ? Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, null]))
        : { 1: null, 2: null, 3: null, 4: null };

    for (const record of byAsset.get(row.id) || []) {
      const key =
        normalizedCadence === "monthly" ? Number(record.month) : Number(record.quarter);
      if (!key) continue;
      const status = record.status === "managed" ? "complete" : record.status;
      periods[key] = status === "complete";
      periodStatuses[key] = status;
    }

    return {
      id: row.id,
      category: row.category,
      location: row.location,
      office: row.office,
      model: row.model,
      assetNo: row.asset_no,
      serialNo: row.serial_no,
      status: row.status,
      details: details || {},
      year: targetYear,
      cadence: normalizedCadence,
      periods,
      periodStatuses,
      // Back-compat aliases for quarterly UI during transition
      quarters: normalizedCadence === "quarterly" ? periods : undefined,
      quarterStatuses: normalizedCadence === "quarterly" ? periodStatuses : undefined,
      currentQuarter: currentCalendarQuarter(),
      currentMonth: currentCalendarMonth(),
    };
  });
}

async function buildMaintenanceReport(assetId, { year, cadence, quarter, month }) {
  const assetResult = await query("SELECT * FROM assets WHERE id = $1", [assetId]);
  if (!assetResult.rows[0]) return null;
  const asset = assetResult.rows[0];
  const details = parseDetails(asset.details_json);
  const normalized = normalizeCadence(cadence);
  const targetYear = year || currentCalendarYear();
  const targetQuarter =
    normalized === "quarterly" ? Number(quarter) || currentCalendarQuarter() : null;
  const targetMonth =
    normalized === "monthly" ? Number(month) || currentCalendarMonth() : null;

  const row = await findRecordRow(assetId, {
    year: targetYear,
    cadence: normalized,
    quarter: targetQuarter,
    month: targetMonth,
  });
  if (!row) return null;
  const record = await loadRecord(row.id);

  const categoryLabel =
    asset.category === "computer"
      ? "Computer"
      : asset.category === "printer"
        ? "Printer"
        : asset.category;

  return {
    asset: {
      id: asset.id,
      category: asset.category,
      categoryLabel,
      location: asset.location,
      office: asset.office || details.department || "",
      model: asset.model,
      assetNo: asset.asset_no,
      serialNo: asset.serial_no,
      assignedRoom: details.assignedRoom || "",
      contactName: details.assignedRoom || "",
    },
    year: targetYear,
    cadence: normalized,
    quarter: targetQuarter,
    month: targetMonth,
    status: record.status,
    statusLabel: record.statusLabel,
    completedAt: record.completedAt,
    hardwareType: record.hardwareType,
    hardwarePart: record.hardwarePart,
    hardwareReports: record.hardwareReports,
    hardwareDescription: record.hardwareDescription,
    softwareType: record.softwareType,
    softwarePrograms: record.softwarePrograms,
    softwareReports: record.softwareReports,
    softwareDescription: record.softwareDescription,
    solution: record.solution,
    preparedBy: record.preparedBy || record.doneBy,
    doneBy: record.doneBy,
    // Checklist intentionally omitted from report consumers
  };
}

module.exports = {
  seedMaintenanceTemplates,
  listTemplates,
  saveTemplate,
  ensureRecord,
  loadRecord,
  updateRecord,
  listMaintenanceAssets,
  buildMaintenanceReport,
  currentCalendarQuarter,
  currentCalendarMonth,
  currentCalendarYear,
  normalizeCadence,
  CADENCES,
  DEFAULT_COMPUTER_ITEMS,
  DEFAULT_PRINTER_ITEMS,
};
