import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { useInsights } from "@/hooks/useInsights";
import { EMPTY_FILTERS } from "@/lib/constants";

export function AppShell() {
  const { insights } = useInsights(EMPTY_FILTERS);
  const riskCount = insights?.riskAssets?.length ?? 0;

  return (
    <div className="min-h-dvh md:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-dvh w-60 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:flex">
        <Sidebar riskCount={riskCount} />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-border/70 bg-card/70 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              ICT
            </p>
            <p className="text-sm font-bold text-primary">Asset Tracker</p>
          </div>
          {riskCount > 0 && (
            <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
              {riskCount} risk{riskCount === 1 ? "" : "s"}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileTabBar riskCount={riskCount} />
    </div>
  );
}
