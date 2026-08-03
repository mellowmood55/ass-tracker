import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

const UNIQUE_FIELDS = new Set(["assetNo", "serialNo"]);

export function BulkEditDialog({ open, onOpenChange, category, selectedIds, onApplied }) {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [common, setCommon] = useState({});
  const [draft, setDraft] = useState({});
  const [mixed, setMixed] = useState([]);

  const editableShared = useMemo(() => {
    const fields = (category?.sharedFields || []).filter(
      (field) => !UNIQUE_FIELDS.has(field.name) && Object.prototype.hasOwnProperty.call(common, field.name)
    );
    return fields;
  }, [category, common]);

  const editableDetails = useMemo(() => {
    const details = common.details || {};
    return (category?.detailFields || []).filter(
      (field) => !UNIQUE_FIELDS.has(field.name) && Object.prototype.hasOwnProperty.call(details, field.name)
    );
  }, [category, common]);

  useEffect(() => {
    if (!open || selectedIds.length < 2) return;
    let cancelled = false;
    async function loadCommon() {
      setLoading(true);
      try {
        const data = await api(
          "/api/assets/bulk-common",
          { method: "POST", body: JSON.stringify({ ids: selectedIds }) },
          auth.token
        );
        if (cancelled) return;
        setCommon(data.common || {});
        setMixed(data.mixed || []);
        setDraft({
          ...(data.common || {}),
          details: { ...(data.common?.details || {}) },
        });
      } catch (err) {
        toast.error(err.message);
        onOpenChange(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCommon();
    return () => {
      cancelled = true;
    };
  }, [open, selectedIds, auth.token, onOpenChange]);

  async function handleApply() {
    setSaving(true);
    try {
      const fields = {};
      for (const field of editableShared) {
        if (Object.prototype.hasOwnProperty.call(draft, field.name)) {
          fields[field.name] = draft[field.name];
        }
      }
      const detailPatch = {};
      for (const field of editableDetails) {
        if (Object.prototype.hasOwnProperty.call(draft.details || {}, field.name)) {
          detailPatch[field.name] = draft.details[field.name];
        }
      }
      if (Object.keys(detailPatch).length > 0) {
        fields.details = detailPatch;
      }

      const result = await api(
        "/api/assets/bulk-edit",
        { method: "POST", body: JSON.stringify({ ids: selectedIds, fields }) },
        auth.token
      );
      toast.success(`Updated ${result.updated} asset(s).`);
      onApplied?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk edit</DialogTitle>
          <DialogDescription>
            Edit fields that share the same value across {selectedIds.length} selected assets.
            Asset No and Serial No stay unique and cannot be changed here.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="space-y-4">
            {editableShared.length === 0 && editableDetails.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No common field values to edit. Mixed fields: {mixed.join(", ") || "none"}.
              </p>
            )}
            {editableShared.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`bulk-${field.name}`}>{field.label}</Label>
                <Input
                  id={`bulk-${field.name}`}
                  value={draft[field.name] ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
              </div>
            ))}
            {editableDetails.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`bulk-detail-${field.name}`}>{field.label}</Label>
                <Input
                  id={`bulk-detail-${field.name}`}
                  value={draft.details?.[field.name] ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      details: { ...(current.details || {}), [field.name]: event.target.value },
                    }))
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Unique fields (Asset No, Serial No) are preserved for each row.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={saving || loading || (editableShared.length === 0 && editableDetails.length === 0)}
          >
            {saving && <Spinner className="mr-2" />}
            Apply to selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
