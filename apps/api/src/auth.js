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

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: normalizeRole(user.role),
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      ...payload,
      role: normalizeRole(payload.role),
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

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
  signToken,
  requireAuth,
  requireAdmin,
  requireAdminForEdit,
};
