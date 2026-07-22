import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getSettingsNavForRole } from "@/lib/settingsNav";
import { cn } from "@/lib/utils";

export function SettingsHubPage() {
  const { auth } = useAuth();
  const settingsNav = useMemo(
    () => getSettingsNavForRole(auth.user?.role),
    [auth.user?.role]
  );

  return (
    <div className="space-y-4">
      {settingsNav.length > 1 && (
        <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="Settings">
          {settingsNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      <Outlet />
    </div>
  );
}
