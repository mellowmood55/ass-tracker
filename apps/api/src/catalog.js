const CATEGORY_CODES = {
  COMPUTER: "computer",
  SOFTWARE: "software",
  UPS: "ups",
  NETWORK: "network",
  OTHER: "other",
  MOBILE: "mobile",
  PRINTER: "printer",
};

const LOCATION_OPTIONS = ["9TH Floor (A)", "9th floor (B)", "10th floor"];
const COMPUTER_LOCATIONS = LOCATION_OPTIONS; // backward-compatible alias

const LOCATION_ALIASES = {
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

function normalizeKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[#./\\_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactKey(text) {
  return normalizeKey(text).replace(/\s+/g, "");
}

function matchCanonicalOption(raw, options) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (options.includes(trimmed)) return trimmed;

  const key = normalizeKey(trimmed);
  const compact = compactKey(trimmed);
  for (const option of options) {
    if (normalizeKey(option) === key || compactKey(option) === compact) {
      return option;
    }
  }
  return null;
}

function normalizeLocationValue(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const exact = matchCanonicalOption(trimmed, LOCATION_OPTIONS);
  if (exact) return exact;

  const key = normalizeKey(trimmed);
  if (LOCATION_ALIASES[key]) return LOCATION_ALIASES[key];

  const compact = compactKey(trimmed);
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (compactKey(alias) === compact) return canonical;
  }

  return null;
}

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
  "windows10": "Windows 10",
  "windows 11": "Windows 11",
  win11: "Windows 11",
  "win 11": "Windows 11",
  windows11: "Windows 11",
};

function normalizeBooleanValue(value) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  const key = normalizeKey(value);
  if (!key) return String(value).trim();
  if (["true", "yes", "y", "1", "installed", "available", "on"].includes(key)) return true;
  if (["false", "no", "n", "0", "missing", "none", "not installed", "off"].includes(key)) {
    return false;
  }
  return value;
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

function normalizeImportFieldValue(fieldName, rawValue, categoryCode) {
  if (fieldName === "location") {
    return normalizeLocationValue(rawValue);
  }

  if (fieldName === "status") {
    const options = STATUS_BY_CATEGORY[categoryCode] || [];
    const aliases =
      categoryCode === CATEGORY_CODES.SOFTWARE ? SOFTWARE_STATUS_ALIASES : HARDWARE_STATUS_ALIASES;
    return normalizeFromAliasMap(rawValue, options, aliases);
  }

  if (fieldName === "deviceType") {
    return normalizeFromAliasMap(rawValue, COMPUTER_TYPES, DEVICE_TYPE_ALIASES);
  }

  if (fieldName === "osInstalled") {
    return normalizeFromAliasMap(rawValue, COMPUTER_OS_OPTIONS, OS_ALIASES);
  }

  if (["officeInstalled", "antivirusInstalled", "wirelessCapability"].includes(fieldName)) {
    return normalizeBooleanValue(rawValue);
  }

  return rawValue;
}

function normalizeImportRow(row, categoryCode) {
  const config = CATEGORY_CONFIG[categoryCode];
  if (!config) return row;

  const details = { ...(row.details || {}) };
  const normalized = {
    ...row,
    location: normalizeImportFieldValue("location", row.location, categoryCode),
    status: normalizeImportFieldValue("status", row.status, categoryCode),
    details,
  };

  for (const field of config.detailFields || []) {
    if (!Object.prototype.hasOwnProperty.call(details, field.name)) continue;
    details[field.name] = normalizeImportFieldValue(field.name, details[field.name], categoryCode);
  }

  return normalized;
}

const COMPUTER_TYPES = ["Desktop", "Laptop"];
const COMPUTER_OS_OPTIONS = ["Windows 7", "Windows 8", "Windows 8.1", "Windows 10", "Windows 11"];

const STATUS_BY_CATEGORY = {
  [CATEGORY_CODES.COMPUTER]: ["Functional", "Non-funct", "Under Repair"],
  [CATEGORY_CODES.SOFTWARE]: ["Active", "Deprecated", "Inactive"],
  [CATEGORY_CODES.UPS]: ["Functional", "Non-funct", "Under Repair"],
  [CATEGORY_CODES.NETWORK]: ["Functional", "Non-funct", "Under Repair"],
  [CATEGORY_CODES.OTHER]: ["Functional", "Non-funct", "Under Repair"],
  [CATEGORY_CODES.MOBILE]: ["Functional", "Non-funct", "Under Repair"],
  [CATEGORY_CODES.PRINTER]: ["Functional", "Non-funct", "Under Repair"],
};

const CATEGORY_CONFIG = {
  [CATEGORY_CODES.COMPUTER]: {
    label: "Computer",
    sharedRequired: ["office", "model", "assetNo", "serialNo", "status"],
    detailRequired: [
      "deviceType",
      "osInstalled",
      "officeInstalled",
      "antivirusInstalled",
      "wirelessCapability",
    ],
    sharedFields: [
      {
        name: "location",
        label: "Location",
        type: "select",
        required: true,
        options: LOCATION_OPTIONS,
      },
      { name: "office", label: "Office", type: "text", required: true },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "assetNo", label: "Asset No", type: "text", required: true },
      { name: "serialNo", label: "Serial No", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [
      {
        name: "deviceType",
        label: "Computer Type",
        type: "select",
        required: true,
        options: COMPUTER_TYPES,
      },
      {
        name: "osInstalled",
        label: "OS Installed",
        type: "select",
        required: true,
        options: COMPUTER_OS_OPTIONS,
      },
      { name: "officeInstalled", label: "Office Installed", type: "boolean", required: true },
      {
        name: "antivirusInstalled",
        label: "Antivirus Installed",
        type: "boolean",
        required: true,
      },
      {
        name: "wirelessCapability",
        label: "Wireless Connection Capability",
        type: "boolean",
        required: true,
      },
      {
        name: "antivirusType",
        label: "Antivirus Type",
        type: "text",
        required: false,
      },
      {
        name: "remainingSubscriptionDays",
        label: "Remaining Subscription Days",
        type: "number",
        required: false,
      },
    ],
  },
  [CATEGORY_CODES.SOFTWARE]: {
    label: "Software",
    sharedRequired: ["status"],
    detailRequired: ["description", "function"],
    sharedFields: [
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [
      { name: "description", label: "Description", type: "text", required: true },
      { name: "function", label: "Function", type: "text", required: true },
    ],
  },
  [CATEGORY_CODES.UPS]: {
    label: "UPS",
    sharedRequired: ["office", "model", "serialNo", "status"],
    detailRequired: [],
    sharedFields: [
      { name: "office", label: "Office", type: "text", required: true },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "serialNo", label: "Serial No", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [],
  },
  [CATEGORY_CODES.NETWORK]: {
    label: "Network Infrastructure",
    sharedRequired: ["model", "serialNo", "status"],
    detailRequired: ["item"],
    sharedFields: [
      {
        name: "location",
        label: "Location",
        type: "select",
        required: true,
        options: LOCATION_OPTIONS,
      },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "serialNo", label: "Serial No", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [
      { name: "item", label: "Item", type: "text", required: true },
    ],
  },
  [CATEGORY_CODES.OTHER]: {
    label: "Other Assets",
    sharedRequired: ["office", "model", "assetNo", "serialNo", "status"],
    detailRequired: ["item"],
    sharedFields: [
      { name: "office", label: "Office", type: "text", required: true },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "assetNo", label: "Asset No", type: "text", required: true },
      { name: "serialNo", label: "Serial No", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [
      { name: "item", label: "Item", type: "text", required: true },
    ],
  },
  [CATEGORY_CODES.MOBILE]: {
    label: "Mobile Devices",
    sharedRequired: ["office", "model", "assetNo", "status"],
    detailRequired: [],
    sharedFields: [
      { name: "office", label: "Office", type: "text", required: true },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "assetNo", label: "Asset No", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [],
  },
  [CATEGORY_CODES.PRINTER]: {
    label: "Printer",
    sharedRequired: ["office", "model", "assetNo", "serialNo", "status"],
    detailRequired: [],
    sharedFields: [
      {
        name: "location",
        label: "Location",
        type: "select",
        required: true,
        options: LOCATION_OPTIONS,
      },
      { name: "office", label: "Office", type: "text", required: true },
      { name: "model", label: "Model", type: "text", required: true },
      { name: "assetNo", label: "Asset No", type: "text", required: true },
      { name: "serialNo", label: "Serial No", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true },
    ],
    detailFields: [],
  },
};

module.exports = {
  CATEGORY_CODES,
  CATEGORY_CONFIG,
  LOCATION_OPTIONS,
  COMPUTER_LOCATIONS,
  COMPUTER_TYPES,
  COMPUTER_OS_OPTIONS,
  STATUS_BY_CATEGORY,
  normalizeLocationValue,
  normalizeImportFieldValue,
  normalizeImportRow,
};
