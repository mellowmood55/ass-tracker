import { Trash2 } from "lucide-react";
import { FieldRowEditor } from "@/components/settings/FieldRowEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupFieldsBySection } from "@/lib/fieldConfig";

function updateFieldList(fields, name, nextField) {
  return fields.map((field) => (field.name === name ? nextField : field));
}

function removeFieldFromList(fields, name) {
  return fields.filter((field) => field.name !== name);
}

export function CategoryFieldEditor({ category, config, editMode, onChange, scrollToFieldName }) {
  const sharedLayout = groupFieldsBySection(config.sharedFields, config.groups, "shared");
  const detailLayout = groupFieldsBySection(config.detailFields, config.groups, "detail");

  function updateSharedField(name, nextField) {
    onChange({ ...config, sharedFields: updateFieldList(config.sharedFields, name, nextField) });
  }

  function updateDetailField(name, nextField) {
    onChange({ ...config, detailFields: updateFieldList(config.detailFields, name, nextField) });
  }

  function removeSharedField(name) {
    onChange({ ...config, sharedFields: removeFieldFromList(config.sharedFields, name) });
  }

  function removeDetailField(name) {
    onChange({ ...config, detailFields: removeFieldFromList(config.detailFields, name) });
  }

  function addGroupAndAssignField(scope, label, fieldName) {
    const id = `${scope}Group${Date.now()}`;
    const nextGroups = [...(config.groups || []), { id, label, scope }];
    const assignGroup = (fields) =>
      fields.map((field) => (field.name === fieldName ? { ...field, groupId: id } : field));

    onChange({
      ...config,
      groups: nextGroups,
      sharedFields: scope === "shared" ? assignGroup(config.sharedFields) : config.sharedFields,
      detailFields: scope === "detail" ? assignGroup(config.detailFields) : config.detailFields,
    });
  }

  function updateGroup(groupId, label) {
    onChange({
      ...config,
      groups: (config.groups || []).map((group) =>
        group.id === groupId ? { ...group, label } : group
      ),
    });
  }

  function removeGroup(groupId) {
    const nextShared = config.sharedFields.map((field) =>
      field.groupId === groupId ? { ...field, groupId: undefined } : field
    );
    const nextDetail = config.detailFields.map((field) =>
      field.groupId === groupId ? { ...field, groupId: undefined } : field
    );
    onChange({
      ...config,
      groups: (config.groups || []).filter((group) => group.id !== groupId),
      sharedFields: nextShared,
      detailFields: nextDetail,
    });
  }

  function renderFieldSection(title, scope, layout, updateField, removeField) {
    return (
      <Card className="border-border/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {layout.grouped.map(({ group, fields }) => (
            <div key={group.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                {editMode ? (
                  <Input
                    value={group.label}
                    onChange={(event) => updateGroup(group.id, event.target.value)}
                    className="max-w-sm font-semibold"
                  />
                ) : (
                  <h4 className="text-sm font-semibold text-primary">{group.label}</h4>
                )}
                {editMode && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(group.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {fields.map((field) => (
                  <FieldRowEditor
                    key={field.name}
                    field={field}
                    editMode={editMode}
                    groups={config.groups}
                    scope={scope}
                    highlighted={scrollToFieldName === field.name}
                    onChange={(nextField) => updateField(field.name, nextField)}
                    onRemove={() => removeField(field.name)}
                    onAddGroup={addGroupAndAssignField}
                    inGroup
                  />
                ))}
              </div>
            </div>
          ))}

          {layout.ungrouped.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              {layout.grouped.length > 0 && (
                <Label className="mb-3 block text-xs uppercase tracking-wide text-muted-foreground">
                  Ungrouped
                </Label>
              )}
              <div className="space-y-3">
                {layout.ungrouped.map((field) => (
                  <FieldRowEditor
                    key={field.name}
                    field={field}
                    editMode={editMode}
                    groups={config.groups}
                    scope={scope}
                    highlighted={scrollToFieldName === field.name}
                    onChange={(nextField) => updateField(field.name, nextField)}
                    onRemove={() => removeField(field.name)}
                    onAddGroup={addGroupAndAssignField}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {renderFieldSection(
        `${category.label} Shared Fields`,
        "shared",
        sharedLayout,
        updateSharedField,
        removeSharedField
      )}
      {renderFieldSection(
        `${category.label} Category Details`,
        "detail",
        detailLayout,
        updateDetailField,
        removeDetailField
      )}
    </div>
  );
}
