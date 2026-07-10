import { NavLink } from "react-router-dom";
import { LayoutDashboard, LogOut, Monitor, Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/assets", label: "Asset Browser", icon: Package },
];

export function Sidebar({ onNavigate }) {
  const { auth, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Monitor className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ICT</p>
          <p className="text-sm font-semibold text-primary">Asset Tracker</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Separator />

      <div className="p-3">
        <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium">{auth.user?.username}</p>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
