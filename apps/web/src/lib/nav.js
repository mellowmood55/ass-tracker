import { ArrowRightLeft, FileUp, LayoutDashboard, Package, PenSquare, Settings, Wrench } from "lucide-react";

export const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, end: true },
  { to: "/entry", label: "Entry", shortLabel: "Entry", icon: PenSquare },
  { to: "/import", label: "Import", shortLabel: "Import", icon: FileUp },
  { to: "/assets", label: "Assets", shortLabel: "Assets", icon: Package },
  { to: "/move-asset", label: "Move Asset", shortLabel: "Move", icon: ArrowRightLeft },
  { to: "/maintenance", label: "Maintenance", shortLabel: "Maint.", icon: Wrench },
  { to: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];
