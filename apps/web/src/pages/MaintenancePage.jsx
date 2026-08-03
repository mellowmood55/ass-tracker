import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckSquare, ClipboardList, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { MaintenanceAssetPanel } from "@/components/maintenance/MaintenanceAssetPanel";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTERS = [1, 2, 3, 4];

function PeriodBadge({ done }) {
  if (done) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckSquare className="h-3 w-3" />
        Done
      </Badge>
    );
  }
  return <Badge variant="outline">Open</Badge>;
}

function matchesMaintenanceSearch(asset, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    asset.assetNo,
    asset.model,
    asset.office,
    asset.serialNo,
    asset.location,
    asset.details?.assignedRoom,
    asset.details?.department,
    asset.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function MaintenanceSection({
  title,
  description,
  cadence,
  year,
  category,
  search,
  authToken,
  onOpenForm,
}) {
  const [assets, setAssets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        year: String(year),
        cadence,
      });
      if (category !== "all") query.set("category", category);
      const data = await api(`/api/maintenance/assets?${query}`, {}, authToken);
      const nextAssets = data.assets || [];
      setAssets(nextAssets);
      setCurrentPeriod(
        cadence === "monthly" ? data.currentMonth || 1 : data.currentQuarter || 1
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [authToken, year, category, cadence]);

  const filteredAssets = useMemo(
    () => assets.filter((asset) => matchesMaintenanceSearch(asset, search)),
    [assets, search]
  );

  useEffect(() => {
    setSelectedId((current) => {
      if (current && filteredAssets.some((asset) => asset.id === current)) return current;
      return filteredAssets[0]?.id ?? null;
    });
  }, [filteredAssets]);

  const selectedAsset = useMemo(
    () => filteredAssets.find((asset) => asset.id === selectedId) || null,
    [filteredAssets, selectedId]
  );

  const periodKeys = cadence === "monthly" ? MONTHS : QUARTERS;

  function handleRowClick(asset) {
    setSelectedId(asset.id);
    onOpenForm(asset.id, cadence, currentPeriod);
  }

  function handleRowKeyDown(event, asset) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick(asset);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Current {cadence === "monthly" ? "month" : "quarter"}:{" "}
          {cadence === "monthly" ? `M${currentPeriod}` : `Q${currentPeriod}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-7 w-7" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {assets.length === 0
            ? "No machines found for this view."
            : "No machines match your search."}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_1fr]">
          <MaintenanceAssetPanel asset={selectedAsset} />
          <div className="max-h-[28rem] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Office</TableHead>
                  {periodKeys.map((period) => (
                    <TableHead key={period} className="whitespace-nowrap px-2 text-center">
                      {cadence === "monthly" ? `M${period}` : `Q${period}`}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    tabIndex={0}
                    role="button"
                    className={cn(
                      "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      selectedId === asset.id && "bg-muted/60"
                    )}
                    onClick={() => handleRowClick(asset)}
                    onKeyDown={(event) => handleRowKeyDown(event, asset)}
                  >
                    <TableCell className="font-medium">
                      {[asset.assetNo, asset.model].filter(Boolean).join(" · ") || `#${asset.id}`}
                    </TableCell>
                    <TableCell className="capitalize">{asset.category}</TableCell>
                    <TableCell>{asset.office || asset.details?.department || "—"}</TableCell>
                    {periodKeys.map((period) => (
                      <TableCell key={period} className="px-2 text-center">
                        <PeriodBadge done={Boolean(asset.periods?.[period])} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenForm(asset.id, cadence, currentPeriod);
                        }}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Form
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}

export function MaintenancePage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const category = searchParams.get("category") || "all";
  const cadence = searchParams.get("cadence") === "monthly" ? "monthly" : "quarterly";
  const [search, setSearch] = useState("");

  function setCadence(nextCadence) {
    const next = new URLSearchParams(searchParams);
    next.set("cadence", nextCadence);
    setSearchParams(next);
  }

  function openForm(assetId, formCadence, period) {
    const query = new URLSearchParams({
      year: String(year),
      cadence: formCadence,
    });
    if (formCadence === "monthly") query.set("month", String(period));
    else query.set("quarter", String(period));
    navigate(`/maintenance/${assetId}?${query}`);
  }

  const isMonthly = cadence === "monthly";

  return (
    <div className="space-y-6 animate-in-fade">
      <PageHeader
        title="Maintenance"
        description="Switch between quarterly and monthly views. Search assets, complete the checklist and issue report, then download the change-request PDF."
      />

      <div
        role="group"
        aria-label="Maintenance view"
        className="flex w-full flex-wrap gap-2 sm:w-auto"
      >
        <Button
          type="button"
          className="flex-1 sm:flex-none"
          variant={cadence === "quarterly" ? "default" : "outline"}
          onClick={() => setCadence("quarterly")}
          aria-pressed={cadence === "quarterly"}
        >
          Quarterly
        </Button>
        <Button
          type="button"
          className="flex-1 sm:flex-none"
          variant={cadence === "monthly" ? "default" : "outline"}
          onClick={() => setCadence("monthly")}
          aria-pressed={cadence === "monthly"}
        >
          Monthly
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="maint-year">Year</Label>
          <Input
            id="maint-year"
            type="number"
            value={year}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set("year", event.target.value || String(new Date().getFullYear()));
              setSearchParams(next);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value === "all") next.delete("category");
              else next.set("category", value);
              setSearchParams(next);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Computers & printers</SelectItem>
              <SelectItem value="computer">Computer</SelectItem>
              <SelectItem value="printer">Printer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="maint-search">Search</Label>
          <Input
            id="maint-search"
            type="search"
            value={search}
            placeholder="Asset no, model, office, assigned to…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <MaintenanceSection
        title={isMonthly ? "Monthly maintenance" : "Quarterly maintenance"}
        description={
          isMonthly
            ? "Track M1–M12 checklist completion for computers and printers."
            : "Track Q1–Q4 checklist completion for each asset."
        }
        cadence={cadence}
        year={year}
        category={category}
        search={search}
        authToken={auth.token}
        onOpenForm={openForm}
      />
    </div>
  );
}

export function MaintenanceFormPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { assetId: assetIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const assetId = Number(assetIdParam);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const cadence = searchParams.get("cadence") === "monthly" ? "monthly" : "quarterly";
  const quarter =
    Number(searchParams.get("quarter")) || Math.floor(new Date().getMonth() / 3) + 1;
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  const [record, setRecord] = useState(null);
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const periodLabel =
    cadence === "monthly" ? `Month ${month}` : `Q${quarter}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          year: String(year),
          cadence,
        });
        if (cadence === "monthly") query.set("month", String(month));
        else query.set("quarter", String(quarter));
        const data = await api(
          `/api/maintenance/assets/${assetId}?${query}`,
          {},
          auth.token
        );
        if (!cancelled) {
          const next = data.record;
          if (next && !String(next.doneBy || "").trim()) {
            next.doneBy = auth.user?.username || "";
          }
          if (next && !String(next.preparedBy || "").trim()) {
            next.preparedBy = auth.user?.username || "";
          }
          setRecord(next);
          setAsset(data.asset || null);
        }
      } catch (err) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (assetId) void load();
    return () => {
      cancelled = true;
    };
  }, [assetId, year, cadence, quarter, month, auth.token, auth.user?.username]);

  function updateItem(itemId, patch) {
    setRecord((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }

  function updateField(field, value) {
    setRecord((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!String(record.doneBy || "").trim()) {
      toast.error("Done by is required.");
      return;
    }
    setSaving(true);
    try {
      const data = await api(
        `/api/maintenance/records/${record.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            items: record.items.map((item) => ({
              id: item.id,
              checked: item.checked,
              description: item.description,
            })),
            hardwareType: record.hardwareType,
            hardwarePart: record.hardwarePart,
            hardwareReports: record.hardwareReports,
            hardwareDescription: record.hardwareDescription,
            softwareType: record.softwareType,
            softwarePrograms: record.softwarePrograms,
            softwareReports: record.softwareReports,
            softwareDescription: record.softwareDescription,
            solution: record.solution,
            preparedBy: record.preparedBy || record.doneBy,
            doneBy: record.doneBy,
          }),
        },
        auth.token
      );
      setRecord(data.record);
      toast.success(
        data.record.status === "complete"
          ? "Maintenance marked complete."
          : "Maintenance form saved."
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReport() {
    try {
      const query = new URLSearchParams({
        year: String(year),
        cadence,
        format: "pdf",
      });
      if (cadence === "monthly") query.set("month", String(month));
      else query.set("quarter", String(quarter));
      const response = await fetch(
        `${API_BASE}/api/maintenance/assets/${assetId}/report?${query}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to generate report.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const periodTag = cadence === "monthly" ? `M${month}` : `Q${quarter}`;
      anchor.download = `change-request-${assetId}-${periodTag}-${year}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Downloaded change-request report.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!record) {
    return <p className="text-sm text-muted-foreground">Maintenance record not found.</p>;
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        title={`${cadence === "monthly" ? "Monthly" : "Quarterly"} maintenance · ${periodLabel} ${year}`}
        description="Complete the in-app checklist, log hardware/software issues and solution, then mark complete to print the PAD change-request form."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate("/maintenance")}>
            Back to list
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_1fr]">
        <MaintenanceAssetPanel asset={asset} />
        <div className="space-y-6">
          {record.status === "complete" ? (
            <Badge variant="default" className="text-sm">
              complete
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm">
              in progress
            </Badge>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Checklist
            </h3>
            <p className="text-xs text-muted-foreground">
              For internal use only — checklist items are not printed on the report.
            </p>
            {record.items.map((item) => (
              <div key={item.id} className="space-y-2 rounded-xl border p-4">
                <label className="flex items-start gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={Boolean(item.checked)}
                    onChange={(event) => updateItem(item.id, { checked: event.target.checked })}
                  />
                  <span>{item.label}</span>
                </label>
                <div className="space-y-1 pl-7">
                  <Label htmlFor={`desc-${item.id}`}>Notes (optional)</Label>
                  <Input
                    id={`desc-${item.id}`}
                    value={item.description || ""}
                    placeholder="Optional notes for this item…"
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                  />
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Hardware issues
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="hw-type">Type / model</Label>
                <Input
                  id="hw-type"
                  value={record.hardwareType || ""}
                  onChange={(event) => updateField("hardwareType", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hw-part">Part</Label>
                <Input
                  id="hw-part"
                  value={record.hardwarePart || ""}
                  onChange={(event) => updateField("hardwarePart", event.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hw-reports">Reports</Label>
                <Input
                  id="hw-reports"
                  value={record.hardwareReports || ""}
                  onChange={(event) => updateField("hardwareReports", event.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hw-desc">Description of errors</Label>
                <Input
                  id="hw-desc"
                  value={record.hardwareDescription || ""}
                  onChange={(event) => updateField("hardwareDescription", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Software issues
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sw-type">Type / model</Label>
                <Input
                  id="sw-type"
                  value={record.softwareType || ""}
                  onChange={(event) => updateField("softwareType", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sw-programs">Programs</Label>
                <Input
                  id="sw-programs"
                  value={record.softwarePrograms || ""}
                  onChange={(event) => updateField("softwarePrograms", event.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="sw-reports">Reports</Label>
                <Input
                  id="sw-reports"
                  value={record.softwareReports || ""}
                  onChange={(event) => updateField("softwareReports", event.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="sw-desc">Description of errors</Label>
                <Input
                  id="sw-desc"
                  value={record.softwareDescription || ""}
                  onChange={(event) => updateField("softwareDescription", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Solution & sign-off
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="solution">Solution</Label>
                <Input
                  id="solution"
                  value={record.solution || ""}
                  placeholder="Summary of work done…"
                  onChange={(event) => updateField("solution", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="done-by">Done by (required)</Label>
                <Input
                  id="done-by"
                  value={record.doneBy || ""}
                  onChange={(event) => updateField("doneBy", event.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Spinner className="mr-2" />}
              Save form
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReport}
              disabled={record.status !== "complete"}
            >
              <FileText className="h-4 w-4" />
              Download change-request PDF
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/settings/maintenance-checklists">Edit checklist templates</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
