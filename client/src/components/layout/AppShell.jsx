import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";

export function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border/70 bg-card/70 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              ICT Asset Tracker
            </p>
            <p className="text-sm font-bold text-primary">Stay on top of risk</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
