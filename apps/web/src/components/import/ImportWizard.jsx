import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Check, ChevronLeft, ChevronRight, Download, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  IGNORE_VALUE,
  applyMapping,
  autoMapColumns,
  downloadTemplate,
  getCategoryFieldOptions,
  getLowConfidenceHeaders,
  getUnmappedRequired,
  parseWorkbookSheet,
} from "@/lib/importMapping";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "category", label: "Category" },
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Mapping" },
  { id: "preview", label: "Preview" },
  { id: "result", label: "Result" },
];

const MAPPING_STORAGE_KEY = "ass-tracker-import-mappings";

function readStoredMappings() {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredMapping(categoryCode, mapping) {
  try {
    const current = readStoredMappings();
    current[categoryCode] = mapping;
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

function applyStoredMapping(headers, categoryCode, autoMapped) {
  const stored = readStoredMappings()[categoryCode];
  if (!stored || typeof stored !== "object") {
    return autoMapped;
  }

  const next = { ...autoMapped.mapping };
  const nextConfidence = { ...autoMapped.confidence };
  const usedFields = new Set();

  for (const header of headers) {
    const field = stored[header];
    if (!field) continue;
    if (usedFields.has(field)) continue;
    next[header] = field;
    nextConfidence[header] = 1;
    usedFields.add(field);
  }

  for (const [header, field] of Object.entries(next)) {
    if (field && usedFields.has(field) && stored[header] !== field) {
      // keep first assignment
    }
  }

  return { mapping: next, confidence: nextConfidence };
}

function downloadAttentionCsv(needsAttention) {
  const header = ["row", "reason", "assetNo", "serialNo", "blankFields", "duplicateFields", "existingId"];
  const lines = [header.join(",")];

  for (const entry of needsAttention) {
    const row = [
      entry.row ?? "",
      entry.reason ?? "",
      entry.assetNo ?? "",
      entry.serialNo ?? "",
      (entry.blankFields || []).join(";"),
      (entry.duplicateFields || []).join(";"),
      entry.existingId ?? "",
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`);
    lines.push(row.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "import-attention-rows.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ImportWizard({ categories, onImported, onFinished, onCancel }) {
  const { auth } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [confidence, setConfidence] = useState({});
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const effectiveCategory = selectedCategory || categories[0]?.code || "";
  const category = categories.find((entry) => entry.code === effectiveCategory);
  const fieldOptions = useMemo(
    () => getCategoryFieldOptions(category, { importMode: true }),
    [category]
  );

  const unmappedRequired = useMemo(
    () =>
      category && headers.length
        ? getUnmappedRequired(mapping, category, { importMode: true })
        : [],
    [mapping, category, headers.length]
  );

  const lowConfidenceHeaders = useMemo(
    () => getLowConfidenceHeaders(confidence),
    [confidence]
  );

  const mappedPreview = useMemo(() => {
    if (!category || rows.length === 0 || unmappedRequired.length > 0) return [];
    return applyMapping(rows.slice(0, 5), mapping, category);
  }, [category, rows, mapping, unmappedRequired.length]);

  const previewColumns = useMemo(() => {
    const mappedFieldNames = [...new Set(Object.values(mapping).filter(Boolean))];
    return fieldOptions.filter((field) => mappedFieldNames.includes(field.name));
  }, [mapping, fieldOptions]);

  function resetFileState() {
    setRows([]);
    setHeaders([]);
    setMapping({});
    setConfidence({});
    setError("");
    setWarning("");
    setImportResult(null);
  }

  function handleCategoryChange(value) {
    setSelectedCategory(value);
    resetFileState();
    setStepIndex(0);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file || !category) return;

    resetFileState();

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = parseWorkbookSheet(sheet, category);

        if (parsed.rows.length === 0) {
          setError("The file contains no data rows.");
          return;
        }

        const autoMapped = autoMapColumns(parsed.headers, category);
        const merged = applyStoredMapping(parsed.headers, category.code, autoMapped);

        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(merged.mapping);
        setConfidence(merged.confidence);

        const missing = getUnmappedRequired(merged.mapping, category, { importMode: true });
        const low = getLowConfidenceHeaders(merged.confidence);
        const skipNote =
          parsed.skippedTitleRows > 0
            ? `Skipped ${parsed.skippedTitleRows} title/subtitle row(s); using row ${parsed.headerRow + 1} as column headers.`
            : "";

        if (missing.length > 0) {
          setWarning(
            [skipNote, `Some required fields still need mapping: ${missing.join(", ")}.`]
              .filter(Boolean)
              .join(" ")
          );
        } else if (low.length > 0) {
          setWarning(
            [skipNote, `Low-confidence auto-map for: ${low.join(", ")}. Review before importing.`]
              .filter(Boolean)
              .join(" ")
          );
        } else if (skipNote) {
          setWarning(skipNote);
        } else {
          setWarning("");
        }

        setStepIndex(2);
      } catch {
        setError("Failed to parse file. Please upload a valid CSV, XLS, or XLSX file.");
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }

  function handleMappingChange(fileHeader, value) {
    const fieldName = value === IGNORE_VALUE ? null : value;

    setMapping((current) => {
      const next = { ...current };

      if (fieldName) {
        for (const [header, mapped] of Object.entries(next)) {
          if (header !== fileHeader && mapped === fieldName) {
            next[header] = null;
          }
        }
      }

      next[fileHeader] = fieldName;
      return next;
    });

    setConfidence((current) => ({
      ...current,
      [fileHeader]: fieldName ? 1 : 0,
    }));
    setError("");
  }

  async function handleImport() {
    if (!category || rows.length === 0) return;
    if (unmappedRequired.length > 0) {
      setError(`Map required fields before importing: ${unmappedRequired.join(", ")}`);
      return;
    }

    setImporting(true);
    setError("");
    try {
      saveStoredMapping(category.code, mapping);
      const payloads = applyMapping(rows, mapping, category);
      const result = await api(
        "/api/assets/import",
        { method: "POST", body: JSON.stringify({ category: category.code, rows: payloads }) },
        auth.token
      );
      const skipped = Number(result.skipped) || 0;
      if (skipped > 0) {
        toast.success(
          `Imported ${result.imported} asset(s); skipped ${skipped} duplicate row(s).`
        );
      } else {
        toast.success(`Imported ${result.imported} asset(s) successfully.`);
      }

      const needsAttention = Array.isArray(result.needsAttention) ? result.needsAttention : [];
      const blanks = needsAttention.filter(
        (entry) => entry.reason === "blank" || (entry.blankFields && entry.blankFields.length > 0)
      );
      const duplicates = needsAttention.filter((entry) => entry.reason === "duplicate");

      if (blanks.length > 0) {
        toast.warning(
          `${blanks.length} imported asset(s) have blank required fields. Edit them in Assets.`,
          { duration: 10000 }
        );
      }

      if (duplicates.length > 0) {
        toast.warning(
          `${duplicates.length} row(s) skipped as duplicates (Asset No / Serial No).`,
          { duration: 10000 }
        );
      }

      setImportResult({
        imported: result.imported,
        skipped,
        needsAttention,
      });
      setStepIndex(4);
      onImported?.();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    if (!category) return;
    downloadTemplate(category);
    toast.success(`Downloaded ${category.label} import template.`);
  }

  function confidenceBadge(header) {
    const score = confidence[header] ?? 0;
    if (!mapping[header]) {
      return <Badge variant="outline">Ignored</Badge>;
    }
    if (score >= 0.95) {
      return <Badge variant="default">Exact</Badge>;
    }
    if (score >= 0.75) {
      return <Badge variant="secondary">Matched</Badge>;
    }
    return <Badge variant="outline">Low confidence</Badge>;
  }

  function canGoNext() {
    if (stepIndex === 0) return Boolean(category);
    if (stepIndex === 1) return headers.length > 0 && rows.length > 0;
    if (stepIndex === 2) return headers.length > 0 && unmappedRequired.length === 0;
    if (stepIndex === 3) return rows.length > 0 && unmappedRequired.length === 0 && !importing;
    return false;
  }

  function goNext() {
    if (stepIndex === 3) {
      void handleImport();
      return;
    }
    if (canGoNext()) {
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }
  }

  function goBack() {
    if (stepIndex === 4) {
      resetFileState();
      setStepIndex(0);
      return;
    }
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function startAnother() {
    resetFileState();
    setStepIndex(0);
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                index === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : index < stepIndex
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {index < stepIndex ? <Check className="h-3 w-3" /> : <span>{index + 1}</span>}
              {step.label}
            </li>
          ))}
        </ol>

        {stepIndex === 0 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Category</Label>
                <Select value={effectiveCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((entry) => (
                      <SelectItem key={entry.code} value={entry.code}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={handleDownloadTemplate} disabled={!category}>
                <Download className="h-4 w-4" />
                Download template
              </Button>
            </div>
            {fieldOptions.length > 0 && (
              <Alert>
                <AlertDescription>
                  <p className="mb-1 font-medium">Expected fields:</p>
                  <p className="text-sm">{fieldOptions.map((field) => field.label).join(", ")}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {stepIndex === 1 && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/25 bg-accent/20 p-8 transition-all hover:border-primary hover:bg-accent/40">
              <Upload className="mb-2 h-8 w-8 text-primary" />
              <span className="text-sm font-semibold">Tap to upload file</span>
              <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </label>
            {headers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Loaded {rows.length} row{rows.length === 1 ? "" : "s"} — continue to mapping.
              </p>
            )}
          </div>
        )}

        {stepIndex === 2 && headers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Column mapping</p>
              <p className="text-xs text-muted-foreground">
                {rows.length} row{rows.length === 1 ? "" : "s"} loaded
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File column</TableHead>
                    <TableHead>Maps to</TableHead>
                    <TableHead>Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((header) => {
                    const mappedField = mapping[header];
                    return (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={mappedField || IGNORE_VALUE}
                            onValueChange={(value) => handleMappingChange(header, value)}
                          >
                            <SelectTrigger
                              className={
                                unmappedRequired.length > 0 && !mappedField
                                  ? "border-amber-400"
                                  : undefined
                              }
                            >
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={IGNORE_VALUE}>Ignore</SelectItem>
                              {fieldOptions.map((field) => (
                                <SelectItem key={field.name} value={field.name}>
                                  {field.label}
                                  {field.required ? " *" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{confidenceBadge(header)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {unmappedRequired.length > 0 && (
              <p className="text-sm text-destructive">
                Required fields not mapped: {unmappedRequired.join(", ")}
              </p>
            )}
            {lowConfidenceHeaders.length > 0 && unmappedRequired.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Review low-confidence columns: {lowConfidenceHeaders.join(", ")}
              </p>
            )}
          </div>
        )}

        {stepIndex === 3 && (
          <div className="space-y-3">
            {mappedPreview.length > 0 && previewColumns.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Preview (first {mappedPreview.length} row{mappedPreview.length === 1 ? "" : "s"}).
                  Confirm to import {rows.length} row{rows.length === 1 ? "" : "s"}.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewColumns.map((column) => (
                          <TableHead key={column.name}>{column.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreview.map((row, index) => (
                        <TableRow key={index}>
                          {previewColumns.map((column) => {
                            const value =
                              row[column.name] !== undefined
                                ? row[column.name]
                                : row.details?.[column.name];
                            return (
                              <TableCell key={`${index}-${column.name}`}>
                                {value === true ? "Yes" : value === false ? "No" : String(value ?? "")}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>Fix required column mappings before importing.</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {stepIndex === 4 && importResult && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Imported <strong>{importResult.imported}</strong> asset(s)
                {importResult.skipped > 0 ? (
                  <>
                    ; skipped <strong>{importResult.skipped}</strong> duplicate row(s)
                  </>
                ) : null}
                .
              </AlertDescription>
            </Alert>

            {importResult.needsAttention.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    Needs attention ({importResult.needsAttention.length})
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAttentionCsv(importResult.needsAttention)}
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
                <div className="max-h-48 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Asset / Serial</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.needsAttention.map((entry, index) => (
                        <TableRow key={`${entry.row}-${index}`}>
                          <TableCell>{entry.row ?? "—"}</TableCell>
                          <TableCell>{entry.reason || "—"}</TableCell>
                          <TableCell>
                            {[entry.assetNo, entry.serialNo].filter(Boolean).join(" · ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {(entry.blankFields || []).join(", ") ||
                              (entry.duplicateFields || []).join(", ") ||
                              "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={startAnother}>
                Import another file
              </Button>
              <Button type="button" variant="outline" onClick={() => onFinished?.()}>
                Go to Assets
              </Button>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {warning && !error && stepIndex < 4 && (
          <Alert>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}

        {stepIndex < 4 && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {onCancel && stepIndex === 0 && (
              <Button variant="outline" onClick={onCancel} disabled={importing}>
                Cancel
              </Button>
            )}
            {stepIndex > 0 && (
              <Button type="button" variant="outline" onClick={goBack} disabled={importing}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button type="button" onClick={goNext} disabled={!canGoNext() || importing}>
              {importing && <Spinner className="mr-2" />}
              {stepIndex === 3 ? (
                <>Import {rows.length > 0 ? `${rows.length} row(s)` : ""}</>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
