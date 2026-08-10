const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { z } = require("zod");

const { query, withTransaction, initDb, isUniqueViolation } = require("./db");
const {
  signToken,
  requireAuth,
  requireAdmin,
  requireAdminForEdit,
  normalizeRole,
  ROLES,
} = require("./auth");
const { CATEGORY_CODES, CATEGORY_CONFIG } = require("./catalog");
const {
  loadAllCategoryConfigsForApi,
  loadSettingsPayload,
  saveCategoryConfig,
  createCategory,
  getCachedCategoryConfig,
  getAllCategoryMeta,
  buildReportRowFromConfig,
} = require("./categoryConfig");
const { validateAssetPayload } = require("./validation");
const { resolveUniqueConflict } = require("./duplicateConflict");
const {
  createImportJob,
  getImportJobForUser,
  getLatestImportJob,
  processImportJob,
} = require("./importJobs");
const { listFilterableFields } = require("./assetFilters");
const { applyAssignmentCascade, findCommonFieldValues } = require("./assetCascade");
const maintenance = require("./maintenance");

const app = express();
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";
const MIN_PASSWORD_LENGTH = 8;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validatePasswordStrength(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

app.post("/api/auth/login", async (req, res) => {
  const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const { username, password } = parsed.data;

  try {
    const result = await query(
      "SELECT id, username, password_hash, role, is_active FROM users WHERE lower(username) = lower($1)",
      [username]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    if (user.is_active === false) {
      return res.status(403).json({ message: "This account is deactivated. Contact an admin." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: normalizeRole(user.role),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login failed." });
  }
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Current and new password are required." });
  }

  const { currentPassword, newPassword } = parsed.data;
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    return res.status(400).json({ message: strengthError });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: "New password must differ from the current password." });
  }

  try {
    const result = await query(
      "SELECT id, username, password_hash FROM users WHERE id = $1",
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [hash, user.id]
    );

    await insertAuditLog(null, {
      assetId: null,
      action: "user.password_change",
      user: req.user,
      before: null,
      after: { userId: user.id, username: user.username },
    });

    return res.json({ message: "Password updated." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to change password." });
  }
});

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, username, role, is_active, created_at, updated_at
       FROM users
       ORDER BY username ASC`
    );
    return res.json({ users: result.rows.map(mapUserRow) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load users." });
  }
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    username: z.string().trim().min(2).max(64),
    password: z.string().min(1),
    role: z.enum([ROLES.ADMIN, ROLES.OPERATOR]).default(ROLES.OPERATOR),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Username, password, and role are required." });
  }

  const username = parsed.data.username.trim();
  const { password, role } = parsed.data;
  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    return res.status(400).json({ message: strengthError });
  }

  try {
    const existing = await query(
      "SELECT id FROM users WHERE lower(username) = lower($1)",
      [username]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const hash = await bcrypt.hash(password, 10);
    const insertResult = await query(
      `INSERT INTO users (username, password_hash, role, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, username, role, is_active, created_at, updated_at`,
      [username, hash, role]
    );

    const created = mapUserRow(insertResult.rows[0]);
    await insertAuditLog(null, {
      assetId: null,
      action: "user.create",
      user: req.user,
      before: null,
      after: created,
    });

    return res.status(201).json({ user: created });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: "Username already exists." });
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to register user." });
  }
});

app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  const schema = z
    .object({
      role: z.enum([ROLES.ADMIN, ROLES.OPERATOR]).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => data.role !== undefined || data.isActive !== undefined, {
      message: "Nothing to update.",
    });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid payload." });
  }

  try {
    const existingResult = await query(
      "SELECT id, username, role, is_active, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ message: "User not found." });
    }

    const nextRole = parsed.data.role ?? normalizeRole(existing.role);
    const nextActive =
      parsed.data.isActive !== undefined ? parsed.data.isActive : existing.is_active !== false;

    if (id === Number(req.user.sub) && nextActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }

    if (
      id === Number(req.user.sub) &&
      normalizeRole(existing.role) === ROLES.ADMIN &&
      nextRole !== ROLES.ADMIN
    ) {
      return res.status(400).json({ message: "You cannot demote your own admin account." });
    }

    if (normalizeRole(existing.role) === ROLES.ADMIN && (nextRole !== ROLES.ADMIN || nextActive === false)) {
      const adminCount = await query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE AND id <> $1",
        [id]
      );
      if ((adminCount.rows[0]?.count || 0) < 1) {
        return res.status(400).json({
          message:
            nextActive === false
              ? "Cannot deactivate the last active admin."
              : "Cannot demote the last active admin.",
        });
      }
    }

    const updateResult = await query(
      `UPDATE users
       SET role = $1,
           is_active = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, username, role, is_active, created_at, updated_at`,
      [nextRole, nextActive, id]
    );

    const before = mapUserRow(existing);
    const after = mapUserRow(updateResult.rows[0]);
    await insertAuditLog(null, {
      assetId: null,
      action: "user.update",
      user: req.user,
      before,
      after,
    });

    return res.json({ user: after });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update user." });
  }
});

app.post("/api/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  const schema = z.object({
    newPassword: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "New password is required." });
  }

  const strengthError = validatePasswordStrength(parsed.data.newPassword);
  if (strengthError) {
    return res.status(400).json({ message: strengthError });
  }

  try {
    const existingResult = await query(
      "SELECT id, username FROM users WHERE id = $1",
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ message: "User not found." });
    }

    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    await query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [hash, id]
    );

    await insertAuditLog(null, {
      assetId: null,
      action: "user.password_reset",
      user: req.user,
      before: null,
      after: { userId: existing.id, username: existing.username },
    });

    return res.json({ message: "Password reset." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to reset password." });
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  if (id === Number(req.user.sub)) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }

  try {
    const existingResult = await query(
      "SELECT id, username, role, is_active, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ message: "User not found." });
    }

    if (normalizeRole(existing.role) === ROLES.ADMIN && existing.is_active !== false) {
      const adminCount = await query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE AND id <> $1",
        [id]
      );
      if ((adminCount.rows[0]?.count || 0) < 1) {
        return res.status(400).json({ message: "Cannot delete the last active admin." });
      }
    }

    const before = mapUserRow(existing);

    await withTransaction(async (client) => {
      await client.query("UPDATE assets SET created_by = NULL WHERE created_by = $1", [id]);
      await client.query("UPDATE assets SET updated_by = NULL WHERE updated_by = $1", [id]);
      await client.query("UPDATE audit_logs SET actor_id = NULL WHERE actor_id = $1", [id]);
      await client.query(
        "UPDATE category_field_configs SET updated_by = NULL WHERE updated_by = $1",
        [id]
      );
      await client.query("DELETE FROM users WHERE id = $1", [id]);
    });

    await insertAuditLog(null, {
      assetId: null,
      action: "user.delete",
      user: req.user,
      before,
      after: null,
    });

    return res.json({ message: "User deleted." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete user." });
  }
});

app.get("/api/categories", requireAuth, async (_req, res) => {
  try {
    const categories = await loadAllCategoryConfigsForApi();
    res.json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load categories." });
  }
});

app.get("/api/settings/category-fields", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const categories = await loadSettingsPayload();
    res.json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load category field settings." });
  }
});

app.put("/api/settings/category-fields/:code", requireAuth, requireAdmin, async (req, res) => {
  const { code } = req.params;
  try {
    const result = await saveCategoryConfig(code, req.body, req.user.sub);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.json({ config: result.config });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to save category field settings." });
  }
});

app.post("/api/settings/categories", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await createCategory(
      { code: req.body?.code, label: req.body?.label },
      req.user.sub
    );
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.status(201).json({ category: result.category });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create category." });
  }
});

app.get("/api/assets/filter-fields", requireAuth, async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : null;
    res.json({ fields: listFilterableFields(category) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load filter fields." });
  }
});

function parseJsonField(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  return JSON.parse(value);
}

function mapAssetRow(row) {
  return {
    id: row.id,
    category: row.category,
    location: row.location,
    office: row.office,
    model: row.model,
    assetNo: row.asset_no,
    serialNo: row.serial_no,
    status: row.status,
    details: parseJsonField(row.details_json) || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertAuditLog(clientOrNull, { assetId, action, user, before, after }) {
  const runner = clientOrNull
    ? (text, params) => clientOrNull.query(text, params)
    : query;

  await runner(
    `INSERT INTO audit_logs (
      asset_id,
      action,
      actor_id,
      actor_username,
      before_json,
      after_json
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      assetId,
      action,
      user.sub,
      user.username,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ]
  );
}

async function getFilteredAssets(queryParams) {
  const { category, status, search } = queryParams;
  const where = [];
  const params = [];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  if (search) {
    const pattern = `%${search}%`;
    const start = params.length + 1;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    where.push(
      `(asset_no ILIKE $${start}
        OR serial_no ILIKE $${start + 1}
        OR model ILIKE $${start + 2}
        OR office ILIKE $${start + 3}
        OR location ILIKE $${start + 4}
        OR status ILIKE $${start + 5}
        OR EXISTS (
          SELECT 1
          FROM jsonb_each_text(details_json) AS detail_entry
          WHERE detail_entry.value ILIKE $${start + 6}
        ))`
    );
  }

  const sql = `
    SELECT *
    FROM assets
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC, id DESC
  `;

  const result = await query(sql, params);
  return result.rows.map(mapAssetRow);
}

function getCategoryAssets(assets, categoryCode) {
  return assets.filter((asset) => asset.category === categoryCode);
}

function buildReportColumns(asset) {
  const config = getCachedCategoryConfig(asset.category);
  return buildReportRowFromConfig(asset, config);
}

const RISK_PRIORITY = {
  "antivirus-expired": 1,
  "missing-antivirus": 2,
  "antivirus-expiring": 3,
  "outdated-os": 4,
};

function getHighestPriorityRisk(asset, outdatedWindows) {
  const antivirusInstalled = asset.details.antivirusInstalled === true;
  const days = Number(asset.details.remainingSubscriptionDays);
  const outdatedOs = outdatedWindows.includes(asset.details.osInstalled);

  if (antivirusInstalled && Number.isFinite(days) && days <= 0) {
    return "antivirus-expired";
  }

  if (!antivirusInstalled) {
    return "missing-antivirus";
  }

  if (Number.isFinite(days) && days > 0 && days <= 30) {
    return "antivirus-expiring";
  }

  if (outdatedOs) {
    return "outdated-os";
  }

  return null;
}

function buildSmartInsights(assets) {
  const computerAssets = assets.filter((asset) => asset.category === CATEGORY_CODES.COMPUTER);
  const outdatedWindows = ["Windows 7", "Windows 8", "Windows 8.1"];

  const missingAntivirus = computerAssets.filter((asset) => asset.details.antivirusInstalled !== true);
  const antivirusExpired = computerAssets.filter((asset) => {
    if (asset.details.antivirusInstalled !== true) {
      return false;
    }

    const days = Number(asset.details.remainingSubscriptionDays);
    return Number.isFinite(days) && days <= 0;
  });
  const antivirusExpiringSoon = computerAssets.filter((asset) => {
    if (asset.details.antivirusInstalled !== true) {
      return false;
    }

    const days = Number(asset.details.remainingSubscriptionDays);
    return Number.isFinite(days) && days > 0 && days <= 30;
  });

  const outdatedOsComputers = computerAssets.filter((asset) =>
    outdatedWindows.includes(asset.details.osInstalled)
  );

  const assetsByCategory = assets.reduce((accumulator, asset) => {
    const meta = getAllCategoryMeta();
    const label =
      meta[asset.category]?.label || CATEGORY_CONFIG[asset.category]?.label || asset.category;
    accumulator[label] = (accumulator[label] || 0) + 1;
    return accumulator;
  }, {});

  const recommendations = [];

  if (antivirusExpired.length > 0) {
    recommendations.push(`Renew expired antivirus subscriptions for ${antivirusExpired.length} computer(s).`);
  }

  if (missingAntivirus.length > 0) {
    recommendations.push(`Install antivirus on ${missingAntivirus.length} computer(s).`);
  }

  if (antivirusExpiringSoon.length > 0) {
    recommendations.push(
      `Renew antivirus subscriptions for ${antivirusExpiringSoon.length} computer(s) within 30 days.`
    );
  }

  if (outdatedOsComputers.length > 0) {
    recommendations.push(
      `Upgrade ${outdatedOsComputers.length} computer(s) running Windows 7/8/8.1.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("No immediate risk alerts. Inventory data looks healthy.");
  }

  const riskAssets = computerAssets
    .map((asset) => {
      const risk = getHighestPriorityRisk(asset, outdatedWindows);
      if (!risk) {
        return null;
      }

      return {
        id: asset.id,
        category: getAllCategoryMeta()[asset.category]?.label || CATEGORY_CONFIG[asset.category]?.label || asset.category,
        model: asset.model,
        assetNo: asset.assetNo,
        serialNo: asset.serialNo,
        status: asset.status,
        osInstalled: asset.details.osInstalled || null,
        remainingSubscriptionDays: asset.details.remainingSubscriptionDays ?? null,
        antivirusInstalled: asset.details.antivirusInstalled,
        risk,
        priority: RISK_PRIORITY[risk],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      const aDays = Number(a.remainingSubscriptionDays);
      const bDays = Number(b.remainingSubscriptionDays);
      const aHasDays = Number.isFinite(aDays);
      const bHasDays = Number.isFinite(bDays);

      if (aHasDays && bHasDays) {
        return aDays - bDays;
      }
      if (aHasDays) return -1;
      if (bHasDays) return 1;
      return a.id - b.id;
    });

  return {
    totals: {
      assets: assets.length,
      computers: computerAssets.length,
      missingAntivirus: missingAntivirus.length,
      antivirusExpired: antivirusExpired.length,
      antivirusExpiringSoon: antivirusExpiringSoon.length,
      outdatedOsComputers: outdatedOsComputers.length,
    },
    assetsByCategory,
    riskAssets,
    recommendations,
  };
}

app.get("/api/assets", requireAuth, async (req, res) => {
  try {
    const rows = await getFilteredAssets(req.query);
    res.json({ assets: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load assets." });
  }
});

app.get("/api/insights", requireAuth, async (req, res) => {
  try {
    const assets = await getFilteredAssets(req.query);
    res.json(buildSmartInsights(assets));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load insights." });
  }
});

app.get("/api/reports/assets.xlsx", requireAuth, async (req, res) => {
  try {
    const assets = await getFilteredAssets(req.query);
    const workbook = new ExcelJS.Workbook();
    const meta = getAllCategoryMeta();
    const categories = Object.keys(meta).length > 0 ? Object.keys(meta) : Object.values(CATEGORY_CODES);

    categories.forEach((categoryCode) => {
      const categoryAssets = getCategoryAssets(assets, categoryCode);
      if (categoryAssets.length === 0) {
        return;
      }

      const worksheet = workbook.addWorksheet(
        meta[categoryCode]?.label || CATEGORY_CONFIG[categoryCode]?.label || categoryCode
      );
      const sampleRow = buildReportColumns(categoryAssets[0]);
      const columns = Object.keys(sampleRow).map((key) => ({ header: key, key, width: 20 }));

      worksheet.columns = columns;
      worksheet.addRow(Object.keys(sampleRow).reduce((accumulator, key) => {
        accumulator[key] = key;
        return accumulator;
      }, {}));

      categoryAssets.forEach((asset) => {
        worksheet.addRow(buildReportColumns(asset));
      });
    });

    if (workbook.worksheets.length === 0) {
      const worksheet = workbook.addWorksheet("Assets");
      worksheet.addRow({ Notice: "No assets matched the current filters." });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=asset-report.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate Excel report." });
    }
  }
});

app.get("/api/reports/assets.pdf", requireAuth, async (req, res) => {
  try {
    const assets = await getFilteredAssets(req.query);
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=asset-report.pdf");
    doc.pipe(res);

    doc.rect(40, 40, 515, 28).fill("#1e4620");
    doc.fillColor("#ffffff").fontSize(16).text("ICT Asset Report", 50, 47, { align: "left" });
    doc.fillColor("#5c4033");
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#555").text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);

    const groupedAssets = Object.values(CATEGORY_CODES).map((categoryCode) => ({
      categoryCode,
      items: getCategoryAssets(assets, categoryCode),
    })).filter((group) => group.items.length > 0);

    groupedAssets.forEach(({ categoryCode, items }) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.rect(40, doc.y, 515, 18).fill("#1e4620");
      doc.fillColor("#ffffff").fontSize(12).text(CATEGORY_CONFIG[categoryCode]?.label || categoryCode, 48, doc.y + 4);
      doc.fillColor("#5c4033");
      doc.moveDown(1);

      items.forEach((asset) => {
        if (doc.y > 740) {
          doc.addPage();
        }

        const row = buildReportColumns(asset);
        Object.entries(row).forEach(([key, value]) => {
          doc.fontSize(9).fillColor("#5c4033").text(`${key}: ${String(value)}`);
        });
        doc.moveDown(0.6);
      });
    });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate PDF report." });
    }
  }
});

app.post("/api/assets", requireAuth, async (req, res) => {
  const result = validateAssetPayload(req.body);
  if (!result.valid) {
    return res.status(400).json({ message: "Validation failed.", errors: result.errors });
  }

  const asset = result.data;

  try {
    const insertResult = await query(
      `INSERT INTO assets (
        category,
        location,
        office,
        model,
        asset_no,
        serial_no,
        status,
        details_json,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
      RETURNING *`,
      [
        asset.category,
        asset.location || null,
        asset.office || null,
        asset.model || null,
        asset.assetNo || null,
        asset.serialNo || null,
        asset.status,
        JSON.stringify(asset.details || {}),
        req.user.sub,
        req.user.sub,
      ]
    );

    const mapped = mapAssetRow(insertResult.rows[0]);
    await insertAuditLog(null, {
      assetId: mapped.id,
      action: "create",
      user: req.user,
      before: null,
      after: mapped,
    });
    return res.status(201).json({ asset: mapped });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const body = await resolveUniqueConflict(error, asset);
      return res.status(409).json(body);
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to create asset." });
  }
});

app.put("/api/assets/:id", requireAuth, requireAdminForEdit, async (req, res) => {
  const id = Number(req.params.id);
  let asset = null;

  try {
    const existingResult = await query("SELECT * FROM assets WHERE id = $1", [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ message: "Asset not found." });
    }

    const result = validateAssetPayload(req.body);
    if (!result.valid) {
      return res.status(400).json({ message: "Validation failed.", errors: result.errors });
    }

    const before = mapAssetRow(existing);
    asset = result.data;
    const cascade = applyAssignmentCascade(before, asset);
    asset = {
      ...asset,
      office: cascade.office,
      details: cascade.details,
    };

    const updateResult = await query(
      `UPDATE assets
       SET category = $1,
           location = $2,
           office = $3,
           model = $4,
           asset_no = $5,
           serial_no = $6,
           status = $7,
           details_json = $8::jsonb,
           updated_by = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        asset.category,
        asset.location || null,
        asset.office || null,
        asset.model || null,
        asset.assetNo || null,
        asset.serialNo || null,
        asset.status,
        JSON.stringify(asset.details || {}),
        req.user.sub,
        id,
      ]
    );

    const after = mapAssetRow(updateResult.rows[0]);
    await insertAuditLog(null, {
      assetId: id,
      action: "update",
      user: req.user,
      before,
      after,
    });

    return res.json({ asset: after, warnings: cascade.warnings });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const body = await resolveUniqueConflict(error, asset, { excludeId: id });
      return res.status(409).json(body);
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to update asset." });
  }
});

app.post("/api/assets/bulk-delete", requireAuth, requireAdminForEdit, async (req, res) => {
  const schema = z.object({ ids: z.array(z.number().int().positive()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Provide at least one asset id." });
  }

  try {
    const deleted = [];
    await withTransaction(async (client) => {
      for (const id of parsed.data.ids) {
        const existingResult = await client.query("SELECT * FROM assets WHERE id = $1", [id]);
        const existing = existingResult.rows[0];
        if (!existing) continue;
        await client.query("DELETE FROM assets WHERE id = $1", [id]);
        await insertAuditLog(client, {
          assetId: id,
          action: "delete",
          user: req.user,
          before: mapAssetRow(existing),
          after: null,
        });
        deleted.push(id);
      }
    });
    return res.json({ deleted: deleted.length, ids: deleted });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to bulk delete assets." });
  }
});

app.post("/api/assets/bulk-common", requireAuth, requireAdminForEdit, async (req, res) => {
  const schema = z.object({ ids: z.array(z.number().int().positive()).min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Select at least two assets." });
  }

  try {
    const result = await query(
      `SELECT * FROM assets WHERE id = ANY($1::int[])`,
      [parsed.data.ids]
    );
    if (result.rows.length < 2) {
      return res.status(400).json({ message: "Select at least two existing assets." });
    }
    const assets = result.rows.map(mapAssetRow);
    const categories = new Set(assets.map((asset) => asset.category));
    if (categories.size > 1) {
      return res.status(400).json({ message: "Bulk edit requires assets in the same category." });
    }
    return res.json(findCommonFieldValues(assets));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to compute common fields." });
  }
});

app.post("/api/assets/bulk-edit", requireAuth, requireAdminForEdit, async (req, res) => {
  const schema = z.object({
    ids: z.array(z.number().int().positive()).min(1),
    fields: z
      .object({
        location: z.string().optional().nullable(),
        office: z.string().optional().nullable(),
        model: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        details: z.record(z.unknown()).optional(),
      })
      .strict(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid bulk edit payload." });
  }

  const { ids, fields } = parsed.data;
  if (Object.prototype.hasOwnProperty.call(fields, "assetNo") || Object.prototype.hasOwnProperty.call(fields, "serialNo")) {
    return res.status(400).json({ message: "Unique identity fields cannot be bulk-edited." });
  }

  try {
    const updated = [];
    await withTransaction(async (client) => {
      for (const id of ids) {
        const existingResult = await client.query("SELECT * FROM assets WHERE id = $1", [id]);
        const existing = existingResult.rows[0];
        if (!existing) continue;
        const before = mapAssetRow(existing);
        const nextDetails = {
          ...(before.details || {}),
          ...(fields.details || {}),
        };
        const next = {
          category: before.category,
          location: fields.location !== undefined ? fields.location : before.location,
          office: fields.office !== undefined ? fields.office : before.office,
          model: fields.model !== undefined ? fields.model : before.model,
          assetNo: before.assetNo,
          serialNo: before.serialNo,
          status: fields.status !== undefined ? fields.status : before.status,
          details: nextDetails,
        };

        const updateResult = await client.query(
          `UPDATE assets
           SET location = $1, office = $2, model = $3, status = $4,
               details_json = $5::jsonb, updated_by = $6, updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING *`,
          [
            next.location || null,
            next.office || null,
            next.model || null,
            next.status,
            JSON.stringify(next.details || {}),
            req.user.sub,
            id,
          ]
        );
        const after = mapAssetRow(updateResult.rows[0]);
        await insertAuditLog(client, {
          assetId: id,
          action: "bulk_update",
          user: req.user,
          before,
          after,
        });
        updated.push(after);
      }
    });
    return res.json({ updated: updated.length, assets: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to bulk edit assets." });
  }
});

app.delete("/api/assets/:id", requireAuth, requireAdminForEdit, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const existingResult = await query("SELECT * FROM assets WHERE id = $1", [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ message: "Asset not found." });
    }

    await query("DELETE FROM assets WHERE id = $1", [id]);
    await insertAuditLog(null, {
      assetId: id,
      action: "delete",
      user: req.user,
      before: mapAssetRow(existing),
      after: null,
    });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete asset." });
  }
});

app.post("/api/assets/import", requireAuth, async (req, res) => {
  const importSchema = z.object({
    category: z.string().min(1),
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
  });

  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid import payload." });
  }

  const { category, rows } = parsed.data;
  const meta = getAllCategoryMeta();
  if (!CATEGORY_CONFIG[category] && !meta[category] && !getCachedCategoryConfig(category)) {
    return res.status(400).json({ message: `Unknown category '${category}'.` });
  }

  try {
    const job = await createImportJob({
      category,
      userId: req.user.sub,
      totalRows: rows.length,
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      progressPercent: job.progressPercent,
      totals: job.totals,
    });

    setImmediate(() => {
      processImportJob(job.id, { category, rows, user: req.user }).catch((error) => {
        console.error("Import job failed:", job.id, error);
      });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || "Failed to start import." });
  }
});

app.get("/api/import-jobs/latest", requireAuth, async (req, res) => {
  try {
    const job = await getLatestImportJob(req.user.sub);
    return res.json({ job });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load import job." });
  }
});

app.get("/api/import-jobs/:id", requireAuth, async (req, res) => {
  try {
    const job = await getImportJobForUser(Number(req.params.id), req.user.sub);
    if (!job) {
      return res.status(404).json({ message: "Import job not found." });
    }
    return res.json({ job });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load import job." });
  }
});

app.get("/api/maintenance/assets", requireAuth, async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const category = req.query.category || undefined;
    const cadence = maintenance.normalizeCadence(req.query.cadence || "quarterly");
    const assets = await maintenance.listMaintenanceAssets({ year, category, cadence });
    return res.json({
      assets,
      year: year || maintenance.currentCalendarYear(),
      cadence,
      currentQuarter: maintenance.currentCalendarQuarter(),
      currentMonth: maintenance.currentCalendarMonth(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load maintenance assets." });
  }
});

app.get("/api/maintenance/templates", requireAuth, async (_req, res) => {
  try {
    const templates = await maintenance.listTemplates();
    return res.json({ templates });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load maintenance templates." });
  }
});

app.put(
  "/api/settings/maintenance-checklists/:cadence/:category",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const template = await maintenance.saveTemplate(
        req.params.cadence,
        req.params.category,
        { name: req.body?.name, items: req.body?.items },
        req.user.sub
      );
      return res.json({ template });
    } catch (error) {
      console.error(error);
      return res.status(400).json({
        message: error.message || "Failed to save maintenance checklist.",
      });
    }
  }
);

// Back-compat: treat bare category as quarterly.
app.put("/api/settings/maintenance-checklists/:category", requireAuth, requireAdmin, async (req, res) => {
  try {
    const cadence = maintenance.normalizeCadence(req.body?.cadence || "quarterly");
    const template = await maintenance.saveTemplate(
      cadence,
      req.params.category,
      { name: req.body?.name, items: req.body?.items },
      req.user.sub
    );
    return res.json({ template });
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      message: error.message || "Failed to save maintenance checklist.",
    });
  }
});

app.get("/api/maintenance/assets/:assetId", requireAuth, async (req, res) => {
  try {
    const assetId = Number(req.params.assetId);
    const year = req.query.year ? Number(req.query.year) : maintenance.currentCalendarYear();
    const cadence = maintenance.normalizeCadence(req.query.cadence || "quarterly");
    const quarter = req.query.quarter
      ? Number(req.query.quarter)
      : maintenance.currentCalendarQuarter();
    const month = req.query.month
      ? Number(req.query.month)
      : maintenance.currentCalendarMonth();
    const record = await maintenance.ensureRecord(
      assetId,
      { year, cadence, quarter, month },
      req.user.sub
    );
    if (!record) {
      return res.status(404).json({ message: "Asset not found." });
    }
    const assetResult = await query("SELECT * FROM assets WHERE id = $1", [assetId]);
    const asset = assetResult.rows[0] ? mapAssetRow(assetResult.rows[0]) : null;
    return res.json({ record, asset });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || "Failed to open maintenance record." });
  }
});

app.put("/api/maintenance/records/:id", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const record = await maintenance.updateRecord(
      Number(req.params.id),
      {
        items: body.items,
        hardwareType: body.hardwareType,
        hardwarePart: body.hardwarePart,
        hardwareReports: body.hardwareReports,
        hardwareDescription: body.hardwareDescription,
        softwareType: body.softwareType,
        softwarePrograms: body.softwarePrograms,
        softwareReports: body.softwareReports,
        softwareDescription: body.softwareDescription,
        solution: body.solution,
        preparedBy: body.preparedBy,
        doneBy: body.doneBy,
      },
      req.user.sub
    );
    if (!record) {
      return res.status(404).json({ message: "Maintenance record not found." });
    }
    return res.json({ record });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update maintenance record." });
  }
});

app.get("/api/maintenance/assets/:assetId/report", requireAuth, async (req, res) => {
  try {
    const assetId = Number(req.params.assetId);
    const year = req.query.year ? Number(req.query.year) : maintenance.currentCalendarYear();
    const cadence = maintenance.normalizeCadence(req.query.cadence || "quarterly");
    const quarter = req.query.quarter
      ? Number(req.query.quarter)
      : maintenance.currentCalendarQuarter();
    const month = req.query.month
      ? Number(req.query.month)
      : maintenance.currentCalendarMonth();
    const report = await maintenance.buildMaintenanceReport(assetId, {
      year,
      cadence,
      quarter,
      month,
    });
    if (!report) {
      return res.status(404).json({
        message: "Maintenance report not found. Save and complete the form first.",
      });
    }
    if (report.status !== "complete") {
      return res.status(400).json({
        message: "Report is available only when maintenance status is complete.",
      });
    }

    const format = String(req.query.format || "pdf").toLowerCase();
    if (format === "json") {
      return res.json({ report });
    }

    const periodLabel =
      cadence === "monthly" ? `M${report.month}-${report.year}` : `Q${report.quarter}-${report.year}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="change-request-${assetId}-${periodLabel}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    let y = doc.page.margins.top;

    function drawSectionBar(title) {
      doc.save();
      doc.rect(left, y, pageWidth, 18).fill("#d0d0d0");
      doc.fillColor("#000").fontSize(10).font("Helvetica-Bold");
      doc.text(title, left + 6, y + 4, { width: pageWidth - 12 });
      doc.restore();
      y += 22;
      doc.font("Helvetica").fontSize(10).fillColor("#000");
    }

    function drawField(label, value, options = {}) {
      const height = options.height || 18;
      doc.fontSize(9).fillColor("#333").text(label, left, y);
      const labelWidth = options.labelWidth || 120;
      const boxX = left + labelWidth;
      const boxW = pageWidth - labelWidth;
      doc.rect(boxX, y - 2, boxW, height).stroke("#666");
      doc.fillColor("#000").fontSize(10).text(String(value || ""), boxX + 4, y + 2, {
        width: boxW - 8,
        height: height - 4,
      });
      y += height + 6;
    }

    const completedDate = report.completedAt
      ? new Date(report.completedAt).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    doc.fontSize(9).fillColor("#444").text("PAD/IT/QR₁", left, y, { align: "left" });
    doc.text("CONFIDENTIAL", left, y, { width: pageWidth, align: "right" });
    y += 16;
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#000")
      .text("CHANGE REQUEST FORM FOR HARDWARE AND SOFTWARE", left, y, {
        width: pageWidth,
        align: "center",
      });
    y += 28;
    doc.font("Helvetica");

    drawField("Prepared by", report.preparedBy || report.doneBy || "");
    drawField("Date", completedDate);

    drawSectionBar("CONTACT");
    drawField("Name", report.asset.contactName || report.asset.assignedRoom || "");
    drawField("Unit / Department", report.asset.office || "");
    drawField(
      "Equipment",
      [
        report.asset.categoryLabel || report.asset.category,
        report.asset.model,
        report.asset.assetNo ? `No. ${report.asset.assetNo}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );

    drawSectionBar("HARDWARE PROBLEM");
    drawField("Type / Model", report.hardwareType || "");
    drawField("Part", report.hardwarePart || "");
    drawField("Reports", report.hardwareReports || "");
    drawField("Description of errors", report.hardwareDescription || "", { height: 48 });

    drawSectionBar("SOFTWARE PROBLEM");
    drawField("Type / Model", report.softwareType || "");
    drawField("Programs", report.softwarePrograms || "");
    drawField("Reports", report.softwareReports || "");
    drawField("Description of errors", report.softwareDescription || "", { height: 48 });

    drawSectionBar("SOLUTION");
    drawField("Solution", report.solution, { height: 64, labelWidth: 70 });

    drawSectionBar("DONE BY");
    drawField("Done by", report.doneBy);
    drawField("Signature", "", { height: 28 });

    drawSectionBar("STATUS");
    const completed = report.status === "complete";
    doc.fontSize(10).fillColor("#000");
    doc.text(`${completed ? "[X]" : "[ ]"} Completed`, left + 8, y);
    doc.text(`${completed ? "[ ]" : "[X]"} Referred`, left + 140, y);
    y += 24;

    doc.fontSize(8).fillColor("#666")
      .text(
        `Period: ${cadence === "monthly" ? `Month ${report.month}` : `Quarter ${report.quarter}`} ${report.year}`,
        left,
        y
      );

    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to generate maintenance report." });
  }
});

app.get("/api/assets/:id/audit", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await query(
      `SELECT id, action, actor_username, before_json, after_json, created_at
       FROM audit_logs
       WHERE asset_id = $1
       ORDER BY id DESC`,
      [id]
    );

    const logs = result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorUsername: row.actor_username,
      before: parseJsonField(row.before_json),
      after: parseJsonField(row.after_json),
      createdAt: row.created_at,
    }));

    res.json({ logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load audit logs." });
  }
});

if (isProduction) {
  const webDist = path.join(__dirname, "..", "..", "web", "dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      if (req.path.startsWith("/api")) {
        return next();
      }
      return res.sendFile(path.join(webDist, "index.html"));
    });
  }
}

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ message: "Internal server error." });
});

async function start() {
  await initDb();
  const host = process.env.HOST || (isProduction ? "0.0.0.0" : undefined);
  const onListen = () => {
    const bind = host || "localhost";
    console.log(`Asset tracker API running on ${bind}:${port}`);
    if (isProduction) {
      console.log(`Office LAN: open http://<this-pc-lan-ip>:${port} on other devices`);
    }
  };
  if (host) {
    app.listen(port, host, onListen);
  } else {
    app.listen(port, onListen);
  }
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
