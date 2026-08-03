import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CategoryFieldEditor } from "@/components/settings/CategoryFieldEditor";
import { FieldLayoutPreview } from "@/components/settings/FieldLayoutPreview";
import { FloatingFieldActions } from "@/components/settings/FloatingFieldActions";
import { useCategoryFieldSettings } from "@/hooks/useCategoryFieldSettings";
import { useDataRefresh } from "@/context/DataRefreshContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cloneConfig, getAllFieldNames, labelToFieldName } from "@/lib/fieldConfig";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EditCategoryFieldsPage() {
  const { auth } = useAuth();
  const { categories, loading, error, saveCategory, reload } = useCategoryFieldSettings();
  const { bump } = useDataRefresh();
  const [selectedCode, setSelectedCode] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [draftOverrides, setDraftOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [scrollToFieldName, setScrollToFieldName] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);

  const effectiveCode = selectedCode || categories[0]?.code || "";
  const activeCategory = useMemo(
    () => categories.find((entry) => entry.code === effectiveCode),
    [categories, effectiveCode]
  );

  const draftConfig = draftOverrides[effectiveCode] ?? (activeCategory ? cloneConfig(activeCategory.config) : null);

  function updateDraftConfig(config) {
    setDraftOverrides((current) => ({ ...current, [effectiveCode]: config }));
  }

  function resetDraft() {
    setDraftOverrides((current) => {
      const next = { ...current };
      delete next[effectiveCode];
      return next;
    });
  }

  function addField(scope = "detail") {
    if (!draftConfig) return;
    const existingNames = getAllFieldNames(draftConfig);
    const label = "New Field";
    const name = labelToFieldName(label, existingNames);
    const field = { name, label, type: "text", required: false, locked: false, aliases: [] };
    if (scope === "shared") {
      updateDraftConfig({ ...draftConfig, sharedFields: [...(draftConfig.sharedFields || []), field] });
    } else {
      updateDraftConfig({ ...draftConfig, detailFields: [...(draftConfig.detailFields || []), field] });
    }
    setScrollToFieldName(name);
  }

  useEffect(() => {
    if (!scrollToFieldName) return;

    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`field-row-${scrollToFieldName}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const timeout = window.setTimeout(() => setScrollToFieldName(null), 1500);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [scrollToFieldName, draftConfig]);

  function addGroup(scope = "detail") {
    if (!draftConfig) return;
    const id = `${scope}Group${Date.now()}`;
    updateDraftConfig({
      ...draftConfig,
      groups: [...(draftConfig.groups || []), { id, label: "New Group", scope }],
    });
  }

  async function handleSave() {
    if (!activeCategory || !draftConfig) return;
    setSaving(true);
    try {
      await saveCategory(activeCategory.code, draftConfig);
      setDraftOverrides((current) => {
        const next = { ...current };
        delete next[effectiveCode];
        return next;
      });
      bump("category-fields-updated");
      toast.success(`${activeCategory.label} fields updated.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory() {
    setAdding(true);
    try {
      const data = await api(
        "/api/settings/categories",
        {
          method: "POST",
          body: JSON.stringify({
            label: newLabel.trim(),
            code: newCode.trim() || undefined,
          }),
        },
        auth.token
      );
      toast.success(`Added category ${data.category.label}.`);
      setAddOpen(false);
      setNewLabel("");
      setNewCode("");
      await reload();
      bump("category-added");
      setSelectedCode(data.category.code);
      setEditMode(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  if (loading && categories.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div id="category-fields-actions" className="sticky top-0 z-20 rounded-xl border bg-card/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {editMode ? "Editing category fields" : "Viewing category fields"}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
              Add category
            </Button>
            <Button type="button" variant="outline" onClick={resetDraft} disabled={!draftConfig}>
              Reset
            </Button>
          </div>
        </div>
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {draftConfig && activeCategory && (
        <FieldLayoutPreview
          config={draftConfig}
          categoryLabel={activeCategory.label}
          onFieldClick={(name) => {
            setEditMode(true);
            setScrollToFieldName(name);
          }}
        />
      )}

      <div className="md:hidden">
        <Label className="mb-2 block">Category</Label>
        <Select value={effectiveCode} onValueChange={setSelectedCode}>
          <SelectTrigger>
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
        {draftConfig && activeCategory && (
          <div className="mt-4">
            <CategoryFieldEditor
              category={activeCategory}
              config={draftConfig}
              editMode={editMode}
              onChange={updateDraftConfig}
              scrollToFieldName={scrollToFieldName}
            />
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Tabs value={effectiveCode} onValueChange={setSelectedCode}>
          <TabsList>
            {categories.map((category) => (
              <TabsTrigger key={category.code} value={category.code}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((category) => (
            <TabsContent key={category.code} value={category.code}>
              {draftConfig && effectiveCode === category.code && (
                <CategoryFieldEditor
                  category={category}
                  config={draftConfig}
                  editMode={editMode}
                  onChange={updateDraftConfig}
                  scrollToFieldName={scrollToFieldName}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <FloatingFieldActions
        editMode={editMode}
        onEditModeChange={setEditMode}
        disabled={!draftConfig}
        saving={saving}
        onSave={handleSave}
        onAddField={() => addField("detail")}
        onAddGroup={() => addGroup("detail")}
        onScrollToTop={() => {
          const target = document.getElementById("category-fields-actions");
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>
              Create a category such as VoIP / IP phones, then edit its fields like the existing ones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-category-label">Label</Label>
              <Input
                id="new-category-label"
                value={newLabel}
                placeholder="e.g. VoIP / IP phones"
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-category-code">Code (optional)</Label>
              <Input
                id="new-category-code"
                value={newCode}
                placeholder="e.g. voip"
                onChange={(event) => setNewCode(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddCategory} disabled={adding || !newLabel.trim()}>
              {adding && <Spinner className="mr-2" />}
              Add category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
