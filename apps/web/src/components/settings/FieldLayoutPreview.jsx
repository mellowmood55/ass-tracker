import { buildPreviewColumns } from "@/lib/fieldConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function FieldLayoutPreview({ config, categoryLabel, onFieldClick }) {
  const columns = buildPreviewColumns(config);
  const hasGroups = columns.some((column) => column.groupLabel);
  const clickable = typeof onFieldClick === "function";

  if (columns.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Preview</CardTitle>
        <CardDescription>
          How {categoryLabel} fields appear in assets table and exports.
          {clickable ? " Click a field header to edit that field." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            {hasGroups && (
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={`group-${column.key}`} className="whitespace-nowrap text-primary">
                    {column.groupLabel || ""}
                  </TableHead>
                ))}
              </TableRow>
            )}
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className="whitespace-nowrap p-0">
                  {clickable ? (
                    <button
                      type="button"
                      className={cn(
                        "w-full px-2 py-2 text-left font-medium text-muted-foreground transition-colors",
                        "hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      aria-label={`Edit ${column.label}`}
                      onClick={() => onFieldClick(column.key)}
                    >
                      {column.label}
                    </button>
                  ) : (
                    <span className="px-2 py-2">{column.label}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={`sample-${column.key}`} className="whitespace-nowrap text-muted-foreground">
                  {column.sampleValue}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
