const { z } = require("zod");
const {
  CATEGORY_CODES,
  CATEGORY_CONFIG,
  COMPUTER_LOCATIONS,
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
  status: z.string().min(1),
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

function validateAssetPayload(payload) {
  const parsed = assetPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const data = parsed.data;
  const config = CATEGORY_CONFIG[data.category];
  if (!config) {
    return { valid: false, errors: ["Invalid category selected."] };
  }

  const statusList = STATUS_BY_CATEGORY[data.category] || [];
  if (!statusList.includes(data.status)) {
    return {
      valid: false,
      errors: [
        `Invalid status '${data.status}' for category '${config.label}'.`,
      ],
    };
  }

  const errors = [];

  for (const field of config.sharedRequired) {
    if (isMissing(data[field])) {
      errors.push(`Field '${field}' is required for ${config.label}.`);
    }
  }

  for (const field of config.detailRequired) {
    if (isMissing(data.details[field])) {
      errors.push(`Detail field '${field}' is required for ${config.label}.`);
    }
  }

  if (data.category === CATEGORY_CODES.COMPUTER) {
    if (!COMPUTER_LOCATIONS.includes(data.location)) {
      errors.push("Computer location must be one of the configured floor options.");
    }

    if (!COMPUTER_TYPES.includes(data.details.deviceType)) {
      errors.push("Computer type must be Desktop or Laptop.");
    }

    if (!COMPUTER_OS_OPTIONS.includes(data.details.osInstalled)) {
      errors.push("Computer OS must be Windows 7, Windows 8, Windows 8.1, Windows 10, or Windows 11.");
    }

    if (data.details.antivirusInstalled === true) {
      if (isMissing(data.details.antivirusType)) {
        errors.push("Detail field 'antivirusType' is required when antivirus is installed.");
      }

      const days = Number(data.details.remainingSubscriptionDays);
      if (Number.isNaN(days) || days < 0) {
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
};
