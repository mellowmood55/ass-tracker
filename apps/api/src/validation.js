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

const FIXED_SHARED_FIELD_NAMES = new Set([
  "location",
  "office",
  "model",
  "assetNo",
  "serialNo",
  "status",
]);

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

function sharedFieldValue(payload, field) {
  if (FIXED_SHARED_FIELD_NAMES.has(field.name)) {
    return payload[field.name];
  }
  return (payload.details || {})[field.name];
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
    if (isMissing(sharedFieldValue(payload, field))) {
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
  if (isMissing(value)) return;
  if (field.type !== "select" || !field.options?.length) return;
  if (!field.options.includes(value)) {
    errors.push(`Invalid value '${value}' for '${field.label}'.`);
  }
}

function validateNumberValue(field, value, errors) {
  if (field.type !== "number" || isMissing(value)) return;
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0) {
    errors.push(`Field '${field.label}' must be a non-negative number.`);
  }
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
  const meta = CATEGORY_CONFIG[data.category];
  if (!config || !meta) {
    return { valid: false, errors: ["Invalid category selected."] };
  }

  const errors = [];

  if (isImport) {
    if (isMissing(data.status)) {
      data.status = null;
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
      if (isMissing(sharedFieldValue(data, field))) {
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
      errors.push(`Location must be one of: ${options.join(", ")}.`);
    }
  }

  for (const field of config.sharedFields || []) {
    const value = sharedFieldValue(data, field);
    validateSelectValue(field, value, errors, isImport);
    validateNumberValue(field, value, errors);
  }

  for (const field of config.detailFields || []) {
    if (!fieldIsVisible(field, data.details, data)) continue;
    validateSelectValue(field, data.details[field.name], errors, isImport);
    validateNumberValue(field, data.details[field.name], errors);
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
