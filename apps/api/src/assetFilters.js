const { getCachedCategoryConfigs } = require("./categoryConfig");

const SHARED_COLUMNS = new Set(["location", "office", "model", "assetNo", "serialNo", "status", "category"]);

const COLUMN_MAP = {
  location: "location",
  office: "office",
  model: "model",
  assetNo: "asset_no",
  serialNo: "serial_no",
  status: "status",
  category: "category",
};

const SHARED_IDENTITY_FIELDS = [
  { name: "location", label: "Location", type: "text" },
  { name: "office", label: "Office", type: "text" },
  { name: "model", label: "Model", type: "text" },
  { name: "assetNo", label: "Asset No", type: "text" },
  { name: "serialNo", label: "Serial No", type: "text" },
  { name: "status", label: "Status", type: "text" },
  { name: "category", label: "Category", type: "text" },
  { name: "department", label: "Department", type: "text" },
];

function normalizeFilterValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim().toLowerCase();
}

function getAssetFieldValue(asset, fieldName) {
  if (SHARED_COLUMNS.has(fieldName) && fieldName !== "category") {
    return asset[fieldName];
  }
  if (fieldName === "category") return asset.category;
  if (fieldName === "department") {
    return asset.details?.department || asset.office;
  }
  return asset.details?.[fieldName];
}

function matchCondition(asset, condition) {
  if (!condition?.field) return true;

  const scope = condition.categoryScope;
  if (scope && scope !== "all" && asset.category !== scope) {
    return false;
  }

  const field = condition.field;
  const operator = condition.operator || "equals";
  const expected = condition.value;
  const actual = getAssetFieldValue(asset, field);

  const actualNorm = normalizeFilterValue(actual);
  const expectedNorm = normalizeFilterValue(expected);

  // Empty value with equals/contains: treat as no restriction on value (field still category-scoped).
  if (
    expectedNorm === "" &&
    !["isEmpty", "isNotEmpty"].includes(operator)
  ) {
    return true;
  }

  switch (operator) {
    case "equals":
      return actualNorm === expectedNorm;
    case "contains":
      return actualNorm.includes(expectedNorm);
    case "startsWith":
      return actualNorm.startsWith(expectedNorm);
    case "notEquals":
      return actualNorm !== expectedNorm;
    case "isEmpty":
      return actual === null || actual === undefined || String(actual).trim() === "";
    case "isNotEmpty":
      return !(actual === null || actual === undefined || String(actual).trim() === "");
    default:
      return actualNorm === expectedNorm;
  }
}

function applyAdvancedFilters(assets, conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return assets;
  }
  const active = conditions.filter((entry) => entry && entry.field);
  if (active.length === 0) return assets;
  return assets.filter((asset) => active.every((condition) => matchCondition(asset, condition)));
}

function fieldOptionsForFilter(field) {
  if (field.type === "boolean") {
    return ["true", "false"];
  }
  if (Array.isArray(field.options) && field.options.length > 0) {
    return field.options;
  }
  if (field.name === "status") {
    return ["Functional", "Non-funct", "Under Repair", "Active", "Deprecated", "Inactive"];
  }
  return [];
}

/**
 * Union of all shared + detail fields across categories (global filtering).
 * When a specific category is requested, return that category's fields plus
 * shared identity fields so every common column remains filterable.
 */
function listFilterableFields(categoryFilter = null) {
  const configs = getCachedCategoryConfigs();
  const byKey = new Map();
  const allCodes = Object.keys(configs);
  const scoped =
    categoryFilter && categoryFilter !== "all" && configs[categoryFilter]
      ? [categoryFilter]
      : allCodes;

  // Always seed with shared identity fields so Office/Location/etc. exist globally.
  for (const field of SHARED_IDENTITY_FIELDS) {
    byKey.set(field.name, {
      name: field.name,
      label: field.label,
      type: field.type,
      options: fieldOptionsForFilter(field),
      categories: allCodes,
    });
  }

  const codesToScan =
    categoryFilter && categoryFilter !== "all" && configs[categoryFilter]
      ? // Include all configs so union of names is complete when browsing one category,
        // then annotate categories; still return fields present on scoped category OR shared.
        allCodes
      : allCodes;

  for (const code of codesToScan) {
    const config = configs[code];
    if (!config) continue;
    for (const field of [...(config.sharedFields || []), ...(config.detailFields || [])]) {
      const key = field.name;
      const options = fieldOptionsForFilter(field);
      if (!byKey.has(key)) {
        byKey.set(key, {
          name: field.name,
          label: field.label,
          type: field.type,
          options,
          categories: [code],
        });
      } else {
        const existing = byKey.get(key);
        if (!existing.categories.includes(code)) existing.categories.push(code);
        if ((!existing.options || existing.options.length === 0) && options.length) {
          existing.options = options;
        }
        if (field.label && existing.label !== field.label && !existing.label) {
          existing.label = field.label;
        }
      }
    }
  }

  let fields = Array.from(byKey.values());

  // When scoped to one category, keep fields that appear on that category OR are shared identity.
  if (categoryFilter && categoryFilter !== "all" && configs[categoryFilter]) {
    const sharedNames = new Set(SHARED_IDENTITY_FIELDS.map((field) => field.name));
    fields = fields.filter(
      (field) => sharedNames.has(field.name) || field.categories.includes(categoryFilter)
    );
  }

  return fields.sort((a, b) => a.label.localeCompare(b.label));
}

function parseAdvancedFiltersParam(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.field === "string")
      .map((entry) => ({
        field: entry.field,
        operator: entry.operator || "equals",
        value: entry.value ?? "",
        categoryScope: entry.categoryScope || "all",
      }));
  } catch {
    return [];
  }
}

module.exports = {
  SHARED_COLUMNS,
  COLUMN_MAP,
  applyAdvancedFilters,
  listFilterableFields,
  parseAdvancedFiltersParam,
  getAssetFieldValue,
  matchCondition,
};
