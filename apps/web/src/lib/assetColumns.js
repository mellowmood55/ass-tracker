import { SHARED_FIELD_NAMES } from "./constants";

export const CATEGORY_LIST_COLUMNS = {
  computer: [
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Location", value: (asset) => asset.location || "-" },
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Computer Type", value: (asset) => asset.details?.deviceType || "-" },
    { label: "OS Installed", value: (asset) => asset.details?.osInstalled || "-" },
    {
      label: "Antivirus Installed",
      value: (asset) => (asset.details?.antivirusInstalled ? "Yes" : "No"),
    },
    { label: "Antivirus Type", value: (asset) => asset.details?.antivirusType || "-" },
    { label: "Remaining Days", value: (asset) => asset.details?.remainingSubscriptionDays ?? "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  printer: [
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Location", value: (asset) => asset.location || "-" },
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  software: [
    { label: "Description", value: (asset) => asset.details?.description || "-" },
    { label: "Function", value: (asset) => asset.details?.function || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  ups: [
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  network: [
    { label: "Location", value: (asset) => asset.location || "-" },
    { label: "Item", value: (asset) => asset.details?.item || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  other: [
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Item", value: (asset) => asset.details?.item || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  mobile: [
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
};

export const RISK_PRIORITY = Object.freeze({
  "antivirus-expired": 1,
  "missing-antivirus": 2,
  "antivirus-expiring": 3,
  "outdated-os": 4,
});

export const RISK_LABELS = Object.freeze({
  "antivirus-expired": "Antivirus Expired",
  "missing-antivirus": "Missing Antivirus",
  "antivirus-expiring": "Antivirus Expiring Soon",
  "outdated-os": "Outdated OS",
});

export function getRiskLabelFromKey(riskKey) {
  return RISK_LABELS[riskKey] || null;
}

export function getRiskLabel(asset) {
  if (asset.category !== "computer") {
    return null;
  }

  const outdatedWindows = ["Windows 7", "Windows 8", "Windows 8.1"];
  const antivirusDays = Number(asset.details?.remainingSubscriptionDays);
  const antivirusInstalled = asset.details?.antivirusInstalled;
  const osInstalled = asset.details?.osInstalled;

  if (antivirusInstalled !== true) {
    return "Missing Antivirus";
  }

  if (Number.isFinite(antivirusDays) && antivirusDays <= 0) {
    return "Antivirus Expired";
  }

  if (Number.isFinite(antivirusDays) && antivirusDays > 0 && antivirusDays <= 30) {
    return "Antivirus Expiring Soon";
  }

  if (osInstalled && outdatedWindows.includes(osInstalled)) {
    return "Outdated OS";
  }

  return "Healthy";
}

export function getRiskVariant(label) {
  switch (label) {
    case "Healthy":
      return "default";
    case "Outdated OS":
    case "Missing Antivirus":
      return "secondary";
    case "Antivirus Expiring Soon":
      return "outline";
    case "Antivirus Expired":
      return "destructive";
    default:
      return "outline";
  }
}

export function makeInitialFormState(category) {
  if (!category) return {};

  const state = {};
  for (const field of category.sharedFields) {
    state[field.name] = field.type === "boolean" ? false : "";
  }
  for (const field of category.detailFields) {
    state[field.name] = field.type === "boolean" ? false : "";
  }
  return state;
}

export function formStateFromAsset(asset, category) {
  const nextState = makeInitialFormState(category);
  for (const field of category.sharedFields) {
    nextState[field.name] = asset[field.name] ?? nextState[field.name];
  }
  for (const field of category.detailFields) {
    nextState[field.name] = asset.details?.[field.name] ?? nextState[field.name];
  }
  return nextState;
}

export function payloadFromForm(formState, selectedCategory, activeCategory) {
  const shared = {};
  const details = {};

  for (const name of SHARED_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(formState, name)) {
      shared[name] = formState[name];
    }
  }

  if (activeCategory) {
    for (const field of activeCategory.detailFields) {
      details[field.name] = formState[field.name];
    }
  }

  return {
    category: selectedCategory,
    ...shared,
    details,
  };
}

export function matchesRiskFilter(asset, riskFilter) {
  if (!riskFilter) return true;
  const label = getRiskLabel(asset);
  switch (riskFilter) {
    case "at-risk":
      return Boolean(label) && label !== "Healthy";
    case "missing-antivirus":
      return label === "Missing Antivirus";
    case "antivirus-expired":
      return label === "Antivirus Expired";
    case "antivirus-expiring":
      return label === "Antivirus Expiring Soon";
    case "outdated-os":
      return label === "Outdated OS";
    default:
      return true;
  }
}

export function formatRiskFilterLabel(riskFilter) {
  if (!riskFilter) return "";
  if (riskFilter === "at-risk") return "All at-risk computers";
  return getRiskLabelFromKey(riskFilter) || riskFilter.replace(/-/g, " ");
}
