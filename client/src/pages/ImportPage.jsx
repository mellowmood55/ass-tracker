import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
import { useDataRefresh } from "@/context/DataRefreshContext";
import { useCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";

export function ImportPage() {
  const navigate = useNavigate();
  const { bump } = useDataRefresh();
  const { categories, loading } = useCategories();

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        eyebrow="Bulk upload"
        title="Import Data"
        description="Upload CSV or Excel, review column mapping, then import."
      />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ImportWizard
          categories={categories}
          onImported={() => bump("import-done")}
          onFinished={() => navigate("/assets")}
        />
      )}
    </div>
  );
}
