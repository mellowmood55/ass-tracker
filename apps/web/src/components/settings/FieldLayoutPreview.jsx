import { buildPreviewColumns } from "@/lib/fieldConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function FieldLayoutPreview({ config, categoryLabel }) {
  const columns = buildPreviewColumns(config);
  const hasGroups = columns.some((column) => column.groupLabel);

  if (columns.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Preview</CardTitle>
        <CardDescription>How {categoryLabel} fields appear in assets table and exports.</CardDescription>
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
                <TableHead key={column.key} className="whitespace-nowrap">
                  {column.label}
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
