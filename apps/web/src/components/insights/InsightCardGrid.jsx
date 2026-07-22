import { useNavigate } from "react-router-dom";
import { Boxes, Monitor, Shield, ShieldAlert, ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const insightCards = [
  {
    key: "antivirusExpired",
    label: "Antivirus Expired",
    icon: ShieldAlert,
    risk: "antivirus-expired",
    variant: "destructive",
  },
  {
    key: "missingAntivirus",
    label: "Missing Antivirus",
    icon: ShieldX,
    risk: "missing-antivirus",
    variant: "warning",
  },
  {
    key: "antivirusExpiringSoon",
    label: "Expiring Soon",
    icon: Shield,
    risk: "antivirus-expiring",
    variant: "pulse",
  },
  {
    key: "outdatedOsComputers",
    label: "Outdated OS",
    icon: Monitor,
    risk: "outdated-os",
    variant: "warning",
  },
  {
    key: "assets",
    label: "Total Assets",
    icon: Boxes,
    risk: null,
    variant: "neutral",
  },
];

export function InsightCardGrid({ insights, loading }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const totals = insights?.totals || {};

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {insightCards.map(({ key, label, icon: Icon, risk, variant }, index) => {
        const value = totals[key] ?? 0;
        const clickable = Boolean(risk);

        return (
          <Card
            key={key}
            className={cn(
              "insight-card-enter border-border/70 shadow-sm transition-all duration-200",
              clickable && "cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.99]",
              variant === "pulse" && value > 0 && "alert-pulse border-destructive/50",
              variant === "destructive" && value > 0 && "border-destructive/40 bg-destructive/5",
              variant === "warning" && value > 0 && "border-amber-500/40 bg-amber-50/70",
              variant === "neutral" && "bg-primary text-primary-foreground border-primary"
            )}
            style={{ animationDelay: `${index * 45}ms` }}
            onClick={() => risk && navigate(`/assets?risk=${risk}`)}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={(event) => {
              if (clickable && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                navigate(`/assets?risk=${risk}`);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    variant === "neutral" ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    variant === "neutral" ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                />
              </div>
              <p
                className={cn(
                  "mt-2 text-3xl font-bold tracking-tight",
                  variant === "neutral" ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
