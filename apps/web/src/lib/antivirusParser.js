function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") return value;
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (["true", "yes", "y", "1", "installed", "available", "on"].includes(key)) return true;
  if (["false", "no", "n", "0", "missing", "none", "not installed", "off", "n/a", "-"].includes(key)) {
    return false;
  }
  return null;
}

export function parseAntivirusComposite(raw) {
  if (isMissing(raw)) {
    return { installed: false, type: null, days: null };
  }

  const bool = parseBooleanLike(raw);
  if (bool === false) {
    return { installed: false, type: null, days: null };
  }
  if (bool === true && String(raw).trim().length <= 3) {
    return { installed: true, type: null, days: null };
  }

  const text = String(raw).trim();
  const negative = /^(no|none|n\/a|not installed|missing|without antivirus|no av|-)$/i.test(text);
  if (negative) {
    return { installed: false, type: null, days: null };
  }

  const daysMatch =
    text.match(/(\d+)\s*(?:days?\s*(?:left|remaining)?|d\b)/i) ||
    text.match(/\((\d+)\)/) ||
    text.match(/-\s*(\d+)\s*$/);

  const days = daysMatch ? Number(daysMatch[1]) : null;
  let type = text
    .replace(/(\d+)\s*(?:days?\s*(?:left|remaining)?|d\b)/gi, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[-–—,:;]\s*\d+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!type && bool === true) {
    type = text;
  }

  return {
    installed: true,
    type: type || text,
    days: Number.isFinite(days) ? days : null,
  };
}

export function applyAntivirusCompositeToDetails(details) {
  if (!details || typeof details !== "object") return details;

  const next = { ...details };
  const source =
    next.antivirusInstalled ?? next.antivirus ?? next.antivirusType ?? null;

  if (source === null || source === undefined || source === "") {
    return next;
  }

  const boolOnly = parseBooleanLike(source);
  if (boolOnly === true || boolOnly === false) {
    next.antivirusInstalled = boolOnly;
    delete next.antivirus;
    return next;
  }

  const parsed = parseAntivirusComposite(source);
  next.antivirusInstalled = parsed.installed;

  if (parsed.installed) {
    if (parsed.type && isMissing(next.antivirusType)) {
      next.antivirusType = parsed.type;
    }
    if (parsed.days != null && isMissing(next.remainingSubscriptionDays)) {
      next.remainingSubscriptionDays = parsed.days;
    }
  } else {
    if (isMissing(next.antivirusType)) next.antivirusType = null;
    if (isMissing(next.remainingSubscriptionDays)) next.remainingSubscriptionDays = null;
  }

  delete next.antivirus;
  return next;
}
