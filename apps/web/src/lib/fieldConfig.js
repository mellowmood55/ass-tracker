export function labelToFieldName(label, existingNames = []) {
  const base = String(label || "field")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .map((part, index) =>
      index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("")
    .replace(/^[^a-z]/, "field");

  let candidate = base || "field";
  let suffix = 2;
  while (existingNames.includes(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

const FIXED_SHARED_FIELD_NAMES = new Set([
  "location",
  "office",
  "model",
  "assetNo",
  "serialNo",
  "status",
]);

function readAssetField(asset, column) {
  if (column.scope === "shared" && FIXED_SHARED_FIELD_NAMES.has(column.key)) {
    return asset[column.key];
  }
  return asset.details?.[column.key];
}

export function getAllFieldNames(config) {
  return [
    ...(config.sharedFields || []).map((field) => field.name),
    ...(config.detailFields || []).map((field) => field.name),
  ];
}

export function groupFieldsBySection(fields = [], groups = [], scope) {
  const scopedGroups = (groups || []).filter((group) => group.scope === scope);
  const grouped = scopedGroups.map((group) => ({
    group,
    fields: fields.filter((field) => field.groupId === group.id),
  }));
  const ungrouped = fields.filter(
    (field) => !field.groupId || !scopedGroups.some((group) => group.id === field.groupId)
  );
  return { grouped, ungrouped };
}

function sampleValueForField(field) {
  if (field.type === "boolean") return "Yes";
  if (field.type === "number") return "0";
  if (field.type === "select") return field.options?.[0] || "-";
  return "-";
}

function getGroupLabel(groups, field) {
  if (!field.groupId) return "";
  return groups.find((group) => group.id === field.groupId)?.label || "";
}

export function buildPreviewColumns(config) {
  if (!config) return [];

  const groups = config.groups || [];
  const columns = [];

  for (const field of config.sharedFields || []) {
    columns.push({
      key: field.name,
      label: field.label,
      groupLabel: getGroupLabel(groups, field),
      scope: "shared",
      storage: FIXED_SHARED_FIELD_NAMES.has(field.name) ? "assets column" : "details_json",
      sampleValue: sampleValueForField(field),
    });
  }

  for (const field of config.detailFields || []) {
    columns.push({
      key: field.name,
      label: field.label,
      groupLabel: getGroupLabel(groups, field),
      scope: "detail",
      storage: "details_json",
      sampleValue: sampleValueForField(field),
    });
  }

  return columns;
}

export function buildAssetColumnsFromCategory(category) {
  if (!category) return [];

  return buildPreviewColumns({
    groups: category.groups || [],
    sharedFields: category.sharedFields || [],
    detailFields: category.detailFields || [],
  }).map((column) => ({
    label: column.label,
    value: (asset) => {
      const raw = readAssetField(asset, column);
      if (raw === null || raw === undefined || raw === "") return "-";
      if (typeof raw === "boolean") return raw ? "Yes" : "No";
      return raw;
    },
  }));
}

export function buildReportHeaderRows(config) {
  const columns = buildPreviewColumns(config);
  if (!columns.some((column) => column.groupLabel)) {
    return { topRow: null, bottomRow: columns.map((column) => column.label) };
  }

  return {
    topRow: columns.map((column) => column.groupLabel || ""),
    bottomRow: columns.map((column) => column.label),
  };
}
