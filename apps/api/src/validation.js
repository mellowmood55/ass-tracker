const { z } = require("zod");
const { CATEGORY_CONFIG } = require("./catalog");
const {
  getCachedCategoryConfig,
  buildFieldLists,
  fieldIsVisible,
  fieldIsRequired,
} = require("./categoryConfig");

const assetPayloadSchema = z.object({
  category: z.string().min(1),
  location: z.string().optional().nullable(),
  office: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  assetNo: z.string().optional().nullable(),
  serialNo: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  details: z.record(z.unknown()).default({}),
});

function isMissing(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return false;
}

function normalizeIdentityValue(value) {
  if (isMissing(value)) {
    return null;
  }
  return String(value).trim();
}

function getConfig(categoryCode) {
  return getCachedCategoryConfig(categoryCode);
}

function fieldLabel(config, fieldName) {
  const field = buildFieldLists(config).find((entry) => entry.name === fieldName);
  return field?.label || fieldName;
}

function categoryUsesLocationOptions(categoryCode) {
  const config = getConfig(categoryCode);
  if (!config) return false;
  return (config.sharedFields || []).some(
    (field) => field.name === "location" && field.type === "select"
  );
}

function collectBlankRequiredFields(payload) {
  const config = getConfig(payload.category);
  if (!config) return [];

  const blanks = [];
  const details = payload.details || {};

  for (const field of config.sharedFields || []) {
    if (!fieldIsRequired(field, config)) continue;
    if (isMissing(payload[field.name])) {
      blanks.push(field.label || field.name);
    }
  }

  for (const field of config.detailFields || []) {
    if (!fieldIsRequired(field, config)) continue;
    if (!fieldIsVisible(field, details, payload)) continue;
    if (isMissing(details[field.name])) {
      blanks.push(field.label || field.name);
    }
  }

  for (const field of config.detailFields || []) {
    if (!field.showWhen) continue;
    if (!fieldIsVisible(field, details, payload)) continue;
    if (field.required && isMissing(details[field.name])) {
      blanks.push(field.label || field.name);
    }
  }

  return [...new Set(blanks)];
}

function validateSelectValue(field, value, errors, isImport) {
  if (isMissing(value)) return true;
  if (field.type !== "select" || !field.options?.length) return true;
  if (field.options.includes(value)) return true;
  // Import: never reject mismatched fixed lists — caller soft-clears the value.
  if (isImport) return false;
  errors.push(`Invalid value '${value}' for '${field.label}'.`);
  return false;
}

function softClearSelect(value, field, isImport) {
  if (!isImport) return value;
  if (isMissing(value)) return value;
  if (field.type !== "select" || !field.options?.length) return value;
  if (field.options.includes(value)) return value;
  return field.type === "select" ? "" : value;
}

function validateAssetPayload(payload, options = {}) {
  const { allowMissingLocation = false, mode = "strict" } = options;
  const isImport = mode === "import" || allowMissingLocation === true;
  const parsed = assetPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const data = {
    ...parsed.data,
    location: isMissing(parsed.data.location) ? null : String(parsed.data.location).trim(),
    office: isMissing(parsed.data.office) ? null : String(parsed.data.office).trim(),
    model: isMissing(parsed.data.model) ? null : String(parsed.data.model).trim(),
    assetNo: normalizeIdentityValue(parsed.data.assetNo),
    serialNo: normalizeIdentityValue(parsed.data.serialNo),
    status: isMissing(parsed.data.status) ? null : String(parsed.data.status).trim(),
    details: parsed.data.details || {},
  };

  const config = getConfig(data.category);
  if (!config) {
    return { valid: false, errors: ["Invalid category selected."] };
  }
  const meta = CATEGORY_CONFIG[data.category] || { label: data.category };

  const errors = [];

  if (isImport) {
    // assets.status is NOT NULL in Postgres — never send SQL null on import.
    // Empty string still counts as blank for collectBlankRequiredFields / needsAttention.
    if (isMissing(data.status)) {
      data.status = "";
    }

    for (const field of config.detailFields || []) {
      if (!field.showWhen || !field.required) continue;
      if (!fieldIsVisible(field, data.details, data)) continue;
      if (isMissing(data.details[field.name])) {
        errors.push(`Detail field '${field.label}' is required when ${field.showWhen.field} is enabled.`);
      }
    }
  } else {
    if (isMissing(data.status)) {
      errors.push(`Field 'status' is required for ${meta.label}.`);
    }

    for (const field of config.sharedFields || []) {
      if (!fieldIsRequired(field, config)) continue;
      if (field.name === "status") continue; // already checked above without fixed list
      if (isMissing(data[field.name])) {
        errors.push(`Field '${field.label}' is required for ${meta.label}.`);
      }
    }

    for (const field of config.detailFields || []) {
      if (!fieldIsRequired(field, config)) continue;
      if (!fieldIsVisible(field, data.details, data)) continue;
      if (isMissing(data.details[field.name])) {
        errors.push(`Detail field '${field.label}' is required for ${meta.label}.`);
      }
    }

    for (const field of config.detailFields || []) {
      if (!field.showWhen || !field.required) continue;
      if (!fieldIsVisible(field, data.details, data)) continue;
      if (isMissing(data.details[field.name])) {
        errors.push(`Detail field '${field.label}' is required for ${meta.label}.`);
      }
    }
  }

  if (categoryUsesLocationOptions(data.category) && !isMissing(data.location)) {
    const locationField = (config.sharedFields || []).find((field) => field.name === "location");
    const options = locationField?.options || [];
    if (options.length && !options.includes(data.location)) {
      if (isImport) {
        data.location = null;
      } else {
        errors.push(`Location must be one of: ${options.join(", ")}.`);
      }
    }
  }

  for (const field of config.sharedFields || []) {
    if (field.name === "status") continue; // free-text / alias-normalized; never reject on import
    const current = data[field.name];
    const ok = validateSelectValue(field, current, errors, isImport);
    if (!ok && isImport) {
      data[field.name] = softClearSelect(current, field, true);
    }
  }

  for (const field of config.detailFields || []) {
    if (!fieldIsVisible(field, data.details, data)) continue;
    const current = data.details[field.name];
    const ok = validateSelectValue(field, current, errors, isImport);
    if (!ok && isImport) {
      data.details[field.name] = softClearSelect(current, field, true);
    }

    if (field.type === "number" && !isMissing(data.details[field.name])) {
      const numeric = Number(data.details[field.name]);
      if (Number.isNaN(numeric) || numeric < 0) {
        if (isImport) {
          data.details[field.name] = "";
        } else {
          errors.push(`Detail field '${field.label}' must be a non-negative number.`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data };
}

module.exports = {
  validateAssetPayload,
  collectBlankRequiredFields,
  isMissing,
  fieldLabel,
  normalizeIdentityValue,
};
