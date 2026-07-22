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

async function findUserById(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id)) {
    return null;
  }

  const { query } = require("./db");
  const result = await query(
    "SELECT id, username, role, is_active FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

function isActiveUser(user) {
  return user?.is_active !== false && user?.isActive !== false;
}

function createRequireAuth({ findCurrentUser = findUserById } = {}) {
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

    try {
      const currentUser = await findCurrentUser(payload.sub);
      if (!currentUser) {
        return res.status(401).json({ message: "Invalid or expired token." });
      }

      if (!isActiveUser(currentUser)) {
        return res.status(403).json({ message: "This account is deactivated. Contact an admin." });
      }

      req.user = {
        sub: currentUser.id,
        username: currentUser.username,
        role: normalizeRole(currentUser.role),
      };
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Authentication failed." });
    }
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
  signToken,
  createRequireAuth,
  findUserById,
  requireAuth,
  requireAdmin,
  requireAdminForEdit,
};
