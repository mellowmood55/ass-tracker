import { NavLink } from "react-router-dom";
import { LogOut, Monitor } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PRIMARY_NAV } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate, riskCount = 0 }) {
  const { auth, logout } = useAuth();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Monitor className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            ICT
          </p>
          <p className="text-sm font-bold text-primary">Asset Tracker</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
        {PRIMARY_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="flex-1">{label}</span>
            {to === "/" && riskCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  "bg-destructive text-white"
                )}
              >
                {riskCount > 99 ? "99+" : riskCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator />

      <div className="p-3">
        <div className="mb-3 rounded-xl border border-border/70 bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-semibold text-foreground">{auth.user?.username}</p>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
