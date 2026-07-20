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
const { signToken, requireAuth } = require("./auth");
const { CATEGORY_CODES, CATEGORY_CONFIG, STATUS_BY_CATEGORY, normalizeImportRow } = require("./catalog");
const { validateAssetPayload, collectBlankRequiredFields } = require("./validation");

const app = express();
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

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
      "SELECT id, username, password_hash, role FROM users WHERE username = $1",
      [username]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login failed." });
  }
});

app.get("/api/categories", requireAuth, (_req, res) => {
  const categories = Object.entries(CATEGORY_CONFIG).map(([code, config]) => ({
    code,
    label: config.label,
    statuses: STATUS_BY_CATEGORY[code],
    sharedFields: config.sharedFields,
    detailFields: config.detailFields,
  }));

  res.json({ categories });
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
    params.push(pattern, pattern, pattern, pattern, pattern);
    where.push(
      `(asset_no LIKE $${start} OR serial_no LIKE $${start + 1} OR model LIKE $${start + 2} OR office LIKE $${start + 3} OR location LIKE $${start + 4})`
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
  const details = asset.details || {};

  switch (asset.category) {
    case CATEGORY_CODES.COMPUTER:
      return {
        AssetNo: asset.assetNo || "",
        SerialNo: asset.serialNo || "",
        Location: asset.location || "",
        Office: asset.office || "",
        Model: asset.model || "",
        ComputerType: details.deviceType || "",
        OS: details.osInstalled || "",
        AntivirusStatus: details.antivirusInstalled ? "Installed" : "Missing",
        RemainingDays: details.remainingSubscriptionDays ?? "",
        Status: asset.status,
      };
    case CATEGORY_CODES.PRINTER:
      return {
        AssetNo: asset.assetNo || "",
        SerialNo: asset.serialNo || "",
        Location: asset.location || "",
        Office: asset.office || "",
        Model: asset.model || "",
        Status: asset.status,
      };
    case CATEGORY_CODES.SOFTWARE:
      return {
        Description: details.description || "",
        Function: details.function || "",
        Status: asset.status,
      };
    case CATEGORY_CODES.UPS:
      return {
        Office: asset.office || "",
        Model: asset.model || "",
        SerialNo: asset.serialNo || "",
        Status: asset.status,
      };
    case CATEGORY_CODES.NETWORK:
      return {
        Location: asset.location || "",
        Item: details.item || "",
        Model: asset.model || "",
        SerialNo: asset.serialNo || "",
        Status: asset.status,
      };
    case CATEGORY_CODES.MOBILE:
      return {
        Office: asset.office || "",
        Model: asset.model || "",
        AssetNo: asset.assetNo || "",
        Status: asset.status,
      };
    case CATEGORY_CODES.OTHER:
    default:
      return {
        Office: asset.office || "",
        Item: details.item || "",
        Model: asset.model || "",
        AssetNo: asset.assetNo || "",
        SerialNo: asset.serialNo || "",
        Status: asset.status,
      };
  }
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
    const label = CATEGORY_CONFIG[asset.category]?.label || asset.category;
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
        category: CATEGORY_CONFIG[asset.category]?.label || asset.category,
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
    const categories = Object.values(CATEGORY_CODES);

    categories.forEach((categoryCode) => {
      const categoryAssets = getCategoryAssets(assets, categoryCode);
      if (categoryAssets.length === 0) {
        return;
      }

      const worksheet = workbook.addWorksheet(CATEGORY_CONFIG[categoryCode]?.label || categoryCode);
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
    const mapped = await withTransaction(async (client) => {
      const insertResult = await client.query(
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

      const created = mapAssetRow(insertResult.rows[0]);
      await insertAuditLog(client, {
        assetId: created.id,
        action: "create",
        user: req.user,
        before: null,
        after: created,
      });
      return created;
    });
    return res.status(201).json({ asset: mapped });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: "Asset No or Serial No already exists." });
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to create asset." });
  }
});

app.put("/api/assets/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = validateAssetPayload(req.body);
    if (!result.valid) {
      return res.status(400).json({ message: "Validation failed.", errors: result.errors });
    }

    const asset = result.data;

    const after = await withTransaction(async (client) => {
      const existingResult = await client.query("SELECT * FROM assets WHERE id = $1 FOR UPDATE", [id]);
      const existing = existingResult.rows[0];
      if (!existing) {
        return null;
      }

      const updateResult = await client.query(
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

      const before = mapAssetRow(existing);
      const updated = mapAssetRow(updateResult.rows[0]);
      await insertAuditLog(client, {
        assetId: id,
        action: "update",
        user: req.user,
        before,
        after: updated,
      });
      return updated;
    });

    if (!after) {
      return res.status(404).json({ message: "Asset not found." });
    }

    return res.json({ asset: after });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: "Asset No or Serial No already exists." });
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to update asset." });
  }
});

app.delete("/api/assets/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const deleted = await withTransaction(async (client) => {
      const existingResult = await client.query("SELECT * FROM assets WHERE id = $1 FOR UPDATE", [id]);
      const existing = existingResult.rows[0];

      if (!existing) {
        return false;
      }

      await client.query("DELETE FROM assets WHERE id = $1", [id]);
      await insertAuditLog(client, {
        assetId: id,
        action: "delete",
        user: req.user,
        before: mapAssetRow(existing),
        after: null,
      });
      return true;
    });

    if (!deleted) {
      return res.status(404).json({ message: "Asset not found." });
    }

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

  if (!CATEGORY_CONFIG[category]) {
    return res.status(400).json({ message: `Unknown category '${category}'.` });
  }

  try {
    const { created, needsAttention, skipped } = await withTransaction(async (client) => {
      const createdRows = [];
      const attention = [];
      let skippedCount = 0;
      const seenAssetNos = new Set();
      const seenSerialNos = new Set();

      for (let index = 0; index < rows.length; index += 1) {
        const row = normalizeImportRow(rows[index], category);
        const payload = {
          category,
          location: row.location || null,
          office: row.office || null,
          model: row.model || null,
          assetNo: row.assetNo || null,
          serialNo: row.serialNo || null,
          status: row.status,
          details: row.details || {},
        };

        const blankFields = collectBlankRequiredFields(payload);

        const result = validateAssetPayload(payload, { mode: "import", allowMissingLocation: true });
        if (!result.valid) {
          throw new Error(`Row ${index + 1}: ${result.errors.join(" ")}`);
        }

        const asset = result.data;
        const assetNo = asset.assetNo || null;
        const serialNo = asset.serialNo || null;
        const duplicateFields = [];
        let existingId = null;

        if (assetNo) {
          if (seenAssetNos.has(assetNo)) {
            duplicateFields.push("Asset No");
          } else {
            const existing = await client.query(
              `SELECT id, asset_no, serial_no FROM assets
               WHERE asset_no IS NOT NULL AND trim(asset_no) <> '' AND asset_no = $1`,
              [assetNo]
            );
            if (existing.rows[0]) {
              duplicateFields.push("Asset No");
              existingId = existing.rows[0].id;
            }
          }
        }

        if (serialNo) {
          if (seenSerialNos.has(serialNo)) {
            if (!duplicateFields.includes("Serial No")) {
              duplicateFields.push("Serial No");
            }
          } else {
            const existing = await client.query(
              `SELECT id, asset_no, serial_no FROM assets
               WHERE serial_no IS NOT NULL AND trim(serial_no) <> '' AND serial_no = $1`,
              [serialNo]
            );
            if (existing.rows[0]) {
              if (!duplicateFields.includes("Serial No")) {
                duplicateFields.push("Serial No");
              }
              if (existingId == null) {
                existingId = existing.rows[0].id;
              }
            }
          }
        }

        if (duplicateFields.length > 0) {
          skippedCount += 1;
          attention.push({
            row: index + 1,
            reason: "duplicate",
            id: existingId,
            assetNo,
            serialNo,
            blankFields: [],
            duplicateFields,
            existingId,
          });
          continue;
        }

        if (assetNo) seenAssetNos.add(assetNo);
        if (serialNo) seenSerialNos.add(serialNo);

        const insertResult = await client.query(
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
            assetNo,
            serialNo,
            asset.status,
            JSON.stringify(asset.details || {}),
            req.user.sub,
            req.user.sub,
          ]
        );

        const mapped = mapAssetRow(insertResult.rows[0]);
        await insertAuditLog(client, {
          assetId: mapped.id,
          action: "create",
          user: req.user,
          before: null,
          after: mapped,
        });
        createdRows.push(mapped);

        if (blankFields.length > 0) {
          attention.push({
            row: index + 1,
            reason: "blank",
            id: mapped.id,
            assetNo: mapped.assetNo || null,
            serialNo: mapped.serialNo || null,
            blankFields,
          });
        }
      }

      return { created: createdRows, needsAttention: attention, skipped: skippedCount };
    });

    return res.status(201).json({
      imported: created.length,
      skipped,
      assets: created,
      needsAttention,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Import failed. No rows were imported.",
    });
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
  app.listen(port, () => {
    console.log(`Asset tracker API running on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

module.exports = {
  app,
  start,
};
