import { NavLink } from "react-router-dom";
import { PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileTabBar({ riskCount = 0 }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(30,70,32,0.08)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <ul className="grid h-16 grid-cols-4">
        {PRIMARY_NAV.map(({ to, shortLabel, icon: Icon, end }) => (
          <li key={to} className="min-w-0">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold tracking-wide transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary transition-all duration-200",
                      isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                    )}
                  />
                  <span className="relative">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        isActive && "scale-110"
                      )}
                    />
                    {to === "/" && riskCount > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                        {riskCount > 99 ? "99+" : riskCount}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{shortLabel}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
