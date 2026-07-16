import * as XLSX from "xlsx";

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

function isFieldRequired(field, category) {
  if (typeof field.required === "boolean") return field.required;
  const sharedRequired = category?.sharedRequired || [];
  const detailRequired = category?.detailRequired || [];
  return sharedRequired.includes(field.name) || detailRequired.includes(field.name);
}

export function getRequiredFieldDefs(category) {
  return getCategoryFields(category).filter((field) => isFieldRequired(field, category));
}

export function getCategoryFieldOptions(category, options = {}) {
  const { importMode = false } = options;
  return getCategoryFields(category).map((field) => ({
    name: field.name,
    label: field.label,
    // Import: no field is required to map; blank cells are allowed and flagged after import.
    required: importMode ? false : isFieldRequired(field, category),
  }));
}

export function scoreHeaderToField(header, field) {
  const headerNorm = normalizeKey(header);
  const headerCompact = compactKey(header);
  if (!headerNorm) return 0;

  const labelNorm = normalizeKey(field.label);
  const labelCompact = compactKey(field.label);
  const nameNorm = normalizeKey(field.name);
  const nameCompact = compactKey(field.name);

  if (headerNorm === labelNorm || headerCompact === labelCompact) return 1;
  if (headerNorm === nameNorm || headerCompact === nameCompact) return 0.98;

  const aliases = FIELD_ALIASES[field.name] || [];
  for (const alias of aliases) {
    const aliasNorm = normalizeKey(alias);
    const aliasCompact = compactKey(alias);
    if (headerNorm === aliasNorm || headerCompact === aliasCompact) return 0.95;
  }

  const headerTokens = new Set(headerNorm.split(" ").filter(Boolean));
  const fieldTokens = new Set(
    [
      ...labelNorm.split(" "),
      ...nameNorm.split(" "),
      ...aliases.flatMap((alias) => normalizeKey(alias).split(" ")),
    ].filter(Boolean)
  );

  if (headerNorm.includes(labelNorm) || labelNorm.includes(headerNorm)) return 0.85;
  if (headerCompact.includes(labelCompact) || labelCompact.includes(headerCompact)) return 0.8;

  let overlap = 0;
  for (const token of headerTokens) {
    if (fieldTokens.has(token)) overlap += 1;
  }
  if (overlap === 0) return 0;

  const ratio = overlap / Math.max(headerTokens.size, 1);
  if (ratio >= 0.75) return 0.75;
  if (ratio >= 0.5) return 0.65;
  return 0.55;
}

/**
 * Greedy unique assignment of file headers → field names.
 * Returns { mapping: { [fileHeader]: fieldName|null }, confidence: { [fileHeader]: number } }
 */
export function autoMapColumns(fileHeaders, category) {
  const fields = getCategoryFields(category);
  const mapping = {};
  const confidence = {};
  const usedFields = new Set();

  const candidates = [];
  for (const header of fileHeaders) {
    for (const field of fields) {
      const score = scoreHeaderToField(header, field);
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

const HARDWARE_STATUS_OPTIONS = ["Functional", "Non-funct", "Under Repair"];
const SOFTWARE_STATUS_OPTIONS = ["Active", "Deprecated", "Inactive"];
const DEVICE_TYPE_OPTIONS = ["Desktop", "Laptop"];
const OS_OPTIONS = ["Windows 7", "Windows 8", "Windows 8.1", "Windows 10", "Windows 11"];

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

const DEVICE_TYPE_ALIASES = {
  desktop: "Desktop",
  pc: "Desktop",
  tower: "Desktop",
  workstation: "Desktop",
  laptop: "Laptop",
  notebook: "Laptop",
  portable: "Laptop",
};

const OS_ALIASES = {
  "windows 7": "Windows 7",
  win7: "Windows 7",
  "win 7": "Windows 7",
  "windows 8": "Windows 8",
  win8: "Windows 8",
  "win 8": "Windows 8",
  "windows 8.1": "Windows 8.1",
  "windows 81": "Windows 8.1",
  win81: "Windows 8.1",
  "win 8.1": "Windows 8.1",
  "windows 10": "Windows 10",
  win10: "Windows 10",
  "win 10": "Windows 10",
  windows10: "Windows 10",
  "windows 11": "Windows 11",
  win11: "Windows 11",
  "win 11": "Windows 11",
  windows11: "Windows 11",
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

export function normalizeImportFieldValue(fieldName, rawValue, categoryCode) {
  if (fieldName === "location") return normalizeLocationValue(rawValue);

  if (fieldName === "status") {
    const isSoftware = categoryCode === "software";
    return normalizeFromAliasMap(
      rawValue,
      isSoftware ? SOFTWARE_STATUS_OPTIONS : HARDWARE_STATUS_OPTIONS,
      isSoftware ? SOFTWARE_STATUS_ALIASES : HARDWARE_STATUS_ALIASES
    );
  }

  if (fieldName === "deviceType") {
    return normalizeFromAliasMap(rawValue, DEVICE_TYPE_OPTIONS, DEVICE_TYPE_ALIASES);
  }

  if (fieldName === "osInstalled") {
    return normalizeFromAliasMap(rawValue, OS_OPTIONS, OS_ALIASES);
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
  return value;
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

      value = normalizeImportFieldValue(fieldName, value, category.code);

      if (sharedNames.has(fieldName)) shared[fieldName] = value;
      else if (detailNames.has(fieldName)) details[fieldName] = value;
    }

    return {
      category: category.code,
      ...shared,
      details,
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

  // Banner-style: few filled cells across a wide row
  const totalCells = (row || []).length;
  if (totalCells >= 5 && nonEmpty.length <= 2) {
    return true;
  }

  // Two short cells that don't look like field labels (e.g. "Printers" / "Q1 2026")
  if (nonEmpty.length === 2 && nonEmpty.every((cell) => cell.length < 40)) {
    const bothLookLikeLabels = nonEmpty.every(looksLikeShortLabel);
    if (!bothLookLikeLabels) return true;
  }

  return false;
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
      const cellScore = scoreHeaderToField(cell, field);
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

export function parseWorkbookSheet(sheet, category) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  if (!matrix.length) {
    return { headerRow: 0, headers: [], rows: [], skippedTitleRows: 0 };
  }

  const { headerRowIndex, skippedTitleRows } = findHeaderRowIndex(matrix, category);

  const headerCells = matrix[headerRowIndex] || [];
  const headers = headerCells.map((cell, index) => {
    const text = String(cell ?? "").trim();
    return text || `Column ${index + 1}`;
  });

  const seen = {};
  const uniqueHeaders = headers.map((header) => {
    if (seen[header] === undefined) {
      seen[header] = 0;
      return header;
    }
    seen[header] += 1;
    return `${header} (${seen[header]})`;
  });

  const rows = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const rowCells = matrix[i] || [];
    if (isEmptyRow(rowCells)) continue;

    const row = {};
    uniqueHeaders.forEach((header, index) => {
      row[header] = rowCells[index] ?? "";
    });
    rows.push(row);
  }

  return {
    headerRow: headerRowIndex,
    headers: uniqueHeaders,
    rows,
    skippedTitleRows,
  };
}

export function buildTemplateCsv(category) {
  const fields = getCategoryFields(category);
  const headers = fields.map((field) => field.label);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
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
