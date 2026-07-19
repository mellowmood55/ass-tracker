const jwt = require("jsonwebtoken");

const PLACEHOLDER_SECRETS = new Set([
  "change-this-secret-in-production",
  "replace-with-a-long-random-secret",
]);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || PLACEHOLDER_SECRETS.has(secret.trim())) {
    throw new Error(
      "JWT_SECRET is required and must be set to a private, non-placeholder value."
    );
  }

  return secret;
}

const JWT_SECRET = getJwtSecret();

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
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
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = {
  signToken,
  requireAuth,
};
