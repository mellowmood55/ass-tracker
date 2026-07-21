import { useEffect, useState } from "react";

import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ChevronDown, LogOut, Monitor, Settings } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

import { PRIMARY_NAV } from "@/lib/nav";

import { SETTINGS_NAV } from "@/lib/settingsNav";

import { Button } from "@/components/ui/button";

import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/utils";



const SETTINGS_PATH = "/settings";



export function Sidebar({ onNavigate, riskCount = 0 }) {

  const { auth, logout } = useAuth();

  const location = useLocation();

  const navigate = useNavigate();

  const isSettingsRoute = location.pathname.startsWith(SETTINGS_PATH);

  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute);



  useEffect(() => {

    if (isSettingsRoute) {

      setSettingsOpen(true);

    }

  }, [isSettingsRoute]);



  const isAdmin = auth.user?.role === "admin";
  const settingsItem = isAdmin ? PRIMARY_NAV.find((item) => item.to === SETTINGS_PATH) : null;
  const mainNavItems = PRIMARY_NAV.filter((item) => item.to !== SETTINGS_PATH);



  function toggleSettings() {

    setSettingsOpen((current) => {

      const next = !current;

      if (next && !isSettingsRoute) {

        navigate(SETTINGS_NAV[0]?.to || SETTINGS_PATH);

      }

      return next;

    });

  }



  return (

    <div className="flex h-dvh flex-col bg-sidebar">

      <div className="shrink-0">

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

      </div>



      <Separator className="shrink-0" />



      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">

        {mainNavItems.map(({ to, label, icon: Icon, end }) => (

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



        {settingsItem && (

          <div className="space-y-1">

            <button

              type="button"

              onClick={toggleSettings}

              className={cn(

                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",

                isSettingsRoute

                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"

                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"

              )}

            >

              <settingsItem.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />

              <span className="flex-1 text-left">{settingsItem.label}</span>

              <ChevronDown

                className={cn(

                  "h-4 w-4 shrink-0 transition-transform duration-200",

                  settingsOpen && "rotate-180"

                )}

              />

            </button>



            {settingsOpen && (

              <div className="ml-4 space-y-1 border-l border-border/60 pl-2">

                {SETTINGS_NAV.map((item) => (

                  <NavLink

                    key={item.to}

                    to={item.to}

                    onClick={onNavigate}

                    className={({ isActive }) =>

                      cn(

                        "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",

                        isActive

                          ? "bg-primary/15 text-primary"

                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"

                      )

                    }

                  >

                    {item.label}

                  </NavLink>

                ))}

              </div>

            )}

          </div>

        )}

      </nav>



      <Separator className="shrink-0" />



      <div className="shrink-0 p-3">

        <div className="mb-3 rounded-xl border border-border/70 bg-muted/50 px-3 py-2">

          <div className="flex items-start justify-between gap-2">

            <div className="min-w-0">

              <p className="text-xs text-muted-foreground">Signed in as</p>

              <p className="truncate text-sm font-semibold text-foreground">{auth.user?.username}</p>

            </div>

            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Settings"
                onClick={toggleSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}

          </div>

        </div>

        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>

          <LogOut className="h-4 w-4" />

          Logout

        </Button>

      </div>

    </div>

  );

}


