import { NavLink, Outlet } from "react-router-dom";

import { SETTINGS_NAV } from "@/lib/settingsNav";

import { cn } from "@/lib/utils";



export function SettingsHubPage() {

  return (

    <div className="space-y-4">

      <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="Settings">

        {SETTINGS_NAV.map((item) => (

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



      <Outlet />

    </div>

  );

}


