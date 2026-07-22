export const ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
};

export function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return value === ROLES.ADMIN ? ROLES.ADMIN : ROLES.OPERATOR;
}

export function isAdmin(userOrRole) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  return normalizeRole(role) === ROLES.ADMIN;
}

export function canEditAssets(userOrRole) {
  return isAdmin(userOrRole);
}

export function canManageUsers(userOrRole) {
  return isAdmin(userOrRole);
}

export function canEditCategoryFields(userOrRole) {
  return isAdmin(userOrRole);
}
