function FieldRow({ label, value }) {
  return (
    <div className="space-y-0.5 border-b border-border/60 py-2 last:border-b-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{value || "—"}</p>
    </div>
  );
}

/**
 * Fixed left panel of dependent asset fields for Maintenance.
 */
export function MaintenanceAssetPanel({ asset, emptyHint }) {
  if (!asset) {
    return (
      <aside className="rounded-xl border bg-card p-4 text-sm text-muted-foreground md:sticky md:top-4">
        {emptyHint || "Select an asset to see location, assignee, and identity fields."}
      </aside>
    );
  }

  const assignedTo = asset.details?.assignedRoom || "";
  const department = asset.details?.department || asset.office || "";
  const movingAssets =
    assignedTo && department
      ? `Assigned in ${department}. Moving location/department clears assignee unless reassigned.`
      : assignedTo
        ? "Assigned. Moving department clears assignee unless a new user is set."
        : "Not assigned. Safe to move location or department.";

  return (
    <aside className="rounded-xl border bg-card p-4 md:sticky md:top-4">
      <h2 className="mb-2 text-sm font-semibold">Asset details</h2>
      <div className="space-y-0">
        <FieldRow label="Moving assets" value={movingAssets} />
        <FieldRow label="Location" value={asset.location} />
        <FieldRow label="Assigned to" value={assignedTo} />
        <FieldRow label="Asset number" value={asset.assetNo} />
        <FieldRow label="Field number" value={asset.serialNo} />
        <FieldRow label="Model" value={asset.model} />
        <FieldRow label="Category" value={asset.category} />
        <FieldRow label="Office / Department" value={department} />
        <FieldRow label="Status" value={asset.status} />
      </div>
    </aside>
  );
}
