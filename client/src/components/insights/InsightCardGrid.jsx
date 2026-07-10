import { useNavigate } from "react-router-dom";
import { AlertTriangle, Monitor, Shield, ShieldAlert, ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const insightCards = [
  {
    key: "missingAntivirus",
    label: "Missing Antivirus",
    icon: ShieldX,
    risk: "missing-antivirus",
    variant: "warning",
  },
  {
    key: "antivirusExpired",
    label: "Antivirus Expired",
    icon: ShieldAlert,
    risk: "antivirus-expired",
    variant: "destructive",
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
    icon: AlertTriangle,
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {insightCards.map(({ key, label, icon: Icon, risk, variant }) => {
        const value = totals[key] ?? 0;
        const clickable = Boolean(risk);

        return (
          <Card
            key={key}
            className={cn(
              "transition-all",
              clickable && "cursor-pointer hover:border-primary hover:shadow-md",
              variant === "pulse" && value > 0 && "alert-pulse border-destructive/50",
              variant === "destructive" && value > 0 && "border-destructive/30 bg-destructive/5",
              variant === "warning" && value > 0 && "border-amber-300/50 bg-amber-50/50"
            )}
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
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
