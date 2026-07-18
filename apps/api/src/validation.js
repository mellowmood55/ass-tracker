const { z } = require("zod");
const {
  CATEGORY_CODES,
  CATEGORY_CONFIG,
  LOCATION_OPTIONS,
  COMPUTER_OS_OPTIONS,
  COMPUTER_TYPES,
  STATUS_BY_CATEGORY,
} = require("./catalog");

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

function isMissing(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return false;
}

function categoryUsesLocationOptions(categoryCode) {
  const config = CATEGORY_CONFIG[categoryCode];
  if (!config) return false;
  return (config.sharedFields || []).some(
    (field) => field.name === "location" && field.type === "select"
  );
}

function fieldLabel(config, fieldName) {
  const field = [...(config.sharedFields || []), ...(config.detailFields || [])].find(
    (entry) => entry.name === fieldName
  );
  return field?.label || fieldName;
}

/**
 * Lists normally-required fields that are blank on this payload (for post-import admin alerts).
 */
function collectBlankRequiredFields(payload) {
  const config = CATEGORY_CONFIG[payload.category];
  if (!config) return [];

  const blanks = [];
  const details = payload.details || {};

  for (const field of config.sharedFields || []) {
    const required =
      field.required === true || (config.sharedRequired || []).includes(field.name);
    if (!required) continue;
    if (isMissing(payload[field.name])) {
      blanks.push(field.label || field.name);
    }
  }

  for (const field of config.detailFields || []) {
    const required =
      field.required === true || (config.detailRequired || []).includes(field.name);
    if (!required) continue;
    if (isMissing(details[field.name])) {
      blanks.push(field.label || field.name);
    }
  }

  if (details.antivirusInstalled === true) {
    if (isMissing(details.antivirusType)) {
      blanks.push(fieldLabel(config, "antivirusType"));
    }
    if (isMissing(details.remainingSubscriptionDays)) {
      blanks.push(fieldLabel(config, "remainingSubscriptionDays"));
    }
  }

  return blanks;
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
    location: isMissing(parsed.data.location) ? null : parsed.data.location,
    office: isMissing(parsed.data.office) ? null : parsed.data.office,
    model: isMissing(parsed.data.model) ? null : parsed.data.model,
    assetNo: isMissing(parsed.data.assetNo) ? null : String(parsed.data.assetNo).trim(),
    serialNo: isMissing(parsed.data.serialNo) ? null : String(parsed.data.serialNo).trim(),
    status: isMissing(parsed.data.status) ? null : String(parsed.data.status).trim(),
    details: parsed.data.details || {},
  };

  const config = CATEGORY_CONFIG[data.category];
  if (!config) {
    return { valid: false, errors: ["Invalid category selected."] };
  }

  const statusList = STATUS_BY_CATEGORY[data.category] || [];
  const errors = [];

  if (isImport) {
    // Import: blank values are allowed for every field. Only reject present-but-invalid selects.
    if (!isMissing(data.status) && !statusList.includes(data.status)) {
      errors.push(`Invalid status '${data.status}' for category '${config.label}'.`);
    }

    // DB requires status NOT NULL — provisional default when blank; flagged via collectBlankRequiredFields.
    if (isMissing(data.status)) {
      data.status = statusList[0] || "Functional";
    }
  } else {
    if (isMissing(data.status) || !statusList.includes(data.status)) {
      errors.push(
        isMissing(data.status)
          ? `Field 'status' is required for ${config.label}.`
          : `Invalid status '${data.status}' for category '${config.label}'.`
      );
    }

    for (const field of config.sharedRequired) {
      if (isMissing(data[field])) {
        errors.push(`Field '${field}' is required for ${config.label}.`);
      }
    }

    const locationField = (config.sharedFields || []).find((field) => field.name === "location");
    if (locationField?.required && isMissing(data.location)) {
      errors.push(`Field 'location' is required for ${config.label}.`);
    }

    for (const field of config.detailRequired) {
      if (isMissing(data.details[field])) {
        errors.push(`Detail field '${field}' is required for ${config.label}.`);
      }
    }
  }

  if (categoryUsesLocationOptions(data.category) && !isMissing(data.location)) {
    if (!LOCATION_OPTIONS.includes(data.location)) {
      errors.push("Location must be one of: 9TH Floor (A), 9th floor (B), or 10th floor.");
    }
  }

  if (data.category === CATEGORY_CODES.COMPUTER) {
    if (!isMissing(data.details.deviceType) && !COMPUTER_TYPES.includes(data.details.deviceType)) {
      errors.push("Computer type must be Desktop or Laptop.");
    }

    if (!isMissing(data.details.osInstalled) && !COMPUTER_OS_OPTIONS.includes(data.details.osInstalled)) {
      errors.push("Computer OS must be Windows 7, Windows 8, Windows 8.1, Windows 10, or Windows 11.");
    }

    if (!isImport) {
      if (isMissing(data.details.deviceType)) {
        errors.push("Detail field 'deviceType' is required for Computer.");
      }
      if (isMissing(data.details.osInstalled)) {
        errors.push("Detail field 'osInstalled' is required for Computer.");
      }
    }

    if (data.details.antivirusInstalled === true) {
      if (!isImport) {
        if (isMissing(data.details.antivirusType)) {
          errors.push("Detail field 'antivirusType' is required when antivirus is installed.");
        }

        const days = Number(data.details.remainingSubscriptionDays);
        if (Number.isNaN(days) || days < 0) {
          errors.push(
            "Detail field 'remainingSubscriptionDays' must be a non-negative number when antivirus is installed."
          );
        }
      } else if (
        !isMissing(data.details.remainingSubscriptionDays) &&
        (Number.isNaN(Number(data.details.remainingSubscriptionDays)) ||
          Number(data.details.remainingSubscriptionDays) < 0)
      ) {
        errors.push(
          "Detail field 'remainingSubscriptionDays' must be a non-negative number when antivirus is installed."
        );
      }
    }
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
};
