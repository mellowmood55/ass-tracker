import { useNavigate } from "react-router-dom";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRiskLabelFromKey, getRiskVariant } from "@/lib/assetColumns";
import { cn } from "@/lib/utils";

function formatAssetIdentity(asset) {
  const parts = [asset.assetNo, asset.model, asset.serialNo].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : `Asset #${asset.id}`;
}

function formatDaysHint(asset) {
  const days = Number(asset.remainingSubscriptionDays);
  if (!Number.isFinite(days)) {
    return null;
  }
  if (days <= 0) {
    return "Expired";
  }
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function AlertsList({ riskAssets, loading, limit = 5 }) {
  const navigate = useNavigate();

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  const items = riskAssets || [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        No priority alerts. All monitored computers look healthy.
      </div>
    );
  }

  const visible = items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Priority alerts
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {items.length} asset{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border/70 bg-card">
        {visible.map((asset) => {
          const label = getRiskLabelFromKey(asset.risk) || "At risk";
          const variant = getRiskVariant(label);
          const daysHint = formatDaysHint(asset);

          return (
            <li key={asset.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200",
                  "hover:bg-accent/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                onClick={() => navigate(`/assets?risk=${asset.risk}`)}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={variant}>{label}</Badge>
                    {daysHint && (
                      <span className="text-xs text-muted-foreground">{daysHint}</span>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {formatAssetIdentity(asset)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[asset.category, asset.status].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => navigate("/assets?risk=at-risk")}
        >
          View all {items.length} at-risk assets
        </Button>
      )}
    </div>
  );
}
