import * as XLSX from "xlsx";
import { applyAntivirusCompositeToDetails } from "@/lib/antivirusParser";

const FIELD_ALIASES = {
  location: [
    "location",
    "floor",
    "wing",
    "site",
    "building",
    "area",
    "loc",
    "9th floor",
    "10th floor",
  ],
  office: [
    "office",
    "office name",
    "office no",
    "officeno",
    "department",
    "dept",
    "unit",
    "section",
  ],
  model: [
    "model",
    "model name",
    "model no",
    "modelno",
    "model number",
    "modelnumber",
    "make model",
    "device model",
  ],
  assetNo: [
    "asset no",
    "asset no.",
    "asset number",
    "assetno",
    "asset_no",
    "asset #",
    "asset id",
    "assetid",
    "asset tag",
    "assettag",
    "tag",
    "tag no",
    "tag number",
    "inventory no",
    "inventory number",
    "inventoryno",
  ],
  serialNo: [
    "serial no",
    "serial no.",
    "serial number",
    "serialno",
    "serial_no",
    "serial",
    "s/n",
    "sn",
    "ser no",
    "ser number",
    "serno",
  ],
  status: ["status", "state", "condition", "asset status", "assetstatus"],
  deviceType: [
    "device type",
    "devicetype",
    "device_type",
    "computer type",
    "computertype",
    "type",
    "pc type",
    "form factor",
  ],
  osInstalled: [
    "os installed",
    "osinstalled",
    "os_installed",
    "os",
    "operating system",
    "operatingsystem",
    "windows version",
    "os version",
  ],
  officeInstalled: [
    "office installed",
    "officeinstalled",
    "office_installed",
    "ms office",
    "microsoft office",
    "office suite",
  ],
  antivirusInstalled: [
    "antivirus installed",
    "antivirusinstalled",
    "antivirus_installed",
    "av installed",
    "has antivirus",
    "antivirus",
  ],
  wirelessCapability: [
    "wireless connection capability",
    "wireless capability",
    "wirelesscapability",
    "wireless",
    "wifi",
    "wi-fi",
    "wifi drivers",
    "wi-fi drivers",
    "os wifi drivers",
    "os wi-fi drivers",
    "os wireless",
  ],
  antivirusType: [
    "antivirus type",
    "antivirustype",
    "antivirus_type",
    "av type",
    "antivirus name",
    "av product",
  ],
  remainingSubscriptionDays: [
    "remaining subscription days",
    "remainingsubscriptiondays",
    "remaining days",
    "subscription days",
    "av days left",
    "days remaining",
  ],
  description: ["description", "desc", "software name", "name", "title"],
  function: ["function", "purpose", "role", "usage"],
  item: ["item", "item name", "itemname", "item type", "itemtype", "equipment", "device"],
};

export const LOW_CONFIDENCE_THRESHOLD = 0.75;
const IGNORE_VALUE = "__ignore__";

export function normalizeKey(text) {
  return String(text || "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[#./\\_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactKey(text) {
  return normalizeKey(text).replace(/\s+/g, "");
}

function getCategoryFields(category) {
  if (!category) return [];
  return [...(category.sharedFields || []), ...(category.detailFields || [])];
}

function getFieldGroupLabel(category, field) {
  if (!field?.groupId || !category?.groups) return "";
  const group = category.groups.find((entry) => entry.id === field.groupId);
  return group?.label || "";
}

function getFieldAliases(field) {
  const fromConfig = field.aliases || [];
  const fallback = FIELD_ALIASES[field.name] || [];
  return [...new Set([...fromConfig, ...fallback])];
}

function buildAliasMapFromField(field) {
  const map = {};
  for (const alias of getFieldAliases(field)) {
    const key = normalizeKey(alias);
    if (field.options?.includes(alias)) {
      map[key] = alias;
    }
  }
  return map;
}

function isFieldRequired(field) {
  return field.required === true;
}

export function getRequiredFieldDefs(category) {
  return getCategoryFields(category).filter((field) => isFieldRequired(field));
}

export function getCategoryFieldOptions(category, options = {}) {
  const { importMode = false } = options;
  return getCategoryFields(category).map((field) => {
    const groupLabel = getFieldGroupLabel(category, field);
    return {
      name: field.name,
      label: groupLabel ? `${groupLabel} / ${field.label}` : field.label,
      groupLabel,
      required: importMode ? false : isFieldRequired(field),
    };
  });
}

export function scoreHeaderToField(header, field, category = null, meta = null) {
  const headerNorm = normalizeKey(header);
  const headerCompact = compactKey(header);
  if (!headerNorm) return 0;

  const labelNorm = normalizeKey(field.label);
  const labelCompact = compactKey(field.label);
  const nameNorm = normalizeKey(field.name);
  const nameCompact = compactKey(field.name);
  const groupLabel = category ? getFieldGroupLabel(category, field) : "";
  const compositeLabel = groupLabel ? `${groupLabel} / ${field.label}` : field.label;
  const compositeNorm = normalizeKey(compositeLabel);
  const compositeCompact = compactKey(compositeLabel);

  const metaGroup = meta?.groupLabel ? normalizeKey(meta.groupLabel) : "";
  const metaField = meta?.fieldLabel ? normalizeKey(meta.fieldLabel) : "";
  const metaFieldCompact = meta?.fieldLabel ? compactKey(meta.fieldLabel) : "";
  const fieldGroupNorm = groupLabel ? normalizeKey(groupLabel) : "";
  const hasMetaGroup = Boolean(metaGroup);
  const groupMatches = hasMetaGroup && fieldGroupNorm && metaGroup === fieldGroupNorm;
  const groupMismatch = hasMetaGroup && fieldGroupNorm && metaGroup !== fieldGroupNorm;
  const bareStatusAmbiguity =
    hasMetaGroup &&
    !field.groupId &&
    (metaField === labelNorm || metaFieldCompact === labelCompact || headerNorm === labelNorm);

  if (headerNorm === compositeNorm || headerCompact === compositeCompact) return 1;
  if (groupMatches && metaField && (metaField === labelNorm || metaFieldCompact === labelCompact)) {
    return 0.99;
  }
  if (groupMatches && (headerNorm === labelNorm || headerCompact === labelCompact)) return 0.98;
  if (!hasMetaGroup && (headerNorm === labelNorm || headerCompact === labelCompact)) return 0.99;
  if (headerNorm === nameNorm || headerCompact === nameCompact) return 0.98;

  if (groupMismatch) {
    // Subheader under a different group should not claim this field.
    if (metaField === labelNorm || metaFieldCompact === labelCompact) return 0.2;
    return 0;
  }

  if (bareStatusAmbiguity) {
    // e.g. "Status" under Microsoft Office should not map to shared asset status.
    return 0.25;
  }

  const aliases = getFieldAliases(field);
  for (const alias of aliases) {
    const aliasNorm = normalizeKey(alias);
    const aliasCompact = compactKey(alias);
    if (groupMatches && (metaField === aliasNorm || metaFieldCompact === aliasCompact)) {
      return 0.97;
    }
    if (headerNorm === aliasNorm || headerCompact === aliasCompact) {
      return groupMatches ? 0.96 : hasMetaGroup && field.groupId ? 0.7 : 0.95;
    }
    const groupedAlias = groupLabel ? `${groupLabel} / ${alias}` : alias;
    if (headerNorm === normalizeKey(groupedAlias) || headerCompact === compactKey(groupedAlias)) {
      return 0.94;
    }
  }

  const scoreTarget = metaField || headerNorm;
  const scoreTargetCompact = metaFieldCompact || headerCompact;
  const headerTokens = new Set(scoreTarget.split(" ").filter(Boolean));
  const fieldTokens = new Set(
    [
      ...compositeNorm.split(" "),
      ...labelNorm.split(" "),
      ...nameNorm.split(" "),
      ...aliases.flatMap((alias) => normalizeKey(alias).split(" ")),
    ].filter(Boolean)
  );

  if (headerNorm.includes(compositeNorm) || compositeNorm.includes(headerNorm)) {
    return groupMatches ? 0.9 : 0.85;
  }
  if (scoreTarget.includes(labelNorm) || labelNorm.includes(scoreTarget)) {
    return groupMatches ? 0.88 : 0.84;
  }
  if (scoreTargetCompact.includes(labelCompact) || labelCompact.includes(scoreTargetCompact)) {
    return groupMatches ? 0.85 : 0.8;
  }

  let overlap = 0;
  for (const token of headerTokens) {
    if (fieldTokens.has(token)) overlap += 1;
  }
  if (overlap === 0) return 0;

  const ratio = overlap / Math.max(headerTokens.size, 1);
  let score = 0.55;
  if (ratio >= 0.75) score = 0.75;
  else if (ratio >= 0.5) score = 0.65;

  if (groupMatches) score = Math.min(0.92, score + 0.12);
  return score;
}

/**
 * Greedy unique assignment of file headers → field names.
 * Returns { mapping: { [fileHeader]: fieldName|null }, confidence: { [fileHeader]: number } }
 */
export function autoMapColumns(fileHeaders, category, headerMeta = null) {
  const fields = getCategoryFields(category);
  const mapping = {};
  const confidence = {};
  const usedFields = new Set();
  const metaByKey = buildHeaderMetaLookup(fileHeaders, headerMeta);

  const candidates = [];
  for (const header of fileHeaders) {
    const meta = metaByKey.get(header) || null;
    for (const field of fields) {
      const score = scoreHeaderToField(header, field, category, meta);
      if (score >= 0.55) {
        candidates.push({ header, fieldName: field.name, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    if (mapping[candidate.header] !== undefined) continue;
    if (usedFields.has(candidate.fieldName)) continue;
    mapping[candidate.header] = candidate.fieldName;
    confidence[candidate.header] = candidate.score;
    usedFields.add(candidate.fieldName);
  }

  for (const header of fileHeaders) {
    if (mapping[header] === undefined) {
      mapping[header] = null;
      confidence[header] = 0;
    }
  }

  return { mapping, confidence };
}

function buildHeaderMetaLookup(fileHeaders, headerMeta) {
  const map = new Map();
  if (Array.isArray(headerMeta)) {
    for (const entry of headerMeta) {
      if (entry?.key) map.set(entry.key, entry);
    }
  }
  for (const header of fileHeaders) {
    if (!map.has(header)) {
      map.set(header, { key: header, groupLabel: "", fieldLabel: header, columnIndex: -1 });
    }
  }
  return map;
}

export const LOCATION_OPTIONS = ["9TH Floor (A)", "9th floor (B)", "10th floor"];

const LOCATION_VALUE_ALIASES = {
  "9th floor (a)": "9TH Floor (A)",
  "9th floor a": "9TH Floor (A)",
  "9th floor wing a": "9TH Floor (A)",
  "9th floor winga": "9TH Floor (A)",
  "wing a": "9TH Floor (A)",
  "floor a": "9TH Floor (A)",
  "9th floor (b)": "9th floor (B)",
  "9th floor b": "9th floor (B)",
  "9th floor wing b": "9th floor (B)",
  "9th floor wingb": "9th floor (B)",
  "wing b": "9th floor (B)",
  "floor b": "9th floor (B)",
  "10th floor": "10th floor",
  "10th": "10th floor",
  "floor 10": "10th floor",
};

const DEVICE_TYPE_OPTIONS = ["Desktop", "Laptop"];

const DEVICE_TYPE_ALIASES = {
  desktop: "Desktop",
  pc: "Desktop",
  tower: "Desktop",
  workstation: "Desktop",
  laptop: "Laptop",
  notebook: "Laptop",
  portable: "Laptop",
};

const HARDWARE_STATUS_OPTIONS = ["Functional", "Non-funct", "Under Repair"];
const SOFTWARE_STATUS_OPTIONS = ["Active", "Deprecated", "Inactive"];

const HARDWARE_STATUS_ALIASES = {
  working: "Functional",
  works: "Functional",
  functional: "Functional",
  ok: "Functional",
  good: "Functional",
  fine: "Functional",
  operational: "Functional",
  active: "Functional",
  "in use": "Functional",
  "non funct": "Non-funct",
  "non-funct": "Non-funct",
  nonfunct: "Non-funct",
  "non functional": "Non-funct",
  nonfunctional: "Non-funct",
  "non-functional": "Non-funct",
  "not functional": "Non-funct",
  broken: "Non-funct",
  faulty: "Non-funct",
  dead: "Non-funct",
  failed: "Non-funct",
  "not working": "Non-funct",
  "out of order": "Non-funct",
  "under repair": "Under Repair",
  underrepair: "Under Repair",
  repairing: "Under Repair",
  repair: "Under Repair",
  "in repair": "Under Repair",
  servicing: "Under Repair",
};

const SOFTWARE_STATUS_ALIASES = {
  active: "Active",
  enabled: "Active",
  "in use": "Active",
  running: "Active",
  live: "Active",
  deprecated: "Deprecated",
  obsolete: "Deprecated",
  legacy: "Deprecated",
  retired: "Deprecated",
  inactive: "Inactive",
  disabled: "Inactive",
  off: "Inactive",
  unused: "Inactive",
  stopped: "Inactive",
};

function matchCanonicalOption(raw, options) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (options.includes(trimmed)) return trimmed;
  const key = normalizeKey(trimmed);
  const compact = compactKey(trimmed);
  for (const option of options) {
    if (normalizeKey(option) === key || compactKey(option) === compact) return option;
  }
  return null;
}

function normalizeFromAliasMap(raw, options, aliases) {
  const exact = matchCanonicalOption(raw, options);
  if (exact) return exact;
  if (raw === null || raw === undefined) return raw;
  const trimmed = String(raw).trim();
  if (!trimmed) return trimmed;
  const key = normalizeKey(trimmed);
  if (aliases[key]) return aliases[key];
  const compact = compactKey(trimmed);
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (compactKey(alias) === compact) return canonical;
  }
  return trimmed;
}

export function normalizeLocationValue(value) {
  if (value === null || value === undefined) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const exact = matchCanonicalOption(trimmed, LOCATION_OPTIONS);
  if (exact) return exact;
  const key = normalizeKey(trimmed);
  if (LOCATION_VALUE_ALIASES[key]) return LOCATION_VALUE_ALIASES[key];
  const compact = compactKey(trimmed);
  for (const [alias, canonical] of Object.entries(LOCATION_VALUE_ALIASES)) {
    if (compactKey(alias) === compact) return canonical;
  }
  return "";
}

export function normalizeImportFieldValue(fieldName, rawValue, categoryOrCode) {
  const category =
    typeof categoryOrCode === "object" && categoryOrCode !== null
      ? categoryOrCode
      : { code: categoryOrCode, sharedFields: [], detailFields: [] };
  const categoryCode = category.code;
  const field = getCategoryFields(category).find((entry) => entry.name === fieldName);

  if (fieldName === "location") return normalizeLocationValue(rawValue);

  if (fieldName === "status") {
    if (rawValue === null || rawValue === undefined) return rawValue;
    const trimmed = String(rawValue).trim();
    if (!trimmed) return trimmed;
    const isSoftware = categoryCode === "software";
    const options = isSoftware ? SOFTWARE_STATUS_OPTIONS : HARDWARE_STATUS_OPTIONS;
    const aliases = isSoftware ? SOFTWARE_STATUS_ALIASES : HARDWARE_STATUS_ALIASES;
    return normalizeFromAliasMap(trimmed, options, aliases);
  }

  if (field?.type === "boolean") {
    return parseBoolean(rawValue);
  }

  if (field?.type === "select" && field.options?.length) {
    const aliasMap = buildAliasMapFromField(field);
    if (fieldName === "deviceType") Object.assign(aliasMap, DEVICE_TYPE_ALIASES);
    return normalizeFromAliasMap(rawValue, field.options, aliasMap);
  }

  if (fieldName === "deviceType") {
    return normalizeFromAliasMap(rawValue, DEVICE_TYPE_OPTIONS, DEVICE_TYPE_ALIASES);
  }

  if (["officeInstalled", "antivirusInstalled", "wirelessCapability"].includes(fieldName)) {
    return parseBoolean(rawValue);
  }

  return rawValue;
}

export function getUnmappedRequired(mapping, category, options = {}) {
  const { allowMissingLocation = false, importMode = false } = options;

  // Import: blank/unmapped columns are allowed; server flags incomplete fields after import.
  if (importMode) {
    return [];
  }

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  return getRequiredFieldDefs(category)
    .filter((field) => {
      if (allowMissingLocation && field.name === "location") return false;
      return !mappedFields.has(field.name);
    })
    .map((field) => field.label);
}

export function getLowConfidenceHeaders(confidence, threshold = LOW_CONFIDENCE_THRESHOLD) {
  return Object.entries(confidence)
    .filter(([, score]) => score > 0 && score < threshold)
    .map(([header]) => header);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const key = normalizeKey(value);
  if (["true", "yes", "y", "1", "installed", "available", "on"].includes(key)) return true;
  if (["false", "no", "n", "0", "missing", "none", "not installed", "off", ""].includes(key)) {
    return false;
  }
  return Boolean(value);
}

export function applyMapping(rows, mapping, category) {
  const sharedNames = new Set((category.sharedFields || []).map((field) => field.name));
  const detailNames = new Set((category.detailFields || []).map((field) => field.name));
  const fieldTypes = {};
  for (const field of getCategoryFields(category)) {
    fieldTypes[field.name] = field.type;
  }

  const fieldToHeader = {};
  for (const [header, fieldName] of Object.entries(mapping)) {
    if (fieldName) fieldToHeader[fieldName] = header;
  }

  return rows.map((row) => {
    const shared = {};
    const details = {};

    for (const [fieldName, header] of Object.entries(fieldToHeader)) {
      let value = row[header];
      if (value === undefined || value === null) value = "";

      if (fieldTypes[fieldName] === "number" && value !== "" && value != null) {
        value = Number(value);
      }

      value = normalizeImportFieldValue(fieldName, value, category);

      if (sharedNames.has(fieldName)) shared[fieldName] = value;
      else if (detailNames.has(fieldName)) details[fieldName] = value;
    }

    const normalizedDetails =
      category.code === "computer" ? applyAntivirusCompositeToDetails(details) : details;

    return {
      category: category.code,
      ...shared,
      details: normalizedDetails,
    };
  });
}

/**
 * Detect header row (skip title/subtitle rows) using category-aware scoring.
 */
function isEmptyRow(row) {
  return (row || []).every((cell) => String(cell ?? "").trim() === "");
}

function getNonEmptyCells(row) {
  return (row || [])
    .map((cell) => String(cell ?? "").trim())
    .filter((text) => text !== "");
}

function looksLikeDataValue(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (!Number.isNaN(Number(value)) && value.length <= 20) return true;
  if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(value)) return true;
  if (value.length > 60) return true;
  return false;
}

function looksLikeShortLabel(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (value.length > 50) return false;
  if (looksLikeDataValue(value)) return false;
  return Number.isNaN(Number(value));
}

export function isTitleOrSubtitleRow(row) {
  const nonEmpty = getNonEmptyCells(row);
  if (nonEmpty.length === 0) return true;
  if (nonEmpty.length === 1) return true;

  if (nonEmpty.length <= 2 && nonEmpty.some((cell) => cell.length > 50)) {
    return true;
  }

  // Banner-style: few filled cells across a wide row that do not look like field labels
  const totalCells = (row || []).length;
  if (totalCells >= 5 && nonEmpty.length <= 2) {
    const allLookLikeLabels = nonEmpty.every(looksLikeShortLabel);
    if (!allLookLikeLabels) return true;
  }

  // Two short cells that don't look like field labels (e.g. "Printers" / "Q1 2026")
  if (nonEmpty.length === 2 && nonEmpty.every((cell) => cell.length < 40)) {
    const bothLookLikeLabels = nonEmpty.every(looksLikeShortLabel);
    if (!bothLookLikeLabels) return true;
  }

  return false;
}

function rowLooksLikeFieldLabels(row, category) {
  const nonEmpty = getNonEmptyCells(row);
  if (nonEmpty.length < 2) return false;
  if (nonEmpty.some((cell) => looksLikeDataValue(cell))) return false;
  if (!nonEmpty.every((cell) => looksLikeShortLabel(cell))) return false;

  const score = scoreAsHeaderRow(row, category);
  const matchCount = nonEmpty.filter((cell) => {
    const fields = getCategoryFields(category);
    return fields.some((field) => scoreHeaderToField(cell, field, category) >= 0.55);
  }).length;

  return score >= 0.8 || matchCount >= 1 || nonEmpty.length >= 2;
}

function rowLooksLikeDataRow(row) {
  const nonEmpty = getNonEmptyCells(row);
  if (nonEmpty.length === 0) return false;
  const dataLike = nonEmpty.filter((cell) => looksLikeDataValue(cell)).length;
  if (dataLike > 0) return true;
  // Asset tags / serials / short codes often appear in early data rows
  const codeLike = nonEmpty.filter(
    (cell) => !looksLikeShortLabel(cell) && /^[A-Z0-9][A-Z0-9/_-]{2,}$/i.test(cell)
  ).length;
  return codeLike >= 1 && nonEmpty.length >= 3;
}

function collectKnownHeaderLabels(category) {
  const labels = new Set();
  for (const field of getCategoryFields(category)) {
    labels.add(normalizeKey(field.label));
    labels.add(normalizeKey(field.name));
    for (const alias of getFieldAliases(field)) {
      labels.add(normalizeKey(alias));
    }
    const groupLabel = getFieldGroupLabel(category, field);
    if (groupLabel) labels.add(normalizeKey(groupLabel));
  }
  for (const group of category?.groups || []) {
    if (group.label) labels.add(normalizeKey(group.label));
  }
  return labels;
}

function rowLooksLikeHeaderLabelsOnly(row, category) {
  const nonEmpty = getNonEmptyCells(row);
  if (nonEmpty.length === 0) return false;
  const known = collectKnownHeaderLabels(category);
  let hits = 0;
  for (const cell of nonEmpty) {
    if (looksLikeDataValue(cell)) return false;
    if (known.has(normalizeKey(cell)) || looksLikeShortLabel(cell)) hits += 1;
  }
  return hits >= Math.max(2, Math.ceil(nonEmpty.length * 0.6));
}

export function scoreAsHeaderRow(row, category) {
  const fields = getCategoryFields(category);
  const nonEmpty = getNonEmptyCells(row);
  if (nonEmpty.length < 2 || fields.length === 0) return 0;

  let score = 0;
  let matchedFields = 0;
  let shortLabelCount = 0;
  let dataLikeCount = 0;
  const usedFields = new Set();

  for (const cell of nonEmpty) {
    if (looksLikeDataValue(cell)) {
      dataLikeCount += 1;
      continue;
    }
    if (looksLikeShortLabel(cell)) shortLabelCount += 1;

    let best = 0;
    let bestField = null;
    for (const field of fields) {
      if (usedFields.has(field.name)) continue;
      const cellScore = scoreHeaderToField(cell, field, category);
      if (cellScore > best) {
        best = cellScore;
        bestField = field.name;
      }
    }

    if (best >= 0.55 && bestField) {
      score += best;
      matchedFields += 1;
      usedFields.add(bestField);
    }
  }

  if (shortLabelCount >= 3) score += 0.35;
  if (matchedFields >= 2) score += 0.25;
  score -= dataLikeCount * 0.4;

  return Math.max(0, score);
}

function findHeaderRowIndex(matrix, category) {
  const scanLimit = Math.min(matrix.length, 15);
  let bestIndex = -1;
  let bestScore = -1;
  let fallbackIndex = -1;

  for (let i = 0; i < scanLimit; i += 1) {
    const row = matrix[i] || [];
    if (isEmptyRow(row)) continue;
    if (isTitleOrSubtitleRow(row)) continue;

    const nonEmpty = getNonEmptyCells(row);
    const looksLikeBasicHeaders =
      nonEmpty.length >= 2 && nonEmpty.every((cell) => looksLikeShortLabel(cell));

    if (looksLikeBasicHeaders && fallbackIndex < 0) {
      fallbackIndex = i;
    }

    const score = scoreAsHeaderRow(row, category);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const HEADER_SCORE_THRESHOLD = 1.5;
  let headerRowIndex = 0;

  if (bestIndex >= 0 && bestScore >= HEADER_SCORE_THRESHOLD) {
    headerRowIndex = bestIndex;
  } else if (fallbackIndex >= 0) {
    headerRowIndex = fallbackIndex;
  } else {
    for (let i = 0; i < matrix.length; i += 1) {
      if (!isEmptyRow(matrix[i] || [])) {
        headerRowIndex = i;
        break;
      }
    }
  }

  let skippedTitleRows = 0;
  for (let i = 0; i < headerRowIndex; i += 1) {
    if (!isEmptyRow(matrix[i] || [])) skippedTitleRows += 1;
  }

  return { headerRowIndex, skippedTitleRows };
}

function forwardFillRow(row) {
  const filled = [...(row || [])];
  let last = "";
  for (let i = 0; i < filled.length; i += 1) {
    const text = String(filled[i] ?? "").trim();
    if (text) {
      last = text;
      filled[i] = text;
    } else if (last) {
      filled[i] = last;
    }
  }
  return filled;
}

function buildGroupedHeaders(groupRow, fieldRow, category) {
  const filledGroups = forwardFillRow(groupRow);
  const fields = getCategoryFields(category);
  const headers = [];
  const headerMeta = [];

  for (let index = 0; index < Math.max(fieldRow.length, filledGroups.length); index += 1) {
    const fieldLabel = String(fieldRow[index] ?? "").trim();
    const groupLabel = String(filledGroups[index] ?? "").trim();
    if (!fieldLabel && !groupLabel) continue;

    // Prefer subheader when present; otherwise use the group label alone.
    const matchedField =
      fields.find((field) => normalizeKey(field.label) === normalizeKey(fieldLabel || groupLabel)) ||
      fields.find((field) => normalizeKey(field.name) === normalizeKey(fieldLabel || groupLabel));

    const resolvedGroup =
      groupLabel ||
      (matchedField ? getFieldGroupLabel(category, matchedField) : "") ||
      fieldLabel;
    const resolvedField = fieldLabel || groupLabel;
    const composite =
      resolvedGroup && resolvedField && resolvedGroup !== resolvedField
        ? `${resolvedGroup} / ${resolvedField}`
        : resolvedField || resolvedGroup;

    headers.push(composite);
    headerMeta.push({
      key: composite,
      groupLabel: resolvedGroup !== resolvedField ? resolvedGroup : "",
      fieldLabel: resolvedField,
      columnIndex: index,
    });
  }

  return { headers, headerMeta };
}

function countRepeatedGroupSpans(groupRow) {
  const filled = forwardFillRow(groupRow);
  const nonEmpty = filled.filter((cell) => String(cell ?? "").trim() !== "");
  if (nonEmpty.length < 2) return 0;
  const unique = new Set(nonEmpty.map((cell) => normalizeKey(cell)));
  return nonEmpty.length - unique.size;
}

function detectGroupedHeaderRows(matrix, headerRowIndex, category) {
  const candidates = [];

  // Case A: finder landed on the group/parent row; next row is subheaders.
  candidates.push({
    groupRowIndex: headerRowIndex,
    fieldRowIndex: headerRowIndex + 1,
  });

  // Case B: finder landed on the subheader row; previous row is the group row.
  if (headerRowIndex > 0) {
    candidates.push({
      groupRowIndex: headerRowIndex - 1,
      fieldRowIndex: headerRowIndex,
    });
  }

  let best = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const groupRow = matrix[candidate.groupRowIndex] || [];
    const fieldRow = matrix[candidate.fieldRowIndex] || [];
    const nextRow = matrix[candidate.fieldRowIndex + 1] || [];

    if (isEmptyRow(groupRow) || isEmptyRow(fieldRow)) continue;

    const groupCells = getNonEmptyCells(groupRow);
    const fieldCells = getNonEmptyCells(fieldRow);
    if (groupCells.length < 1 || fieldCells.length < 2) continue;

    // Subheader row must look like labels, not data.
    if (!rowLooksLikeFieldLabels(fieldRow, category) && !rowLooksLikeHeaderLabelsOnly(fieldRow, category)) {
      continue;
    }
    if (rowLooksLikeDataRow(fieldRow)) continue;

    const groupScore = scoreAsHeaderRow(groupRow, category);
    const fieldScore = scoreAsHeaderRow(fieldRow, category);
    const uniqueGroups = new Set(groupCells.map((cell) => normalizeKey(cell)));
    const repeatedSpans = countRepeatedGroupSpans(groupRow);
    const nextLooksLikeData =
      !isEmptyRow(nextRow) &&
      (rowLooksLikeDataRow(nextRow) || !rowLooksLikeHeaderLabelsOnly(nextRow, category));

    let score = 0;
    if (fieldScore >= groupScore) score += 2;
    if (fieldScore >= 0.8) score += 2;
    if (uniqueGroups.size < groupCells.length || repeatedSpans > 0) score += 3;
    if (nextLooksLikeData) score += 3;
    if (rowLooksLikeHeaderLabelsOnly(fieldRow, category)) score += 2;
    if ((category?.groups || []).length > 0) score += 1;

    // Strong accept paths
    const hasMergedGroups = uniqueGroups.size < groupCells.length || repeatedSpans > 0;
    const accept =
      (hasMergedGroups && fieldScore >= 0.55 && nextLooksLikeData) ||
      (fieldScore >= 1.0 && nextLooksLikeData) ||
      (rowLooksLikeHeaderLabelsOnly(fieldRow, category) && nextLooksLikeData && groupCells.length >= 1) ||
      (uniqueGroups.size <= Math.max(2, Math.floor(groupCells.length / 2)) && fieldScore >= 0.8);

    if (!accept) continue;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function filterHeaderLikeDataRows(rows, headers, category) {
  if (!rows.length) return rows;
  const known = collectKnownHeaderLabels(category);
  const headerKeys = new Set(headers.map((header) => normalizeKey(header)));

  return rows.filter((row, index) => {
    // Only strip leading header-like rows (common two-row header miss).
    if (index > 2) return true;
    const values = headers
      .map((header) => String(row[header] ?? "").trim())
      .filter(Boolean);
    if (values.length === 0) return false;

    const knownHits = values.filter((value) => {
      const key = normalizeKey(value);
      return known.has(key) || headerKeys.has(key);
    }).length;

    if (knownHits >= Math.max(2, Math.ceil(values.length * 0.5))) {
      return false;
    }

    const sharedFieldCount = Math.min(
      (category.sharedFields || []).length || 6,
      headers.length
    );
    const earlyValues = headers
      .slice(0, sharedFieldCount)
      .map((header) => String(row[header] ?? "").trim())
      .filter(Boolean);
    const earlyKnownHits = earlyValues.filter((value) => {
      const key = normalizeKey(value);
      return known.has(key) || headerKeys.has(key);
    }).length;
    if (
      earlyValues.length >= 3 &&
      earlyKnownHits >= Math.max(2, Math.ceil(earlyValues.length * 0.6))
    ) {
      return false;
    }

    // Single-cell "OS Version" style first row under a mapped OS column
    if (values.length <= 3 && knownHits >= 1 && !values.some((value) => looksLikeDataValue(value))) {
      const allLabelLike = values.every((value) => looksLikeShortLabel(value));
      if (allLabelLike) return false;
    }

    return true;
  });
}

export function parseWorkbookSheet(sheet, category) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  if (!matrix.length) {
    return {
      headerRow: 0,
      headers: [],
      headerMeta: [],
      rows: [],
      skippedTitleRows: 0,
      groupedHeaders: false,
    };
  }

  const { headerRowIndex, skippedTitleRows } = findHeaderRowIndex(matrix, category);
  const grouped = detectGroupedHeaderRows(matrix, headerRowIndex, category);

  let headers = [];
  let headerMeta = [];
  let dataStartIndex = headerRowIndex + 1;
  let groupedHeaders = false;

  if (grouped) {
    groupedHeaders = true;
    const built = buildGroupedHeaders(
      matrix[grouped.groupRowIndex] || [],
      matrix[grouped.fieldRowIndex] || [],
      category
    );
    headers = built.headers;
    headerMeta = built.headerMeta;
    dataStartIndex = grouped.fieldRowIndex + 1;
  } else {
    const headerCells = matrix[headerRowIndex] || [];
    headers = headerCells.map((cell, index) => {
      const text = String(cell ?? "").trim();
      return text || `Column ${index + 1}`;
    });
    headerMeta = headers.map((header, index) => ({
      key: header,
      groupLabel: "",
      fieldLabel: header,
      columnIndex: index,
    }));
  }

  const seen = {};
  const uniqueHeaders = headers.map((header, index) => {
    let unique = header;
    if (seen[header] === undefined) {
      seen[header] = 0;
    } else {
      seen[header] += 1;
      unique = `${header} (${seen[header]})`;
    }
    if (headerMeta[index]) {
      headerMeta[index] = { ...headerMeta[index], key: unique };
    }
    return unique;
  });

  const rows = [];
  for (let i = dataStartIndex; i < matrix.length; i += 1) {
    const rowCells = matrix[i] || [];
    if (isEmptyRow(rowCells)) continue;

    const row = {};
    uniqueHeaders.forEach((header, index) => {
      const columnIndex =
        headerMeta[index]?.columnIndex >= 0 ? headerMeta[index].columnIndex : index;
      row[header] = rowCells[columnIndex] ?? "";
    });
    rows.push(row);
  }

  const filteredRows = filterHeaderLikeDataRows(rows, uniqueHeaders, category);

  return {
    headerRow: grouped?.groupRowIndex ?? headerRowIndex,
    headers: uniqueHeaders,
    headerMeta,
    rows: filteredRows,
    skippedTitleRows,
    groupedHeaders,
  };
}

export function buildTemplateCsv(category) {
  const fields = getCategoryFields(category);
  const hasGroups = (category.groups || []).length > 0;

  if (!hasGroups) {
    const headers = fields.map((field) => field.label);
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, (category.label || "Template").slice(0, 31));
    return XLSX.write(workbook, { bookType: "csv", type: "array" });
  }

  const groupRow = fields.map((field) => getFieldGroupLabel(category, field));
  const fieldRow = fields.map((field) => field.label);
  const worksheet = XLSX.utils.aoa_to_sheet([groupRow, fieldRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, (category.label || "Template").slice(0, 31));
  return XLSX.write(workbook, { bookType: "csv", type: "array" });
}

export function downloadTemplate(category) {
  const bytes = buildTemplateCsv(category);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const slug = (category.label || category.code || "template").toLowerCase().replace(/\s+/g, "-");
  anchor.href = url;
  anchor.download = `${slug}-import-template.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export { IGNORE_VALUE };
