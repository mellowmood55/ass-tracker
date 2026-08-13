const { query, withTransaction, isUniqueViolation } = require("./db");
const {
  getCachedCategoryConfig,
  normalizeImportRowWithConfig,
} = require("./categoryConfig");
const { validateAssetPayload, collectBlankRequiredFields } = require("./validation");
const {
  resolveUniqueConflict,
  duplicateFieldsFromConflictBody,
} = require("./duplicateConflict");
const { CATEGORY_CONFIG } = require("./catalog");

const SHARED_KEYS = ["location", "office", "model", "assetNo", "serialNo", "status"];
const UNIQUE_KEYS = new Set(["assetNo", "serialNo"]);

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

/** assets.status is NOT NULL — never pass SQL null on write. */
function statusForDb(value) {
  if (isEmptyValue(value)) return "";
  return String(value).trim();
}

function mapAssetRow(row) {
  const details =
    row.details_json == null
      ? {}
      : typeof row.details_json === "object"
        ? row.details_json
        : JSON.parse(row.details_json);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertAuditLog(client, { assetId, action, user, before, after }) {
  await client.query(
    `INSERT INTO audit_logs (
      asset_id, action, actor_id, actor_username, before_json, after_json
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      assetId,
      action,
      user.sub,
      user.username,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ]
  );
}

function mapImportJob(row) {
  const totals =
    row.totals_json == null
      ? {}
      : typeof row.totals_json === "object"
        ? row.totals_json
        : JSON.parse(row.totals_json);
  return {
    id: row.id,
    category: row.category,
    status: row.status,
    progressPercent: row.progress_percent,
    totals,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

async function createImportJob({ category, userId, totalRows }) {
  const result = await query(
    `INSERT INTO import_jobs (
      category, status, progress_percent, totals_json, created_by
    ) VALUES ($1, 'importing', 0, $2::jsonb, $3)
    RETURNING *`,
    [
      category,
      JSON.stringify({
        total: totalRows,
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      }),
      userId,
    ]
  );
  return mapImportJob(result.rows[0]);
}

async function updateImportJob(jobId, patch) {
  const fields = [];
  const params = [];

  if (patch.status != null) {
    params.push(patch.status);
    fields.push(`status = $${params.length}`);
  }
  if (patch.progressPercent != null) {
    params.push(patch.progressPercent);
    fields.push(`progress_percent = $${params.length}`);
  }
  if (patch.totals != null) {
    params.push(JSON.stringify(patch.totals));
    fields.push(`totals_json = $${params.length}::jsonb`);
  }
  if (patch.errorMessage !== undefined) {
    params.push(patch.errorMessage);
    fields.push(`error_message = $${params.length}`);
  }
  if (patch.completedAt === true) {
    fields.push("completed_at = CURRENT_TIMESTAMP");
  }

  if (fields.length === 0) return getImportJob(jobId);

  params.push(jobId);
  const result = await query(
    `UPDATE import_jobs SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] ? mapImportJob(result.rows[0]) : null;
}

async function getImportJob(jobId) {
  const result = await query("SELECT * FROM import_jobs WHERE id = $1", [jobId]);
  return result.rows[0] ? mapImportJob(result.rows[0]) : null;
}

async function getLatestImportJob(userId) {
  const result = await query(
    `SELECT * FROM import_jobs
     WHERE created_by = $1
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ? mapImportJob(result.rows[0]) : null;
}

function computeAutofill(existing, incoming) {
  const filledFields = [];
  const next = {
    location: existing.location,
    office: existing.office,
    model: existing.model,
    assetNo: existing.assetNo,
    serialNo: existing.serialNo,
    status: existing.status,
    details: { ...(existing.details || {}) },
  };

  for (const key of SHARED_KEYS) {
    if (UNIQUE_KEYS.has(key)) continue;
    if (isEmptyValue(existing[key]) && !isEmptyValue(incoming[key])) {
      next[key] = incoming[key];
      filledFields.push(key);
    }
  }

  const incomingDetails = incoming.details || {};
  for (const [key, value] of Object.entries(incomingDetails)) {
    if (isEmptyValue(next.details[key]) && !isEmptyValue(value)) {
      next.details[key] = value;
      filledFields.push(key);
    }
  }

  return { next, filledFields };
}

function canAutofillDuplicate(existing, category) {
  return Boolean(existing && existing.category === category);
}

async function findExistingByIdentity(client, assetNo, serialNo) {
  if (assetNo) {
    const byAsset = await client.query(
      `SELECT * FROM assets
       WHERE asset_no IS NOT NULL AND trim(asset_no) <> '' AND asset_no = $1
       LIMIT 1`,
      [assetNo]
    );
    if (byAsset.rows[0]) return mapAssetRow(byAsset.rows[0]);
  }
  if (serialNo) {
    const bySerial = await client.query(
      `SELECT * FROM assets
       WHERE serial_no IS NOT NULL AND trim(serial_no) <> '' AND serial_no = $1
       LIMIT 1`,
      [serialNo]
    );
    if (bySerial.rows[0]) return mapAssetRow(bySerial.rows[0]);
  }
  return null;
}

async function processImportJob(jobId, { category, rows, user }) {
  const totals = {
    total: rows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  const needsAttention = [];
  const created = [];
  const updated = [];

  try {
    if (!CATEGORY_CONFIG[category] && !getCachedCategoryConfig(category)) {
      throw new Error(`Unknown category '${category}'.`);
    }

    await withTransaction(async (client) => {
      const seenAssetNos = new Set();
      const seenSerialNos = new Set();

      for (let index = 0; index < rows.length; index += 1) {
        const config = getCachedCategoryConfig(category);
        const row = normalizeImportRowWithConfig(rows[index], category, config);
        const payload = {
          category,
          location: row.location || null,
          office: row.office || null,
          model: row.model || null,
          assetNo: row.assetNo || null,
          serialNo: row.serialNo || null,
          status: statusForDb(row.status),
          details: row.details || {},
        };

        const blankFields = collectBlankRequiredFields(payload);
        if (isEmptyValue(payload.status) && !blankFields.includes("Status")) {
          blankFields.push("Status");
        }

        const result = validateAssetPayload(payload, { mode: "import", allowMissingLocation: true });
        if (!result.valid) {
          totals.failed += 1;
          needsAttention.push({
            row: index + 1,
            reason: "invalid",
            id: null,
            assetNo: payload.assetNo || null,
            serialNo: payload.serialNo || null,
            blankFields,
            message: result.errors.join(" "),
          });
          const percent = Math.round(((index + 1) / rows.length) * 100);
          if (index % 5 === 0 || index === rows.length - 1) {
            await updateImportJob(jobId, { progressPercent: percent, totals });
          }
          continue;
        }

        const asset = {
          ...result.data,
          status: statusForDb(result.data.status),
        };
        const assetNo = asset.assetNo || null;
        const serialNo = asset.serialNo || null;
        const duplicateFields = [];
        let existing = null;

        if (assetNo) {
          if (seenAssetNos.has(assetNo)) {
            duplicateFields.push("Asset No");
          } else {
            existing = await findExistingByIdentity(client, assetNo, null);
            if (existing) duplicateFields.push("Asset No");
          }
        }

        if (serialNo) {
          if (seenSerialNos.has(serialNo)) {
            if (!duplicateFields.includes("Serial No")) duplicateFields.push("Serial No");
          } else {
            const bySerial = await findExistingByIdentity(client, null, serialNo);
            if (bySerial) {
              if (!duplicateFields.includes("Serial No")) duplicateFields.push("Serial No");
              if (!existing) existing = bySerial;
            }
          }
        }

        if (duplicateFields.length > 0 && existing) {
          if (!canAutofillDuplicate(existing, category)) {
            totals.skipped += 1;
            needsAttention.push({
              row: index + 1,
              reason: "duplicate",
              id: existing.id,
              assetNo,
              serialNo,
              blankFields: [],
              duplicateFields,
              existingId: existing.id,
            });

            if (assetNo) seenAssetNos.add(assetNo);
            if (serialNo) seenSerialNos.add(serialNo);

            const percent = Math.round(((index + 1) / rows.length) * 100);
            if (index % 5 === 0 || index === rows.length - 1) {
              await updateImportJob(jobId, { progressPercent: percent, totals });
            }
            continue;
          }

          const { next, filledFields } = computeAutofill(existing, asset);
          next.status = statusForDb(next.status);
          if (filledFields.length > 0) {
            const savepoint = `sp_autofill_${index}`;
            await client.query(`SAVEPOINT ${savepoint}`);
            try {
              const updateResult = await client.query(
                `UPDATE assets SET
                  location = $1,
                  office = $2,
                  model = $3,
                  status = $4,
                  details_json = $5::jsonb,
                  updated_by = $6,
                  updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7
                 RETURNING *`,
                [
                  next.location || null,
                  next.office || null,
                  next.model || null,
                  next.status,
                  JSON.stringify(next.details || {}),
                  user.sub,
                  existing.id,
                ]
              );
              const mapped = mapAssetRow(updateResult.rows[0]);
              await insertAuditLog(client, {
                assetId: mapped.id,
                action: "import_autofill",
                user,
                before: existing,
                after: mapped,
              });
              await client.query(`RELEASE SAVEPOINT ${savepoint}`);
              totals.updated += 1;
              updated.push(mapped);
              needsAttention.push({
                row: index + 1,
                reason: "autofill",
                id: mapped.id,
                assetNo: mapped.assetNo || null,
                serialNo: mapped.serialNo || null,
                blankFields: [],
                filledFields,
                duplicateFields,
                existingId: mapped.id,
              });
            } catch (updateError) {
              await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
              totals.failed += 1;
              needsAttention.push({
                row: index + 1,
                reason: "error",
                id: existing.id,
                assetNo,
                serialNo,
                blankFields,
                duplicateFields,
                existingId: existing.id,
                message: updateError.message || "Failed to auto-fill duplicate row.",
              });
            }
          } else {
            totals.skipped += 1;
            needsAttention.push({
              row: index + 1,
              reason: "duplicate",
              id: existing.id,
              assetNo,
              serialNo,
              blankFields: [],
              duplicateFields,
              existingId: existing.id,
            });
          }

          if (assetNo) seenAssetNos.add(assetNo);
          if (serialNo) seenSerialNos.add(serialNo);

          const percent = Math.round(((index + 1) / rows.length) * 100);
          if (index % 5 === 0 || index === rows.length - 1) {
            await updateImportJob(jobId, { progressPercent: percent, totals });
          }
          continue;
        }

        if (duplicateFields.length > 0 && !existing) {
          totals.skipped += 1;
          needsAttention.push({
            row: index + 1,
            reason: "duplicate",
            id: null,
            assetNo,
            serialNo,
            blankFields: [],
            duplicateFields,
            existingId: null,
          });
          continue;
        }

        if (assetNo) seenAssetNos.add(assetNo);
        if (serialNo) seenSerialNos.add(serialNo);

        const savepoint = `sp_import_${index}`;
        try {
          await client.query(`SAVEPOINT ${savepoint}`);
          const insertResult = await client.query(
            `INSERT INTO assets (
              category, location, office, model, asset_no, serial_no, status,
              details_json, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
            RETURNING *`,
            [
              asset.category,
              asset.location || null,
              asset.office || null,
              asset.model || null,
              assetNo,
              serialNo,
              asset.status,
              JSON.stringify(asset.details || {}),
              user.sub,
              user.sub,
            ]
          );

          const mapped = mapAssetRow(insertResult.rows[0]);
          await insertAuditLog(client, {
            assetId: mapped.id,
            action: "create",
            user,
            before: null,
            after: mapped,
          });
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          totals.imported += 1;
          created.push(mapped);

          if (blankFields.length > 0) {
            needsAttention.push({
              row: index + 1,
              reason: "blank",
              id: mapped.id,
              assetNo: mapped.assetNo || null,
              serialNo: mapped.serialNo || null,
              blankFields,
            });
          }
        } catch (insertError) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          if (!isUniqueViolation(insertError)) {
            totals.failed += 1;
            needsAttention.push({
              row: index + 1,
              reason: "error",
              id: null,
              assetNo,
              serialNo,
              blankFields,
              message: insertError.message || "Failed to import row.",
            });
            const percent = Math.round(((index + 1) / rows.length) * 100);
            if (index % 5 === 0 || index === rows.length - 1) {
              await updateImportJob(jobId, { progressPercent: percent, totals });
            }
            continue;
          }

          const conflictBody = await resolveUniqueConflict(insertError, asset);
          const raceDuplicateFields =
            duplicateFieldsFromConflictBody(conflictBody).length > 0
              ? duplicateFieldsFromConflictBody(conflictBody)
              : ["Asset No or Serial No"];
          const raceExistingId = conflictBody.conflicts?.[0]?.existingId ?? null;

          if (raceExistingId) {
            const existingResult = await client.query("SELECT * FROM assets WHERE id = $1", [
              raceExistingId,
            ]);
            if (existingResult.rows[0]) {
              const raceExisting = mapAssetRow(existingResult.rows[0]);
              if (canAutofillDuplicate(raceExisting, category)) {
                const { next, filledFields } = computeAutofill(raceExisting, asset);
                next.status = statusForDb(next.status);
                if (filledFields.length > 0) {
                  try {
                    const updateResult = await client.query(
                      `UPDATE assets SET
                        location = $1, office = $2, model = $3, status = $4,
                        details_json = $5::jsonb, updated_by = $6, updated_at = CURRENT_TIMESTAMP
                       WHERE id = $7 RETURNING *`,
                      [
                        next.location || null,
                        next.office || null,
                        next.model || null,
                        next.status,
                        JSON.stringify(next.details || {}),
                        user.sub,
                        raceExisting.id,
                      ]
                    );
                    const mapped = mapAssetRow(updateResult.rows[0]);
                    await insertAuditLog(client, {
                      assetId: mapped.id,
                      action: "import_autofill",
                      user,
                      before: raceExisting,
                      after: mapped,
                    });
                    totals.updated += 1;
                    updated.push(mapped);
                    needsAttention.push({
                      row: index + 1,
                      reason: "autofill",
                      id: mapped.id,
                      assetNo: mapped.assetNo || null,
                      serialNo: mapped.serialNo || null,
                      blankFields: [],
                      filledFields,
                      duplicateFields: raceDuplicateFields,
                      existingId: mapped.id,
                    });
                    const percent = Math.round(((index + 1) / rows.length) * 100);
                    if (index % 5 === 0 || index === rows.length - 1) {
                      await updateImportJob(jobId, { progressPercent: percent, totals });
                    }
                    continue;
                  } catch (raceUpdateError) {
                    totals.failed += 1;
                    needsAttention.push({
                      row: index + 1,
                      reason: "error",
                      id: raceExisting.id,
                      assetNo,
                      serialNo,
                      blankFields,
                      duplicateFields: raceDuplicateFields,
                      existingId: raceExisting.id,
                      message: raceUpdateError.message || "Failed to auto-fill duplicate row.",
                    });
                    continue;
                  }
                }
              }
            }
          }

          totals.skipped += 1;
          needsAttention.push({
            row: index + 1,
            reason: "duplicate",
            id: raceExistingId,
            assetNo,
            serialNo,
            blankFields: [],
            duplicateFields: raceDuplicateFields,
            existingId: raceExistingId,
          });
        }

        const percent = Math.round(((index + 1) / rows.length) * 100);
        if (index % 5 === 0 || index === rows.length - 1) {
          await updateImportJob(jobId, { progressPercent: percent, totals });
        }
      }
    });

    const completedTotals = {
      ...totals,
      needsAttention,
      assets: created,
      updatedAssets: updated,
    };

    await updateImportJob(jobId, {
      status: "completed",
      progressPercent: 100,
      totals: completedTotals,
      errorMessage: null,
      completedAt: true,
    });

    return completedTotals;
  } catch (error) {
    totals.failed = Math.max(totals.failed, 1);
    await updateImportJob(jobId, {
      status: "failed",
      totals,
      errorMessage: error.message || "Import failed.",
      completedAt: true,
    });
    throw error;
  }
}

module.exports = {
  createImportJob,
  updateImportJob,
  getImportJob,
  getLatestImportJob,
  processImportJob,
  computeAutofill,
  canAutofillDuplicate,
  mapImportJob,
};
