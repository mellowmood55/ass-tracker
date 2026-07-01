const CATEGORY_CODES = {
  COMPUTER: "computer",
  SOFTWARE: "software",
  UPS: "ups",
  NETWORK: "network",
  OTHER: "other",
  MOBILE: "mobile",
  PRINTER: "printer",
};

const COMPUTER_LOCATIONS = ["9th Floor Wing A", "9th floor wing B", "10th floor"];
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
    sharedRequired: ["location", "office", "model", "assetNo", "serialNo", "status"],
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
        options: COMPUTER_LOCATIONS,
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
    sharedRequired: ["location", "model", "serialNo", "status"],
    detailRequired: ["item"],
    sharedFields: [
      { name: "location", label: "Location", type: "text", required: true },
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
  COMPUTER_LOCATIONS,
  COMPUTER_TYPES,
  COMPUTER_OS_OPTIONS,
  STATUS_BY_CATEGORY,
};
