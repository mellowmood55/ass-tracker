import { FileUp, LayoutDashboard, Package, PenSquare } from "lucide-react";

export const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, end: true },
  { to: "/entry", label: "Entry", shortLabel: "Entry", icon: PenSquare },
  { to: "/import", label: "Import", shortLabel: "Import", icon: FileUp },
  { to: "/assets", label: "Assets", shortLabel: "Assets", icon: Package },
];
