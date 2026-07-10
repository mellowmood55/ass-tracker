import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { makeInitialFormState, payloadFromForm } from "@/lib/assetColumns";
import { DynamicField } from "@/components/assets/DynamicField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ImportModal } from "@/components/import/ImportModal";

export function AssetForm({
  categories,
  selectedCategory,
  onCategoryChange,
  editingId,
  initialFormState,
  onSaved,
  onCancelEdit,
}) {
  const { auth } = useAuth();
  const activeCategory = categories.find((category) => category.code === selectedCategory);
  const [formState, setFormState] = useState(
    () => initialFormState || makeInitialFormState(activeCategory)
  );
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  function handleFieldChange(fieldName, value) {
    setFormState((current) => ({ ...current, [fieldName]: value }));
  }

  function handleCategoryChange(code) {
    const category = categories.find((entry) => entry.code === code);
    onCategoryChange(code);
    setFormState(makeInitialFormState(category));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = payloadFromForm(formState, selectedCategory, activeCategory);
      if (editingId) {
        await api(`/api/assets/${editingId}`, { method: "PUT", body: JSON.stringify(payload) }, auth.token);
        toast.success("Asset updated successfully.");
      } else {
        await api("/api/assets", { method: "POST", body: JSON.stringify(payload) }, auth.token);
        toast.success("Asset created successfully.");
      }
      const category = categories.find((entry) => entry.code === selectedCategory);
      setFormState(makeInitialFormState(category));
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{editingId ? `Edit Asset #${editingId}` : "Add Asset"}</CardTitle>
            <CardDescription>
              {editingId
                ? "Update the asset details below and save your changes."
                : "Fill in the category-specific fields to register a new asset."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import Data
          </Button>
        </CardHeader>
        <CardContent>
          {editingId && (
            <Alert className="mb-4 border-primary/30 bg-accent/50">
              <AlertDescription>
                You are editing asset #{editingId}. Changes will be recorded in the audit trail.
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-4 space-y-2">
            <Label htmlFor="asset-category">Category</Label>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger id="asset-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.code} value={category.code}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-primary">Shared Fields</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeCategory?.sharedFields.map((field) => (
                  <DynamicField
                    key={field.name}
                    field={field}
                    value={formState[field.name]}
                    onChange={handleFieldChange}
                    selectedCategory={selectedCategory}
                    activeCategory={activeCategory}
                    formState={formState}
                  />
                ))}
              </div>
            </div>

            {activeCategory?.detailFields.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Category Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeCategory.detailFields.map((field) => (
                    <DynamicField
                      key={field.name}
                      field={field}
                      value={formState[field.name]}
                      onChange={handleFieldChange}
                      selectedCategory={selectedCategory}
                      activeCategory={activeCategory}
                      formState={formState}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-card pt-4">
              <Button type="submit" disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                {editingId ? "Update Asset" : "Save Asset"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={onCancelEdit}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={categories}
        onImported={onSaved}
      />
    </>
  );
}
