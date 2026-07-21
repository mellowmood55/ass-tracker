import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, FileUp, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetTable } from "@/components/assets/AssetTable";
import { useAuth } from "@/context/AuthContext";
import { downloadReport } from "@/lib/api";
import { formatRiskFilterLabel, matchesRiskFilter } from "@/lib/assetColumns";
import { useCategories } from "@/hooks/useCategories";
import { useAssets } from "@/hooks/useAssets";
import { useDebounce } from "@/hooks/useDebounce";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

const ALL_STATUSES = [
  "Functional",
  "Non-funct",
  "Under Repair",
  "Active",
  "Deprecated",
  "Inactive",
];

const CATEGORY_TAB_KEY = "ass-tracker-assets-category-tab";

function readStoredCategoryTab() {
  try {
    return sessionStorage.getItem(CATEGORY_TAB_KEY) || "";
  } catch {
    return "";
  }
}

export function AssetsPage() {
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const riskFilter = searchParams.get("risk") || "";

  const { categories } = useCategories();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState(readStoredCategoryTab);

  const debouncedSearch = useDebounce(search, 300);

  const filters = useMemo(
    () => ({
      category: categoryFilter,
      status: statusFilter,
      search: debouncedSearch,
    }),
    [categoryFilter, statusFilter, debouncedSearch]
  );

  const { assets, loading, reload } = useAssets(filters);

  const statusOptions = useMemo(() => {
    const fromAssets = assets
      .map((asset) => String(asset.status || "").trim())
      .filter(Boolean);
    return [...new Set([...ALL_STATUSES, ...fromAssets])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [assets]);

  const returnTo = riskFilter ? `/assets?risk=${riskFilter}` : "/assets";

  const visibleCategories = useMemo(() => {
    if (categoryFilter) {
      return categories.filter((category) => category.code === categoryFilter);
    }
    return categories;
  }, [categories, categoryFilter]);

  useEffect(() => {
    if (visibleCategories.length === 0) {
      setActiveCategoryTab("");
      return;
    }
    if (!visibleCategories.some((category) => category.code === activeCategoryTab)) {
      const stored = readStoredCategoryTab();
      const next = visibleCategories.some((category) => category.code === stored)
        ? stored
        : visibleCategories[0].code;
      setActiveCategoryTab(next);
    }
  }, [visibleCategories, activeCategoryTab]);

  function handleCategoryTabChange(code) {
    setActiveCategoryTab(code);
    try {
      sessionStorage.setItem(CATEGORY_TAB_KEY, code);
    } catch {
      /* ignore quota / private mode */
    }
  }

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void reload();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [reload]);

  const assetsByCategory = useMemo(() => {
    return categories.reduce((accumulator, category) => {
      accumulator[category.code] = assets.filter((asset) => asset.category === category.code);
      return accumulator;
    }, {});
  }, [assets, categories]);

  const riskMatchCount = useMemo(() => {
    if (!riskFilter) return 0;
    return assets.filter((asset) => matchesRiskFilter(asset, riskFilter)).length;
  }, [assets, riskFilter]);

  async function handleExport(format, exportFilters = filters) {
    setExporting(true);
    try {
      const blob = await downloadReport(auth.token, format, exportFilters);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const selectedCategoryLabel =
        categories.find((category) => category.code === exportFilters.category)?.label || "all-categories";
      const filenamePrefix = selectedCategoryLabel.toLowerCase().replace(/\s+/g, "-");
      anchor.download =
        format === "xlsx" ? `${filenamePrefix}-asset-report.xlsx` : `${filenamePrefix}-asset-report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${format.toUpperCase()} report.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  function clearRiskFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete("risk");
    setSearchParams(next);
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        eyebrow="Inventory"
        title="Assets"
        description="Browse one category at a time. Export reports or jump to Import."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/import">
                <FileUp className="h-4 w-4" />
                Import
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={exporting}>
                  {exporting ? <Spinner className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Export reports</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export Excel (filtered)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF (filtered)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Per category</DropdownMenuLabel>
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category.code}
                    onClick={() => handleExport("xlsx", { ...filters, category: category.code })}
                  >
                    {category.label} Excel
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {riskFilter && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-white">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Needs action</p>
              <p className="text-sm text-muted-foreground">
                Showing {riskMatchCount} asset{riskMatchCount === 1 ? "" : "s"} for{" "}
                <span className="font-medium text-foreground">{formatRiskFilterLabel(riskFilter)}</span>
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearRiskFilter}>
            <X className="h-4 w-4" />
            Clear filter
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="filter-category">Category</Label>
          <Select
            value={categoryFilter || "all"}
            onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger id="filter-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.code} value={category.code}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-status">Status</Label>
          <Select
            value={statusFilter || "all"}
            onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger id="filter-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-search">Search</Label>
          <Input
            id="filter-search"
            type="text"
            value={search}
            placeholder="Asset no, serial, office..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {visibleCategories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories available.</p>
      ) : (
        <Tabs value={activeCategoryTab} onValueChange={handleCategoryTabChange}>
          <TabsList className="h-auto min-h-10 w-full flex-wrap justify-start">
            {visibleCategories.map((category) => {
              const count = (assetsByCategory[category.code] || []).filter((asset) =>
                matchesRiskFilter(asset, riskFilter)
              ).length;
              return (
                <TabsTrigger key={category.code} value={category.code} className="gap-2">
                  {category.label}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {visibleCategories.map((category) => (
            <TabsContent key={category.code} value={category.code}>
              <AssetTable
                category={category}
                assets={assetsByCategory[category.code] || []}
                loading={loading}
                onDeleted={reload}
                riskFilter={riskFilter}
                returnTo={returnTo}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
