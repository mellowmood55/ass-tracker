import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetForm } from "@/components/assets/AssetForm";
import { useDataRefresh } from "@/context/DataRefreshContext";
import { useCategories } from "@/hooks/useCategories";
import { useAssets } from "@/hooks/useAssets";
import { formStateFromAsset, makeInitialFormState } from "@/lib/assetColumns";
import { EMPTY_FILTERS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

export function EntryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const returnTo = searchParams.get("returnTo");
  const { bump } = useDataRefresh();

  const { categories, loading: categoriesLoading } = useCategories();
  const { assets, loading: assetsLoading } = useAssets(EMPTY_FILTERS);

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

  function handleCategoryChange(code) {
    setManualCategory(code);
    if (editId) {
      setSearchParams(returnTo ? { returnTo } : {});
    }
  }

  function handleSaved() {
    bump("asset-saved");
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (editId) {
      navigate("/assets");
      return;
    }
    setManualCategory(null);
  }

  function handleCancelEdit() {
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    setSearchParams({});
    setManualCategory(null);
  }

  const loading = categoriesLoading || (Boolean(editId) && assetsLoading);

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        title={editingId ? `Edit Asset #${editingId}` : "Add Asset"}
        description={
          editingId
            ? "Update details, then save — lists refresh automatically."
            : "Register one asset at a time. Use Import for bulk uploads."
        }
      />

      {loading || !selectedCategory || !initialFormState ? (
        <Skeleton className="h-80 w-full" />
      ) : (
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
  );
}
