const UNIQUE_IDENTITY_FIELDS = new Set(["assetNo", "serialNo"]);

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function normalizeComparable(value) {
  if (isEmptyValue(value)) return "";
  return String(value).trim();
}

function getDepartment(asset) {
  if (!isEmptyValue(asset.office)) return String(asset.office).trim();
  const fromDetails = asset.details?.department;
  if (!isEmptyValue(fromDetails)) return String(fromDetails).trim();
  return "";
}

/**
 * When location or office changes, cascade assignment rules:
 * - office is the active department-like source
 * - assigned room / assignee cannot remain across two offices; clear unless a new value is provided
 * - legacy details.department is read for backward compatibility only
 */
function applyAssignmentCascade(existing, incoming) {
  const warnings = [];
  const nextDetails = {
    ...(existing.details || {}),
    ...(incoming.details || {}),
  };

  const prevOffice = getDepartment(existing);
  let nextOffice = incoming.office !== undefined ? incoming.office : existing.office;
  if (isEmptyValue(nextOffice) && !isEmptyValue(nextDetails.department)) {
    nextOffice = nextDetails.department;
  }
  delete nextDetails.department;

  const locationChanged =
    incoming.location !== undefined &&
    String(incoming.location || "") !== String(existing.location || "");
  const officeChanged = String(nextOffice || "").trim().toLowerCase() !== prevOffice.toLowerCase();

  if (officeChanged || locationChanged) {
    const incomingAssignee =
      incoming.details && Object.prototype.hasOwnProperty.call(incoming.details, "assignedRoom")
        ? incoming.details.assignedRoom
        : undefined;
    const existingAssignee = existing.details?.assignedRoom;
    const assigneeChanged =
      incomingAssignee !== undefined &&
      normalizeComparable(incomingAssignee) !== normalizeComparable(existingAssignee);

    if (assigneeChanged && !isEmptyValue(incomingAssignee)) {
      nextDetails.assignedRoom = incomingAssignee;
    } else {
      nextDetails.assignedRoom = "";
      warnings.push(
        "Location or office changed. Assigned room was cleared so the asset can be reassigned correctly."
      );
    }

  }

  return {
    details: nextDetails,
    office: nextOffice,
    warnings,
    departmentChanged: officeChanged || locationChanged,
  };
}

function findCommonFieldValues(assets) {
  if (!assets.length) return { common: {}, mixed: [] };

  const sharedKeys = ["location", "office", "model", "status"];
  const detailKeys = new Set();
  for (const asset of assets) {
    for (const key of Object.keys(asset.details || {})) {
      detailKeys.add(key);
    }
  }

  const common = {};
  const mixed = [];

  function valuesEqual(a, b) {
    if (isEmptyValue(a) && isEmptyValue(b)) return true;
    return String(a ?? "") === String(b ?? "");
  }

  for (const key of sharedKeys) {
    if (UNIQUE_IDENTITY_FIELDS.has(key)) continue;
    const first = assets[0][key];
    const allSame = assets.every((asset) => valuesEqual(asset[key], first));
    if (allSame) {
      common[key] = first ?? "";
    } else {
      mixed.push(key);
    }
  }

  for (const key of detailKeys) {
    if (UNIQUE_IDENTITY_FIELDS.has(key)) continue;
    const first = assets[0].details?.[key];
    const allSame = assets.every((asset) => valuesEqual(asset.details?.[key], first));
    if (allSame) {
      if (!common.details) common.details = {};
      common.details[key] = first ?? "";
    } else {
      mixed.push(key);
    }
  }

  return { common, mixed, uniqueFields: ["assetNo", "serialNo"] };
}

module.exports = {
  UNIQUE_IDENTITY_FIELDS,
  applyAssignmentCascade,
  findCommonFieldValues,
  getDepartment,
  isEmptyValue,
};
