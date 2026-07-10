import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Download, Upload } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ImportModal({ open, onOpenChange, categories, onImported }) {
  const { auth } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [confidence, setConfidence] = useState({});
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [importing, setImporting] = useState(false);

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
  }

  function resetAll() {
    resetFileState();
  }

  function handleCategoryChange(value) {
    setSelectedCategory(value);
    resetFileState();
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

        const { mapping: nextMapping, confidence: nextConfidence } = autoMapColumns(
          parsed.headers,
          category
        );

        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(nextMapping);
        setConfidence(nextConfidence);

        const missing = getUnmappedRequired(nextMapping, category, { importMode: true });
        const low = getLowConfidenceHeaders(nextConfidence);
        const skipNote =
          parsed.skippedTitleRows > 0
            ? `Skipped ${parsed.skippedTitleRows} title/subtitle row(s); using row ${parsed.headerRow + 1} as column headers.`
            : "";

        if (missing.length > 0) {
          setWarning(
            [skipNote, `Some required fields still need mapping: ${missing.join(", ")}. Adjust the column map below.`]
              .filter(Boolean)
              .join(" ")
          );
        } else if (low.length > 0) {
          setWarning(
            [skipNote, `Low-confidence auto-map for: ${low.join(", ")}. Review the mapping before importing.`]
              .filter(Boolean)
              .join(" ")
          );
        } else if (skipNote) {
          setWarning(skipNote);
        } else {
          setWarning("");
        }
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

      // Ensure unique field assignment: clear other headers mapped to same field
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
        const preview = blanks
          .slice(0, 5)
          .map((entry) => {
            const who = entry.assetNo || entry.serialNo || `row ${entry.row}`;
            return `${who}: ${entry.blankFields.join(", ")}`;
          })
          .join(" · ");
        const more = blanks.length > 5 ? ` (+${blanks.length - 5} more)` : "";
        toast.warning(
          `${blanks.length} imported asset(s) have blank required fields. Edit them in Assets. ${preview}${more}`,
          { duration: 12000 }
        );
      }

      if (duplicates.length > 0) {
        const preview = duplicates
          .slice(0, 5)
          .map((entry) => {
            const who = entry.assetNo || entry.serialNo || `row ${entry.row}`;
            const fields = (entry.duplicateFields || []).join("/");
            return `${who} (${fields})`;
          })
          .join(" · ");
        const more = duplicates.length > 5 ? ` (+${duplicates.length - 5} more)` : "";
        toast.warning(
          `${duplicates.length} row(s) skipped as duplicates (Asset No / Serial No). Review existing assets or fix the file. ${preview}${more}`,
          { duration: 12000 }
        );
      }

      onImported();
      onOpenChange(false);
      resetAll();
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetAll();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            Headers don’t need to match exactly — upload a file, review the column mapping, then
            import.
          </DialogDescription>
        </DialogHeader>

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
                <p className="text-sm">
                  {fieldOptions.map((field) => field.label).join(", ")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Blank cells are allowed on import. After import, you will be alerted to edit any
                  missing required values in Assets.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-accent/30">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Click to upload file</span>
            <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </label>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warning && !error && (
            <Alert>
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          {headers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Column mapping</p>
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

          {mappedPreview.length > 0 && previewColumns.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                Preview (mapped values, first {mappedPreview.length} row
                {mappedPreview.length === 1 ? "" : "s"}):
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
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || rows.length === 0 || unmappedRequired.length > 0}
          >
            {importing && <Spinner className="mr-2" />}
            Import {rows.length > 0 ? `${rows.length} row(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
