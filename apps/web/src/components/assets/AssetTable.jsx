import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useDataRefresh } from "@/context/DataRefreshContext";
import { api } from "@/lib/api";
import {
  CATEGORY_LIST_COLUMNS,
  getRiskLabel,
  getRiskVariant,
  matchesRiskFilter,
} from "@/lib/assetColumns";
import { PAGE_SIZE } from "@/lib/constants";
import { DeleteConfirmDialog } from "@/components/assets/DeleteConfirmDialog";
import { AuditLogSheet } from "@/components/audit/AuditLogSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCardIdentity(asset) {
  const parts = [asset.assetNo, asset.model, asset.serialNo].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : `Asset #${asset.id}`;
}

export function AssetTable({ category, assets, loading, onDeleted, riskFilter, returnTo }) {
  const { auth } = useAuth();
  const { bump } = useDataRefresh();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [auditAsset, setAuditAsset] = useState(null);

  const columns = CATEGORY_LIST_COLUMNS[category.code] || [];

  const filteredAssets = useMemo(
    () => assets.filter((asset) => matchesRiskFilter(asset, riskFilter)),
    [assets, riskFilter]
  );

  useEffect(() => {
    setPage(1);
  }, [riskFilter, category.code, assets.length]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const pageAssets = filteredAssets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function buildEditPath(assetId) {
    const params = new URLSearchParams({ edit: String(assetId) });
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    return `/entry?${params.toString()}`;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/assets/${deleteTarget.id}`, { method: "DELETE" }, auth.token);
      toast.success("Asset deleted.");
      setDeleteTarget(null);
      bump("asset-deleted");
      onDeleted?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (filteredAssets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No records in this category.</p>
        <Button variant="link" className="mt-2" onClick={() => navigate("/entry")}>
          Add an asset
        </Button>
      </div>
    );
  }

  const pagination = totalPages > 1 && (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} ({filteredAssets.length} assets)
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );

  const dialogs = (
    <>
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        assetLabel={deleteTarget ? `asset #${deleteTarget.id}` : "this asset"}
        onConfirm={handleDelete}
        deleting={deleting}
      />
      <AuditLogSheet
        asset={auditAsset}
        open={Boolean(auditAsset)}
        onOpenChange={(open) => !open && setAuditAsset(null)}
      />
    </>
  );

  return (
    <>
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                {columns.map((column) => (
                  <TableHead key={column.label}>{column.label}</TableHead>
                ))}
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageAssets.map((asset) => {
                const riskLabel = getRiskLabel(asset);
                return (
                  <TableRow key={asset.id} className="transition-colors hover:bg-accent/40">
                    <TableCell className="font-medium">{asset.id}</TableCell>
                    {columns.map((column) => (
                      <TableCell key={`${asset.id}-${column.label}`}>{column.value(asset)}</TableCell>
                    ))}
                    <TableCell>
                      {riskLabel ? (
                        <Badge variant={getRiskVariant(riskLabel)}>{riskLabel}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit asset ${asset.id}`}
                          onClick={() => navigate(buildEditPath(asset.id))}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View audit history for asset ${asset.id}`}
                          onClick={() => setAuditAsset(asset)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete asset ${asset.id}`}
                          onClick={() => setDeleteTarget(asset)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {pagination}
      </div>

      <div className="space-y-3 md:hidden">
        {pageAssets.map((asset) => {
          const riskLabel = getRiskLabel(asset);
          return (
            <article
              key={asset.id}
              className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-shadow active:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">#{asset.id}</p>
                  <p className="truncate text-base font-semibold text-foreground">
                    {formatCardIdentity(asset)}
                  </p>
                  <p className="text-sm text-muted-foreground">{asset.status || "—"}</p>
                </div>
                {riskLabel ? (
                  <Badge variant={getRiskVariant(riskLabel)} className="shrink-0">
                    {riskLabel}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => navigate(buildEditPath(asset.id))}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setAuditAsset(asset)}
                >
                  <History className="h-4 w-4" />
                  History
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(asset)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </article>
          );
        })}
        {pagination}
      </div>

      {dialogs}
    </>
  );
}
