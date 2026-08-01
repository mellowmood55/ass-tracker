const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

const ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
};

const ALLOWED_ROLES = new Set([ROLES.ADMIN, ROLES.OPERATOR]);

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ALLOWED_ROLES.has(value) ? value : ROLES.OPERATOR;
}

function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

function normalizeSessionVersion(value) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: normalizeRole(user.role),
      sessionVersion: normalizeSessionVersion(user.session_version ?? user.sessionVersion),
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

async function verifyTokenSessionVersion(userId, tokenSessionVersion) {
  const { query } = require("./db");
  const result = await query("SELECT session_version FROM users WHERE id = $1", [userId]);
  const row = result.rows[0];
  if (!row) {
    return false;
  }
  return normalizeSessionVersion(row.session_version) === tokenSessionVersion;
}

function createRequireAuth({ verifySessionVersion = verifyTokenSessionVersion } = {}) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing bearer token." });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    const sessionVersion = normalizeSessionVersion(payload.sessionVersion);
    try {
      const isCurrentSession = await verifySessionVersion(userId, sessionVersion);
      if (!isCurrentSession) {
        return res.status(401).json({ message: "Session expired. Please sign in again." });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to verify session." });
    }

    req.user = {
      ...payload,
      sub: userId,
      role: normalizeRole(payload.role),
      sessionVersion,
    };
    return next();
  };
}

const requireAuth = createRequireAuth();

function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
}

function requireAdminForEdit(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ message: "Only admins can edit assets." });
  }
  return next();
}

module.exports = {
  ROLES,
  ALLOWED_ROLES,
  normalizeRole,
  isAdminRole,
  normalizeSessionVersion,
  signToken,
  createRequireAuth,
  requireAuth,
  requireAdmin,
  requireAdminForEdit,
};
