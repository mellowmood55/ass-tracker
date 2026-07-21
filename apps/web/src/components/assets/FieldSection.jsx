import { DynamicField } from "@/components/assets/DynamicField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupFieldsBySection } from "@/lib/fieldConfig";

function isFieldVisible(field, formState) {
  if (!field.showWhen) return true;
  const value = formState[field.showWhen.field];
  return value === field.showWhen.equals;
}

function renderFields(fields, props) {
  return fields
    .filter((field) => isFieldVisible(field, props.formState))
    .map((field) => (
      <DynamicField
        key={field.name}
        field={field}
        value={props.formState[field.name]}
        onChange={props.onChange}
        selectedCategory={props.selectedCategory}
        activeCategory={props.activeCategory}
        formState={props.formState}
      />
    ));
}

export function FieldSection({
  title,
  fields = [],
  groups = [],
  scope,
  formState,
  onChange,
  selectedCategory,
  activeCategory,
}) {
  const { grouped, ungrouped } = groupFieldsBySection(fields, groups, scope);
  const fieldProps = { formState, onChange, selectedCategory, activeCategory };

  if (fields.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-4">
        {grouped.map(({ group, fields: groupFields }) => {
          const visibleFields = groupFields.filter((field) => isFieldVisible(field, formState));
          if (visibleFields.length === 0) return null;
          return (
            <Card key={group.id} className="border-primary/20 bg-accent/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-primary">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {renderFields(groupFields, fieldProps)}
              </CardContent>
            </Card>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">{renderFields(ungrouped, fieldProps)}</div>
        )}
      </div>
    </div>
  );
}
