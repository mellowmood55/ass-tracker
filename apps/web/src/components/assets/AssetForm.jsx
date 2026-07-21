import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { makeInitialFormState, payloadFromForm } from "@/lib/assetColumns";
import { FieldSection } from "@/components/assets/FieldSection";
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

  function handleFieldChange(fieldName, value) {
    setFormState((current) => {
      const next = { ...current, [fieldName]: value };
      if (fieldName === "antivirusInstalled" && value !== true) {
        next.antivirusType = "";
        next.remainingSubscriptionDays = "";
      }
      return next;
    });
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
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>{editingId ? `Edit Asset #${editingId}` : "Add Asset"}</CardTitle>
        <CardDescription>
          {editingId
            ? "Update the asset details below and save your changes."
            : "Fill in the category-specific fields to register a new asset."}
        </CardDescription>
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
          <FieldSection
            title="Shared Fields"
            scope="shared"
            fields={activeCategory?.sharedFields || []}
            groups={activeCategory?.groups || []}
            formState={formState}
            onChange={handleFieldChange}
            selectedCategory={selectedCategory}
            activeCategory={activeCategory}
          />

          <FieldSection
            title="Category Details"
            scope="detail"
            fields={activeCategory?.detailFields || []}
            groups={activeCategory?.groups || []}
            formState={formState}
            onChange={handleFieldChange}
            selectedCategory={selectedCategory}
            activeCategory={activeCategory}
          />

          <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 border-t bg-card pt-4 md:bottom-0">
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
  );
}
