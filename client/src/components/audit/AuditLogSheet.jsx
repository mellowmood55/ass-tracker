import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getChangedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes = [];

  for (const key of keys) {
    if (key === "details") continue;
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push({ field: key, before: beforeVal, after: afterVal });
    }
  }

  const beforeDetails = before?.details || {};
  const afterDetails = after?.details || {};
  const detailKeys = new Set([...Object.keys(beforeDetails), ...Object.keys(afterDetails)]);
  for (const key of detailKeys) {
    if (JSON.stringify(beforeDetails[key]) !== JSON.stringify(afterDetails[key])) {
      changes.push({
        field: `details.${key}`,
        before: beforeDetails[key],
        after: afterDetails[key],
      });
    }
  }

  return changes;
}

function actionVariant(action) {
  switch (action) {
    case "create":
      return "default";
    case "update":
      return "secondary";
    case "delete":
      return "destructive";
    default:
      return "outline";
  }
}

export function AuditLogSheet({ asset, open, onOpenChange }) {
  const { auth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !asset?.id) return;

    async function loadLogs() {
      setLoading(true);
      setError("");
      try {
        const data = await api(`/api/assets/${asset.id}/audit`, {}, auth.token);
        setLogs(data.logs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, [open, asset?.id, auth.token]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Audit History</SheetTitle>
          <SheetDescription>
            Change log for asset #{asset?.id} {asset?.assetNo ? `(${asset.assetNo})` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No audit entries found.</p>
          )}

          {!loading &&
            logs.map((log) => {
              const changes = getChangedFields(log.before, log.after);
              return (
                <div key={log.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    by <span className="font-medium">{log.actorUsername}</span>
                  </p>

                  {log.action === "create" && log.after && (
                    <p className="mt-2 text-xs text-muted-foreground">Asset created with current field values.</p>
                  )}

                  {log.action === "delete" && (
                    <p className="mt-2 text-xs text-muted-foreground">Asset was permanently deleted.</p>
                  )}

                  {log.action === "update" && changes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <Separator />
                      {changes.map((change) => (
                        <div key={change.field} className="text-xs">
                          <p className="font-medium text-foreground">{change.field}</p>
                          <p className="text-muted-foreground">
                            <span className="line-through">{formatValue(change.before)}</span>
                            {" → "}
                            <span className="font-medium text-primary">{formatValue(change.after)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
