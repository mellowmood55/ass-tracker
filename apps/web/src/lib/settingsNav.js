export const SETTINGS_NAV = [
  { to: "/settings/account", label: "Account", adminOnly: false },
  { to: "/settings/appearance", label: "Appearance", adminOnly: false },
  { to: "/settings/users", label: "Users", adminOnly: true },
  { to: "/settings/edit-category-fields", label: "Edit Category Fields", adminOnly: true },
];

export function getSettingsNavForRole(role) {
  const admin = String(role || "").toLowerCase() === "admin";
  return SETTINGS_NAV.filter((item) => !item.adminOnly || admin);
}

export function getDefaultSettingsPath(role) {
  return getSettingsNavForRole(role)[0]?.to || "/settings/account";
}
