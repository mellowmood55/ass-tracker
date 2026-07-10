const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { z } = require("zod");

const { db, initDb } = require("./db");
const { signToken, requireAuth } = require("./auth");
const { CATEGORY_CODES, CATEGORY_CONFIG, STATUS_BY_CATEGORY, normalizeImportRow } = require("./catalog");
const { validateAssetPayload, collectBlankRequiredFields } = require("./validation");

initDb();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", (req, res) => {
  const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const { username, password } = parsed.data;
  const user = db
    .prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?")
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
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
    details: JSON.parse(row.details_json || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function insertAuditLog({ assetId, action, user, before, after }) {
  db.prepare(
    `INSERT INTO audit_logs (
      asset_id,
      action,
      actor_id,
      actor_username,
      before_json,
      after_json
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    assetId,
    action,
    user.sub,
    user.username,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null
  );
}

function getFilteredAssets(query) {
  const { category, status, search } = query;
  const where = [];
  const params = [];

  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  if (status) {
    where.push("status = ?");
    params.push(status);
  }

  if (search) {
    where.push("(asset_no LIKE ? OR serial_no LIKE ? OR model LIKE ? OR office LIKE ? OR location LIKE ?)");
    for (let i = 0; i < 5; i += 1) {
      params.push(`%${search}%`);
    }
  }

  const sql = `
    SELECT *
    FROM assets
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC, id DESC
  `;

  return db.prepare(sql).all(...params).map(mapAssetRow);
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

  if (missingAntivirus.length > 0) {
    recommendations.push(`Install antivirus on ${missingAntivirus.length} computer(s).`);
  }

  if (antivirusExpired.length > 0) {
    recommendations.push(`Renew expired antivirus subscriptions for ${antivirusExpired.length} computer(s).`);
  }

  if (outdatedOsComputers.length > 0) {
    recommendations.push(
      `Upgrade ${outdatedOsComputers.length} computer(s) running Windows 7/8/8.1.`
    );
  }

  if (antivirusExpiringSoon.length > 0) {
    recommendations.push(
      `Renew antivirus subscriptions for ${antivirusExpiringSoon.length} computer(s) within 30 days.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("No immediate risk alerts. Inventory data looks healthy.");
  }

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
    riskAssets: [...missingAntivirus, ...antivirusExpired, ...antivirusExpiringSoon, ...outdatedOsComputers].map((asset) => ({
      id: asset.id,
      category: CATEGORY_CONFIG[asset.category]?.label || asset.category,
      model: asset.model,
      assetNo: asset.assetNo,
      serialNo: asset.serialNo,
      status: asset.status,
      osInstalled: asset.details.osInstalled || null,
      remainingSubscriptionDays: asset.details.remainingSubscriptionDays ?? null,
      antivirusInstalled: asset.details.antivirusInstalled,
    })),
    recommendations,
  };
}

app.get("/api/assets", requireAuth, (req, res) => {
  const rows = getFilteredAssets(req.query);
  res.json({ assets: rows });
});

app.get("/api/insights", requireAuth, (req, res) => {
  const assets = getFilteredAssets(req.query);
  res.json(buildSmartInsights(assets));
});

app.get("/api/reports/assets.xlsx", requireAuth, async (req, res) => {
  const assets = getFilteredAssets(req.query);
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
});

app.get("/api/reports/assets.pdf", requireAuth, (req, res) => {
  const assets = getFilteredAssets(req.query);
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
});

app.post("/api/assets", requireAuth, (req, res) => {
  const result = validateAssetPayload(req.body);
  if (!result.valid) {
    return res.status(400).json({ message: "Validation failed.", errors: result.errors });
  }

  const asset = result.data;

  try {
    const insertResult = db
      .prepare(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        asset.category,
        asset.location || null,
        asset.office || null,
        asset.model || null,
        asset.assetNo || null,
        asset.serialNo || null,
        asset.status,
        JSON.stringify(asset.details || {}),
        req.user.sub,
        req.user.sub
      );

    const createdRow = db.prepare("SELECT * FROM assets WHERE id = ?").get(insertResult.lastInsertRowid);
    const mapped = mapAssetRow(createdRow);
    insertAuditLog({ assetId: mapped.id, action: "create", user: req.user, before: null, after: mapped });
    return res.status(201).json({ asset: mapped });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return res.status(409).json({ message: "Asset No or Serial No already exists." });
    }
    return res.status(500).json({ message: "Failed to create asset." });
  }
});

app.put("/api/assets/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ message: "Asset not found." });
  }

  const result = validateAssetPayload(req.body);
  if (!result.valid) {
    return res.status(400).json({ message: "Validation failed.", errors: result.errors });
  }

  const asset = result.data;

  try {
    db.prepare(
      `UPDATE assets
       SET category = ?,
           location = ?,
           office = ?,
           model = ?,
           asset_no = ?,
           serial_no = ?,
           status = ?,
           details_json = ?,
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      asset.category,
      asset.location || null,
      asset.office || null,
      asset.model || null,
      asset.assetNo || null,
      asset.serialNo || null,
      asset.status,
      JSON.stringify(asset.details || {}),
      req.user.sub,
      id
    );

    const updatedRow = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
    const before = mapAssetRow(existing);
    const after = mapAssetRow(updatedRow);
    insertAuditLog({ assetId: id, action: "update", user: req.user, before, after });

    return res.json({ asset: after });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return res.status(409).json({ message: "Asset No or Serial No already exists." });
    }
    return res.status(500).json({ message: "Failed to update asset." });
  }
});

app.delete("/api/assets/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ message: "Asset not found." });
  }

  try {
    db.prepare("DELETE FROM assets WHERE id = ?").run(id);
    insertAuditLog({ assetId: id, action: "delete", user: req.user, before: mapAssetRow(existing), after: null });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete asset." });
  }
});

app.post("/api/assets/import", requireAuth, (req, res) => {
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

  const findByAssetNo = db.prepare(
    `SELECT id, asset_no, serial_no FROM assets WHERE asset_no IS NOT NULL AND trim(asset_no) <> '' AND asset_no = ?`
  );
  const findBySerialNo = db.prepare(
    `SELECT id, asset_no, serial_no FROM assets WHERE serial_no IS NOT NULL AND trim(serial_no) <> '' AND serial_no = ?`
  );

  const insertAsset = db.prepare(
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const importTransaction = db.transaction((importRows) => {
    const created = [];
    const needsAttention = [];
    let skipped = 0;
    const seenAssetNos = new Set();
    const seenSerialNos = new Set();

    for (let index = 0; index < importRows.length; index += 1) {
      const row = normalizeImportRow(importRows[index], category);
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

      // Capture blanks before import validation applies provisional defaults (e.g. status).
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
          const existing = findByAssetNo.get(assetNo);
          if (existing) {
            duplicateFields.push("Asset No");
            existingId = existing.id;
          }
        }
      }

      if (serialNo) {
        if (seenSerialNos.has(serialNo)) {
          if (!duplicateFields.includes("Serial No")) {
            duplicateFields.push("Serial No");
          }
        } else {
          const existing = findBySerialNo.get(serialNo);
          if (existing) {
            if (!duplicateFields.includes("Serial No")) {
              duplicateFields.push("Serial No");
            }
            if (existingId == null) {
              existingId = existing.id;
            }
          }
        }
      }

      if (duplicateFields.length > 0) {
        skipped += 1;
        needsAttention.push({
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

      const insertResult = insertAsset.run(
        asset.category,
        asset.location || null,
        asset.office || null,
        asset.model || null,
        assetNo,
        serialNo,
        asset.status,
        JSON.stringify(asset.details || {}),
        req.user.sub,
        req.user.sub
      );

      const createdRow = db.prepare("SELECT * FROM assets WHERE id = ?").get(insertResult.lastInsertRowid);
      const mapped = mapAssetRow(createdRow);
      insertAuditLog({ assetId: mapped.id, action: "create", user: req.user, before: null, after: mapped });
      created.push(mapped);

      if (blankFields.length > 0) {
        needsAttention.push({
          row: index + 1,
          reason: "blank",
          id: mapped.id,
          assetNo: mapped.assetNo || null,
          serialNo: mapped.serialNo || null,
          blankFields,
        });
      }
    }

    return { created, needsAttention, skipped };
  });

  try {
    const { created, needsAttention, skipped } = importTransaction(rows);
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

app.get("/api/assets/:id/audit", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const logs = db
    .prepare(
      `SELECT id, action, actor_username, before_json, after_json, created_at
       FROM audit_logs
       WHERE asset_id = ?
       ORDER BY id DESC`
    )
    .all(id)
    .map((row) => ({
      id: row.id,
      action: row.action,
      actorUsername: row.actor_username,
      before: row.before_json ? JSON.parse(row.before_json) : null,
      after: row.after_json ? JSON.parse(row.after_json) : null,
      createdAt: row.created_at,
    }));

  res.json({ logs });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ message: "Internal server error." });
});

app.listen(port, () => {
  console.log(`Asset tracker API running on port ${port}`);
});
