const { z } = require("zod");
const { query } = require("./db");
const { applyAntivirusCompositeToDetails } = require("./antivirusParser");
const {
  CATEGORY_CODES,
  CATEGORY_CONFIG,
  COMPUTER_TYPES,
  STATUS_BY_CATEGORY,
  DEVICE_TYPE_ALIASES,
  normalizeKey,
  matchCanonicalOption,
  normalizeBooleanValue,
  normalizeFromAliasMap,
  normalizeLocationValue,
} = require("./catalog");

const FIELD_ALIASES = {
  location: ["location", "floor", "wing", "site", "building", "area", "loc", "9th floor", "10th floor"],
  office: ["office", "office name", "office no", "department", "dept", "unit", "section"],
  model: ["model", "model name", "model no", "model number", "make model", "device model"],
  assetNo: ["asset no", "asset number", "assetno", "asset id", "asset tag", "tag", "inventory no"],
  serialNo: ["serial no", "serial number", "serialno", "serial", "s/n", "sn"],
  status: ["status", "state", "condition", "asset status"],
  deviceType: ["device type", "computer type", "type", "pc type", "form factor"],
  osInstalled: ["os installed", "os", "operating system", "windows version", "os version"],
  officeInstalled: ["office installed", "ms office", "microsoft office", "office suite"],
  officeType: ["office type", "ms office type", "microsoft office type"],
  officeStatus: ["office status", "ms office status", "microsoft office status"],
  antivirusInstalled: ["antivirus installed", "av installed", "has antivirus", "antivirus"],
  wirelessCapability: [
    "wireless capability",
    "wireless",
    "wifi",
    "wi-fi",
    "wi fi drivers",
    "wifi drivers",
    "wi-fi drivers",
    "os wifi drivers",
    "os wi-fi drivers",
  ],
  antivirusType: ["antivirus type", "av type", "antivirus name"],
  remainingSubscriptionDays: ["remaining subscription days", "subscription days", "av days left"],
  description: ["description", "desc", "software description"],
  function: ["function", "purpose", "software function"],
  item: ["item", "item name", "asset item"],
};

const showWhenSchema = z
  .object({
    field: z.string().min(1),
    equals: z.union([z.boolean(), z.string(), z.number()]),
  })
  .optional();

const fieldDefSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "select", "boolean", "number"]),
  required: z.boolean().default(false),
  locked: z.boolean().default(false),
  groupId: z.string().optional(),
  options: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  showWhen: showWhenSchema,
});

const groupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  scope: z.enum(["shared", "detail"]),
});

const categoryConfigSchema = z.object({
  groups: z.array(groupSchema).default([]),
  sharedFields: z.array(fieldDefSchema).default([]),
  detailFields: z.array(fieldDefSchema).default([]),
});

function withAliases(field, extraAliases = []) {
  const base = FIELD_ALIASES[field.name] || [];
  return {
    ...field,
    aliases: [...new Set([...(field.aliases || []), ...base, ...extraAliases])],
  };
}

function markLocked(field, sharedRequired, detailRequired) {
  const locked =
    field.locked === true ||
    sharedRequired.includes(field.name) ||
    detailRequired.includes(field.name);
  return {
    ...field,
    locked,
    // Locked only prevents removal/rename/type change — required stays independent.
    required: field.required === true,
  };
}

function buildFieldLists(config) {
  return [...(config.sharedFields || []), ...(config.detailFields || [])];
}

function getDefaultCategoryConfig(code) {
  const staticConfig = CATEGORY_CONFIG[code];
  if (!staticConfig) return null;

  const sharedRequired = staticConfig.sharedRequired || [];
  const detailRequired = staticConfig.detailRequired || [];

  if (code === CATEGORY_CODES.COMPUTER) {
    return {
      groups: [
        { id: "operatingSystem", label: "Operating System", scope: "detail" },
        { id: "microsoftOffice", label: "Microsoft Office", scope: "detail" },
      ],
      sharedFields: staticConfig.sharedFields.map((field) =>
        withAliases(
          markLocked({ ...field, options: field.options || undefined }, sharedRequired, detailRequired)
        )
      ),
      detailFields: [
        withAliases(
          markLocked(
            {
              name: "deviceType",
              label: "Computer Type",
              type: "select",
              required: true,
              options: COMPUTER_TYPES,
            },
            sharedRequired,
            detailRequired
          )
        ),
        withAliases(
          markLocked(
            {
              name: "osInstalled",
              label: "Operating System Version",
              type: "text",
              required: true,
              groupId: "operatingSystem",
            },
            sharedRequired,
            detailRequired
          )
        ),
        withAliases(
          markLocked(
            {
              name: "wirelessCapability",
              label: "Wi-Fi Drivers",
              type: "boolean",
              required: true,
              groupId: "operatingSystem",
            },
            sharedRequired,
            detailRequired
          )
        ),
        withAliases(
          markLocked(
            {
              name: "officeInstalled",
              label: "Office Installed",
              type: "boolean",
              required: true,
              groupId: "microsoftOffice",
            },
            sharedRequired,
            detailRequired
          )
        ),
        withAliases({
          name: "officeType",
          label: "Office Type",
          type: "select",
          required: false,
          groupId: "microsoftOffice",
          options: OFFICE_TYPE_VERSIONS,
        }),
        withAliases({
          name: "officeStatus",
          label: "Status",
          type: "select",
          required: false,
          groupId: "microsoftOffice",
          options: ["Installed", "Not Installed", "Licensed"],
        }),
        withAliases({
          name: "antivirusInstalled",
          label: "Antivirus Installed",
          type: "boolean",
          required: false,
          locked: false,
        }),
        withAliases({
          name: "antivirusType",
          label: "Antivirus Type",
          type: "text",
          required: false,
          showWhen: { field: "antivirusInstalled", equals: true },
        }),
        withAliases({
          name: "remainingSubscriptionDays",
          label: "Remaining Subscription Days",
          type: "number",
          required: false,
          showWhen: { field: "antivirusInstalled", equals: true },
        }),
      ],
    };
  }

  return {
    groups: [],
    sharedFields: (staticConfig.sharedFields || []).map((field) =>
      withAliases(
        markLocked({ ...field, options: field.options || undefined }, sharedRequired, detailRequired)
      )
    ),
    detailFields: (staticConfig.detailFields || []).map((field) =>
      withAliases(
        markLocked({ ...field, options: field.options || undefined }, sharedRequired, detailRequired)
      )
    ),
  };
}

function getDefaultCategoryConfigs() {
  const configs = {};
  for (const code of Object.values(CATEGORY_CODES)) {
    configs[code] = getDefaultCategoryConfig(code);
  }
  return configs;
}

let configCache = null;

function getCachedCategoryConfig(code) {
  if (!configCache) {
    throw new Error("Category config cache is not initialized.");
  }
  return configCache[code] || getDefaultCategoryConfig(code);
}

function getCachedCategoryConfigs() {
  if (!configCache) {
    throw new Error("Category config cache is not initialized.");
  }
  return configCache;
}

function getCategoryMeta(code) {
  return CATEGORY_CONFIG[code] || null;
}

function normalizeFieldValue(field, rawValue, categoryCode) {
  if (field.name === "location") {
    return normalizeLocationValue(rawValue);
  }

  if (field.name === "status") {
    if (rawValue === null || rawValue === undefined) return rawValue;
    return String(rawValue).trim();
  }

  if (field.type === "boolean") {
    return normalizeBooleanValue(rawValue);
  }

  if (field.type === "select" && field.options?.length) {
    const aliasEntries = {};
    for (const alias of field.aliases || []) {
      const canonical = matchCanonicalOption(alias, field.options);
      if (canonical) {
        aliasEntries[normalizeKey(alias)] = canonical;
      }
    }

    if (field.name === "deviceType") {
      Object.assign(aliasEntries, DEVICE_TYPE_ALIASES);
    }

    return normalizeFromAliasMap(rawValue, field.options, aliasEntries);
  }

  return rawValue;
}

function normalizeImportRowWithConfig(row, categoryCode, config) {
  if (!config) return row;

  const details = { ...(row.details || {}) };
  const normalized = { ...row, details };

  for (const field of config.sharedFields || []) {
    if (Object.prototype.hasOwnProperty.call(row, field.name)) {
      normalized[field.name] = normalizeFieldValue(field, row[field.name], categoryCode);
    }
  }

  for (const field of config.detailFields || []) {
    if (!Object.prototype.hasOwnProperty.call(details, field.name)) continue;
    details[field.name] = normalizeFieldValue(field, details[field.name], categoryCode);
  }

  if (categoryCode === CATEGORY_CODES.COMPUTER) {
    normalized.details = applyAntivirusCompositeToDetails(details);
  }

  return normalized;
}

function fieldIsVisible(field, details, sharedPayload) {
  if (!field.showWhen) return true;
  const source = Object.prototype.hasOwnProperty.call(sharedPayload, field.showWhen.field)
    ? sharedPayload[field.showWhen.field]
    : details[field.showWhen.field];
  return source === field.showWhen.equals;
}

function fieldIsRequired(field, config) {
  return field.required === true;
}

function dedupeFieldsByName(fields) {
  const byName = new Map();
  for (const field of fields) {
    if (!byName.has(field.name)) {
      byName.set(field.name, field);
    }
  }
  return [...byName.values()];
}

function forceLockedFields(config, lockedNames) {
  return {
    ...config,
    sharedFields: (config.sharedFields || []).map((field) =>
      lockedNames.has(field.name) ? { ...field, locked: true } : field
    ),
    detailFields: (config.detailFields || []).map((field) =>
      lockedNames.has(field.name) ? { ...field, locked: true } : field
    ),
  };
}

function validateCategoryConfigPayload(code, incoming, existingConfig) {
  const parsed = categoryConfigSchema.safeParse(incoming);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const config = parsed.data;
  const defaultConfig = getDefaultCategoryConfig(code);
  const defaults = existingConfig || getDefaultCategoryConfig(code);
  const immutableLockedFields = buildFieldLists(defaultConfig).filter((field) => field.locked);
  const lockedFields = dedupeFieldsByName([
    ...immutableLockedFields,
    ...buildFieldLists(defaults).filter((field) => field.locked),
  ]);
  const immutableLockedNames = new Set(immutableLockedFields.map((field) => field.name));
  const incomingFields = buildFieldLists(config);
  const incomingByName = new Map(incomingFields.map((field) => [field.name, field]));

  const errors = [];

  for (const locked of lockedFields) {
    const current = incomingByName.get(locked.name);
    if (!current) {
      errors.push(`Locked field '${locked.label}' (${locked.name}) cannot be removed.`);
      continue;
    }
    if (current.name !== locked.name) {
      errors.push(`Locked field '${locked.name}' cannot be renamed.`);
    }
    if (current.type !== locked.type) {
      errors.push(`Locked field '${locked.name}' type cannot be changed.`);
    }
  }

  const names = new Set();
  for (const field of incomingFields) {
    if (names.has(field.name)) {
      errors.push(`Duplicate field name '${field.name}'.`);
    }
    names.add(field.name);

    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      errors.push(`Select field '${field.label}' must have at least one option.`);
    }

    if (field.groupId) {
      const group = config.groups.find((entry) => entry.id === field.groupId);
      if (!group) {
        errors.push(`Field '${field.name}' references unknown group '${field.groupId}'.`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: forceLockedFields(config, immutableLockedNames) };
}

async function refreshConfigCache() {
  const defaults = getDefaultCategoryConfigs();
  const result = await query("SELECT category_code, config_json FROM category_field_configs");
  const cache = { ...defaults };

  for (const row of result.rows) {
    cache[row.category_code] = row.config_json;
  }

  configCache = cache;
  return configCache;
}

const OFFICE_TYPE_VERSIONS = [
  "Office 2010",
  "Office 2013",
  "Office 2016",
  "Office 2019",
  "Office 2021",
  "Microsoft 365",
];

function patchCategoryConfig(code, config) {
  if (!config) return config;
  const next = JSON.parse(JSON.stringify(config));

  next.sharedFields = (next.sharedFields || []).map((field) => {
    if (field.name === "status") {
      const { options: _removedOptions, ...rest } = field;
      return { ...rest, type: "text" };
    }
    return field;
  });

  if (code !== CATEGORY_CODES.COMPUTER) {
    return next;
  }

  next.detailFields = (next.detailFields || []).map((field) => {
    if (field.name === "officeType") {
      const legacyOptions = ["Word", "Excel", "Full Suite", "Outlook Only"];
      const hasLegacy = (field.options || []).some((option) => legacyOptions.includes(option));
      if (hasLegacy || !field.options?.length) {
        return { ...field, options: OFFICE_TYPE_VERSIONS };
      }
    }

    if (field.name === "osInstalled") {
      const { options: _removedOptions, ...rest } = field;
      return {
        ...rest,
        type: "text",
      };
    }

    if (field.name === "antivirusInstalled") {
      return {
        ...field,
        required: false,
        locked: false,
      };
    }

    if (field.name === "antivirusType" || field.name === "remainingSubscriptionDays") {
      return {
        ...field,
        required: false,
        locked: false,
        showWhen: { field: "antivirusInstalled", equals: true },
      };
    }

    return field;
  });

  return next;
}

async function patchStoredCategoryDefaults() {
  const result = await query("SELECT category_code, config_json FROM category_field_configs");

  for (const row of result.rows) {
    const patched = patchCategoryConfig(row.category_code, row.config_json);
    if (JSON.stringify(patched) === JSON.stringify(row.config_json)) continue;

    await query(
      `UPDATE category_field_configs
       SET config_json = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE category_code = $2`,
      [JSON.stringify(patched), row.category_code]
    );
  }
}

async function seedCategoryFieldConfigs() {
  const defaults = getDefaultCategoryConfigs();
  for (const [code, config] of Object.entries(defaults)) {
    await query(
      `INSERT INTO category_field_configs (category_code, config_json)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (category_code) DO NOTHING`,
      [code, JSON.stringify(config)]
    );
  }
}

async function loadAllCategoryConfigsForApi() {
  const cache = getCachedCategoryConfigs();
  return Object.entries(CATEGORY_CONFIG).map(([code, meta]) => ({
    code,
    label: meta.label,
    statuses: STATUS_BY_CATEGORY[code],
    groups: cache[code]?.groups || [],
    sharedFields: cache[code]?.sharedFields || [],
    detailFields: cache[code]?.detailFields || [],
  }));
}

async function saveCategoryConfig(code, incomingConfig, actorId) {
  if (!CATEGORY_CONFIG[code]) {
    return { ok: false, status: 404, message: "Unknown category." };
  }

  const existing = getCachedCategoryConfig(code);
  const validation = validateCategoryConfigPayload(code, incomingConfig, existing);
  if (!validation.valid) {
    return { ok: false, status: 400, message: validation.errors.join(" ") };
  }

  await query(
    `INSERT INTO category_field_configs (category_code, config_json, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (category_code)
     DO UPDATE SET config_json = EXCLUDED.config_json,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = CURRENT_TIMESTAMP`,
    [code, JSON.stringify(validation.data), actorId]
  );

  await refreshConfigCache();
  return { ok: true, config: validation.data };
}

function formatFieldValueForExport(field, value) {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function buildReportRowFromConfig(asset, config) {
  if (!config) return {};
  const details = asset.details || {};
  const row = {};

  for (const field of config.sharedFields || []) {
    row[field.label] = formatFieldValueForExport(field, asset[field.name]);
  }

  for (const field of config.detailFields || []) {
    row[field.label] = formatFieldValueForExport(field, details[field.name]);
  }

  return row;
}

async function loadSettingsPayload() {
  const cache = getCachedCategoryConfigs();
  return Object.entries(CATEGORY_CONFIG).map(([code, meta]) => ({
    code,
    label: meta.label,
    config: cache[code],
  }));
}

module.exports = {
  categoryConfigSchema,
  getDefaultCategoryConfig,
  getDefaultCategoryConfigs,
  getCachedCategoryConfig,
  getCachedCategoryConfigs,
  getCategoryMeta,
  refreshConfigCache,
  seedCategoryFieldConfigs,
  patchStoredCategoryDefaults,
  loadAllCategoryConfigsForApi,
  loadSettingsPayload,
  saveCategoryConfig,
  validateCategoryConfigPayload,
  normalizeImportRowWithConfig,
  normalizeFieldValue,
  fieldIsVisible,
  fieldIsRequired,
  buildReportRowFromConfig,
};
