import { useState } from "react";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import { ChipInput } from "@/components/settings/ChipInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADD_GROUP_VALUE = "__add_group__";

export function FieldRowEditor({
  field,
  editMode,
  groups,
  scope,
  onChange,
  onRemove,
  onAddGroup,
  highlighted = false,
  inGroup = false,
}) {
  const scopedGroups = (groups || []).filter((group) => group.scope === scope);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const isLocked = Boolean(field.locked);

  function handleGroupChange(value) {
    if (value === ADD_GROUP_VALUE) {
      setCreatingGroup(true);
      setNewGroupLabel("");
      return;
    }
    setCreatingGroup(false);
    onChange({ ...field, groupId: value === "__none__" ? undefined : value });
  }

  function confirmNewGroup() {
    const label = newGroupLabel.trim();
    if (!label) return;
    onAddGroup(scope, label, field.name);
    setCreatingGroup(false);
    setNewGroupLabel("");
  }

  function toggleLocked() {
    onChange({
      ...field,
      locked: !isLocked,
    });
  }

  return (
    <div
      id={`field-row-${field.name}`}
      className={cn(
        "rounded-lg border border-border/70 p-4 shadow-sm transition-shadow",
        inGroup ? "bg-card/80" : "bg-card",
        highlighted && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{field.label}</p>
          <p className="text-xs text-muted-foreground">{field.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleLocked}
              aria-label={isLocked ? "Unlock field" : "Lock field"}
              title={isLocked ? "Unlock field (admin)" : "Lock field (admin)"}
            >
              {isLocked ? (
                <Lock className="h-4 w-4 text-amber-600" />
              ) : (
                <LockOpen className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          ) : (
            isLocked && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked field" />
          )}
          {editMode && !isLocked && (
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(field.name)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input
            value={field.label}
            disabled={!editMode || isLocked}
            onChange={(event) => onChange({ ...field, label: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={field.type}
            disabled={!editMode || isLocked}
            onValueChange={(value) =>
              onChange({
                ...field,
                type: value,
                options: value === "select" ? field.options || [] : undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="select">Select</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="number">Number</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {editMode && (
          <div className="space-y-2 md:col-span-2">
            <Label>Group</Label>
            <Select value={field.groupId || "__none__"} onValueChange={handleGroupChange}>
              <SelectTrigger>
                <SelectValue placeholder="No group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No group</SelectItem>
                {scopedGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_GROUP_VALUE}>Add group…</SelectItem>
              </SelectContent>
            </Select>
            {creatingGroup && (
              <div className="flex gap-2">
                <Input
                  value={newGroupLabel}
                  placeholder="Group name"
                  onChange={(event) => setNewGroupLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirmNewGroup();
                    }
                  }}
                />
                <Button type="button" onClick={confirmNewGroup}>
                  Add
                </Button>
                <Button type="button" variant="outline" onClick={() => setCreatingGroup(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
          <Label htmlFor={`required-${field.name}`}>Required</Label>
          <Switch
            id={`required-${field.name}`}
            checked={Boolean(field.required)}
            disabled={!editMode}
            onCheckedChange={(checked) => onChange({ ...field, required: checked })}
          />
        </div>
      </div>

      {field.type === "select" && (
        <div className="mt-4">
          <ChipInput
            label="Fixed values"
            values={field.options || []}
            disabled={!editMode}
            placeholder="Type a value and press Enter"
            onChange={(options) => onChange({ ...field, options })}
          />
        </div>
      )}

      <div className="mt-4">
        <ChipInput
          label="Import aliases"
          values={field.aliases || []}
          disabled={!editMode}
          placeholder="Type an alias and press Enter"
          onChange={(aliases) => onChange({ ...field, aliases })}
        />
      </div>
    </div>
  );
}
