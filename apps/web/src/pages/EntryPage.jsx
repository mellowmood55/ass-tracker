import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetForm } from "@/components/assets/AssetForm";
import { useAuth } from "@/context/AuthContext";
import { useDataRefresh } from "@/context/DataRefreshContext";
import { useCategories } from "@/hooks/useCategories";
import { useAssets } from "@/hooks/useAssets";
import { formStateFromAsset, makeInitialFormState } from "@/lib/assetColumns";
import { EMPTY_FILTERS } from "@/lib/constants";
import { canEditAssets } from "@/lib/roles";
import { Skeleton } from "@/components/ui/skeleton";

export function EntryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const returnTo = searchParams.get("returnTo");
  const { auth } = useAuth();
  const { bump } = useDataRefresh();
  const canEdit = canEditAssets(auth.user);

  useEffect(() => {
    if (editId && !canEdit) {
      toast.error("Only admins can edit assets.");
      navigate(returnTo || "/assets", { replace: true });
    }
  }, [editId, canEdit, navigate, returnTo]);

  const { categories, loading: categoriesLoading } = useCategories();
  const { assets, loading: assetsLoading } = useAssets(EMPTY_FILTERS);

  const editAsset = useMemo(() => {
    if (!editId || !canEdit) return null;
    return assets.find((entry) => String(entry.id) === editId) || null;
  }, [editId, assets, canEdit]);

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

  const loading = categoriesLoading || (Boolean(editId) && canEdit && assetsLoading);
  const blockedEdit = Boolean(editId) && !canEdit;

  if (blockedEdit) {
    return <Skeleton className="h-80 w-full" />;
  }

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
