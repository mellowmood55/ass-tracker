import { useEffect } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { FileUp, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertsList } from "@/components/insights/AlertsList";
import { InsightCardGrid } from "@/components/insights/InsightCardGrid";
import { RecommendationsList } from "@/components/insights/RecommendationsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInsights } from "@/hooks/useInsights";
import { EMPTY_FILTERS } from "@/lib/constants";

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { insights, loading: insightsLoading, reload: reloadInsights } = useInsights(EMPTY_FILTERS);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void reloadInsights();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [reloadInsights]);

  if (editId) {
    return <Navigate to={`/entry?edit=${editId}`} replace />;
  }

  const riskCount = insights?.riskAssets?.length ?? 0;

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        title="Dashboard"
        description="Priority alerts and inventory health at a glance."
      />

      <Card className="overflow-hidden border-primary/15 shadow-sm shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Smart Insights
          </CardTitle>
          <CardDescription>
            {riskCount > 0
              ? `${riskCount} computer(s) need attention — tap an alert to open the action list.`
              : "No urgent computer risks right now."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InsightCardGrid insights={insights} loading={insightsLoading} />
          <RecommendationsList recommendations={insights?.recommendations} loading={insightsLoading} />
          <AlertsList riskAssets={insights?.riskAssets} loading={insightsLoading} limit={5} />
        </CardContent>
      </Card>

      <Card className="border-dashed border-primary/30 bg-gradient-to-br from-accent/80 via-card to-secondary/40 transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Import spreadsheet</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Upload CSV or Excel, map columns, and bulk-add assets in a few taps.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/import">Open Import</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
