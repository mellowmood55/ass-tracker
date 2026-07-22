import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", description: "Warm parchment surfaces", icon: Sun },
  { value: "dark", label: "Dark", description: "Warm charcoal forest theme", icon: Moon },
  { value: "system", label: "System", description: "Follow device preference", icon: Monitor },
];

export function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        eyebrow="Settings"
        title="Appearance"
        description="Choose light, dark, or match your device. Dark mode keeps the same brand language."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription>
            Preference is saved on this device and applied across the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-border bg-card hover:bg-accent/50"
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <Label className="cursor-pointer text-sm font-semibold">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
