import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetForm } from "@/components/assets/AssetForm";
import { InsightCardGrid } from "@/components/insights/InsightCardGrid";
import { RecommendationsList } from "@/components/insights/RecommendationsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategories } from "@/hooks/useCategories";
import { useInsights } from "@/hooks/useInsights";
import { useAssets } from "@/hooks/useAssets";
import { formStateFromAsset, makeInitialFormState } from "@/lib/assetColumns";
import { EMPTY_FILTERS } from "@/lib/constants";

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const { categories, loading: categoriesLoading } = useCategories();
  const { insights, loading: insightsLoading, reload: reloadInsights } = useInsights(EMPTY_FILTERS);
  const { assets, reload: reloadAssets } = useAssets(EMPTY_FILTERS);

  const editAsset = useMemo(() => {
    if (!editId) return null;
    return assets.find((entry) => String(entry.id) === editId) || null;
  }, [editId, assets]);

  const defaultCategory = categories[0]?.code || "";
  const [manualCategory, setManualCategory] = useState(null);

  const selectedCategory = editAsset?.category || manualCategory || defaultCategory;

  const activeCategory = categories.find((entry) => entry.code === selectedCategory);

  const initialFormState = useMemo(() => {
    if (editAsset && activeCategory) {
      return formStateFromAsset(editAsset, activeCategory);
    }
    if (activeCategory) {
      return makeInitialFormState(activeCategory);
    }
    return null;
  }, [editAsset, activeCategory]);

  const editingId = editAsset?.id || null;
  const formKey = editAsset ? `edit-${editAsset.id}` : `new-${selectedCategory}`;

  const breadcrumb = editingId ? `Dashboard > Edit Asset #${editingId}` : null;

  function handleCategoryChange(code) {
    setManualCategory(code);
    if (editId) {
      setSearchParams({});
    }
  }

  function handleSaved() {
    reloadAssets();
    reloadInsights();
    if (editId) {
      setSearchParams({});
      setManualCategory(null);
    }
  }

  function handleCancelEdit() {
    setSearchParams({});
    setManualCategory(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="ICT Asset Tracker"
        title="Dashboard"
        description={breadcrumb || "Smart insights and asset entry in one place."}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Smart Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InsightCardGrid insights={insights} loading={insightsLoading} />
            <RecommendationsList recommendations={insights?.recommendations} loading={insightsLoading} />
          </CardContent>
        </Card>

        <div id="asset-form">
          {!categoriesLoading && selectedCategory && initialFormState && (
            <AssetForm
              key={formKey}
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
              editingId={editingId}
              initialFormState={initialFormState}
              onSaved={handleSaved}
              onCancelEdit={handleCancelEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
