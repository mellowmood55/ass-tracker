import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { LOCATION_OPTIONS } from "@/lib/importMapping";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function LocationFixForm({ assets, locationOptions, onSaved, onOpenChange }) {
  const { auth } = useAuth();
  const options = locationOptions?.length ? locationOptions : LOCATION_OPTIONS;
  const assetList = useMemo(() => assets || [], [assets]);

  const [selections, setSelections] = useState(() => {
    const initial = {};
    for (const asset of assetList) {
      initial[asset.id] = asset.location || "";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allSelected = assetList.every((asset) => Boolean(selections[asset.id]));

  function handleSelect(assetId, value) {
    setSelections((current) => ({ ...current, [assetId]: value }));
    setError("");
  }

  async function handleSave() {
    if (!allSelected) {
      setError("Select a location for every asset before saving.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await Promise.all(
        assetList.map((asset) => {
          const payload = {
            category: asset.category,
            location: selections[asset.id],
            office: asset.office || null,
            model: asset.model || null,
            assetNo: asset.assetNo || null,
            serialNo: asset.serialNo || null,
            status: asset.status,
            details: asset.details || {},
          };
          return api(
            `/api/assets/${asset.id}`,
            { method: "PUT", body: JSON.stringify(payload) },
            auth.token
          );
        })
      );
      toast.success(`Updated location for ${assetList.length} asset(s).`);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Alert>
        <AlertTitle>Location required</AlertTitle>
        <AlertDescription>
          Options: {options.join(", ")}. Assets were imported successfully; finish by assigning
          locations below.
        </AlertDescription>
      </Alert>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Asset No</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assetList.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell>{asset.id}</TableCell>
                <TableCell>{asset.assetNo || "—"}</TableCell>
                <TableCell>{asset.model || "—"}</TableCell>
                <TableCell className="min-w-[180px]">
                  <Select
                    value={selections[asset.id] || undefined}
                    onValueChange={(value) => handleSelect(asset.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Later
        </Button>
        <Button onClick={handleSave} disabled={saving || !allSelected}>
          {saving && <Spinner className="mr-2" />}
          Save locations
        </Button>
      </DialogFooter>
    </>
  );
}

export function LocationFixDialog({ open, onOpenChange, assets, locationOptions, onSaved }) {
  const assetList = assets || [];
  const formKey = assetList.map((asset) => asset.id).join("-") || "empty";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set missing locations</DialogTitle>
          <DialogDescription>
            {assetList.length} imported asset(s) need a Location. Choose one of the three floors for
            each row.
          </DialogDescription>
        </DialogHeader>

        {open && assetList.length > 0 && (
          <LocationFixForm
            key={formKey}
            assets={assetList}
            locationOptions={locationOptions}
            onSaved={onSaved}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
