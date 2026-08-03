import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useAssets } from "@/hooks/useAssets";
import { useCategories } from "@/hooks/useCategories";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import { canEditAssets } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const LOCATION_OPTIONS = ["9TH Floor (A)", "9th floor (B)", "10th floor"];

const EMPTY_MOVE = {
  location: "",
  office: "",
  assignedRoom: "",
};

export function MoveAssetPage() {
  const { auth } = useAuth();
  const canEdit = canEditAssets(auth.user);
  const { categories } = useCategories();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_MOVE);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const { assets, loading, reload } = useAssets({
    category: category === "all" ? "" : category,
    search: debouncedSearch,
  });

  const selected = useMemo(
    () => assets.find((asset) => asset.id === selectedId) || null,
    [assets, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setForm(EMPTY_MOVE);
      return;
    }
    setForm({
      location: selected.location || "",
      office: selected.office || "",
      assignedRoom: selected.details?.assignedRoom || "",
    });
  }, [selected]);

  function selectAsset(asset) {
    setSelectedId(asset.id);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!selected || !canEdit) return;

    setSaving(true);
    try {
      const payload = {
        category: selected.category,
        location: form.location || null,
        office: form.office || null,
        model: selected.model,
        assetNo: selected.assetNo,
        serialNo: selected.serialNo,
        status: selected.status,
        details: {
          ...(selected.details || {}),
          assignedRoom: form.assignedRoom || "",
        },
      };

      const result = await api(
        `/api/assets/${selected.id}`,
        { method: "PUT", body: JSON.stringify(payload) },
        auth.token
      );

      toast.success("Asset moved successfully.");
      for (const warning of result.warnings || []) {
        toast.message(warning);
      }
      await reload();
    } catch (err) {
      toast.error(err.message || "Failed to move asset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        title="Move Asset"
        description="Relocate an asset by category, then update location, office, and assignee. Saving updates the asset list."
      />

      {!canEdit && (
        <Alert>
          <AlertDescription>
            Only admins can move assets. You can browse the list, but saving is disabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select asset</CardTitle>
            <CardDescription>Search and pick the asset to relocate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="move-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setSelectedId(null);
                }}
              >
                <SelectTrigger id="move-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((entry) => (
                    <SelectItem key={entry.code} value={entry.code}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-search">Search</Label>
              <Input
                id="move-search"
                value={search}
                placeholder="Asset no, serial, office, model…"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-8 w-8" />
              </div>
            ) : assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets match this search.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Office</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow
                        key={asset.id}
                        className={cn(
                          "cursor-pointer",
                          selectedId === asset.id && "bg-muted/60"
                        )}
                        onClick={() => selectAsset(asset)}
                      >
                        <TableCell className="font-medium">
                          {[asset.assetNo, asset.model].filter(Boolean).join(" · ") ||
                            `#${asset.id}`}
                        </TableCell>
                        <TableCell className="capitalize">{asset.category}</TableCell>
                        <TableCell>{asset.location || "—"}</TableCell>
                        <TableCell>{asset.office || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Move fields
            </CardTitle>
            <CardDescription>
              Only fields relevant to moving an asset. Changing office clears assignee unless you set
              a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select an asset from the list.</p>
            ) : (
              <form className="space-y-4" onSubmit={handleSave}>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {[selected.assetNo, selected.model].filter(Boolean).join(" · ") ||
                      `#${selected.id}`}
                  </p>
                  <p className="capitalize text-muted-foreground">{selected.category}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="move-location">Location</Label>
                  <Select
                    value={form.location || undefined}
                    onValueChange={(location) => setForm((current) => ({ ...current, location }))}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="move-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="move-office">Office</Label>
                  <Input
                    id="move-office"
                    value={form.office}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, office: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="move-assigned">Assigned to</Label>
                  <Input
                    id="move-assigned"
                    value={form.assignedRoom}
                    disabled={!canEdit}
                    placeholder="User / room"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, assignedRoom: event.target.value }))
                    }
                  />
                </div>

                <Button type="submit" disabled={!canEdit || saving} className="w-full sm:w-auto">
                  {saving && <Spinner className="mr-2" />}
                  Save move
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
