import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetTable } from "@/components/assets/AssetTable";
import { ImportModal } from "@/components/import/ImportModal";
import { useAuth } from "@/context/AuthContext";
import { downloadReport } from "@/lib/api";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

export function AssetsPage() {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const riskFilter = searchParams.get("risk") || "";

  const { categories } = useCategories();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const assetsByCategory = useMemo(() => {
    return categories.reduce((accumulator, category) => {
      accumulator[category.code] = assets.filter((asset) => asset.category === category.code);
      return accumulator;
    }, {});
  }, [assets, categories]);

  const visibleCategories = useMemo(() => {
    if (categoryFilter) {
      return categories.filter((category) => category.code === categoryFilter);
    }
    return categories;
  }, [categories, categoryFilter]);

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

  return (
    <div>
      <PageHeader
        eyebrow="ICT Asset Tracker"
        title="Asset Browser"
        description="Search, filter, export, and manage all registered assets."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import Data
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
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary">Risk filter active</Badge>
          <span className="text-sm text-muted-foreground">{riskFilter.replace(/-/g, " ")}</span>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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
              {ALL_STATUSES.map((status) => (
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
        <Accordion type="multiple" defaultValue={visibleCategories.map((c) => c.code)} className="space-y-3">
          {visibleCategories.map((category) => {
            const categoryAssets = assetsByCategory[category.code] || [];
            return (
              <AccordionItem key={category.code} value={category.code} className="rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{category.label}</span>
                    <Badge variant="secondary">{categoryAssets.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <AssetTable
                    category={category}
                    assets={categoryAssets}
                    loading={loading}
                    onDeleted={reload}
                    riskFilter={riskFilter}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <ImportModal open={importOpen} onOpenChange={setImportOpen} categories={categories} onImported={reload} />
    </div>
  );
}
