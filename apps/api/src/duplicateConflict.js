const { query, isUniqueViolation } = require("./db");

function normalizeIdentityValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function buildDuplicateConflictBody(conflicts) {
  if (!conflicts.length) {
    return {
      message: "Asset No or Serial No already exists.",
      code: "DUPLICATE_ASSET",
      conflicts: [],
    };
  }

  const labels = conflicts.map((entry) =>
    entry.field === "assetNo" ? "Asset No" : "Serial No"
  );
  let message;
  if (labels.length === 1) {
    message = `This ${labels[0]} already exists.`;
  } else {
    message = `This ${labels.join(" and ")} already exist.`;
  }

  return {
    message,
    code: "DUPLICATE_ASSET",
    conflicts,
  };
}

async function lookupIdentityConflicts({ assetNo, serialNo, excludeId = null }) {
  const conflicts = [];

  if (assetNo) {
    const result = await query(
      `SELECT id FROM assets
       WHERE asset_no IS NOT NULL AND trim(asset_no) <> '' AND asset_no = $1
         AND ($2::int IS NULL OR id <> $2)
       LIMIT 1`,
      [assetNo, excludeId]
    );
    if (result.rows[0]) {
      conflicts.push({
        field: "assetNo",
        value: assetNo,
        existingId: result.rows[0].id,
      });
    }
  }

  if (serialNo) {
    const result = await query(
      `SELECT id FROM assets
       WHERE serial_no IS NOT NULL AND trim(serial_no) <> '' AND serial_no = $1
         AND ($2::int IS NULL OR id <> $2)
       LIMIT 1`,
      [serialNo, excludeId]
    );
    if (result.rows[0]) {
      conflicts.push({
        field: "serialNo",
        value: serialNo,
        existingId: result.rows[0].id,
      });
    }
  }

  return conflicts;
}

/**
 * After a unique violation, resolve which identity fields collided and
 * return a structured 409 response body.
 */
async function resolveUniqueConflict(error, payload, options = {}) {
  if (!isUniqueViolation(error)) {
    return null;
  }

  const assetNo = normalizeIdentityValue(payload?.assetNo);
  const serialNo = normalizeIdentityValue(payload?.serialNo);
  const excludeId = options.excludeId != null ? Number(options.excludeId) : null;

  let conflicts = await lookupIdentityConflicts({
    assetNo,
    serialNo,
    excludeId: Number.isFinite(excludeId) ? excludeId : null,
  });

  // If probe found nothing (race / constraint name only), still return a clear body.
  if (conflicts.length === 0) {
    const constraint = String(error.constraint || "");
    const detail = String(error.detail || "");
    if (assetNo && (constraint.includes("asset_no") || detail.includes("asset_no"))) {
      conflicts.push({ field: "assetNo", value: assetNo, existingId: null });
    }
    if (serialNo && (constraint.includes("serial_no") || detail.includes("serial_no"))) {
      conflicts.push({ field: "serialNo", value: serialNo, existingId: null });
    }
  }

  return buildDuplicateConflictBody(conflicts);
}

function duplicateFieldsFromConflictBody(body) {
  return (body?.conflicts || []).map((entry) =>
    entry.field === "assetNo" ? "Asset No" : "Serial No"
  );
}

module.exports = {
  normalizeIdentityValue,
  buildDuplicateConflictBody,
  lookupIdentityConflicts,
  resolveUniqueConflict,
  duplicateFieldsFromConflictBody,
};
