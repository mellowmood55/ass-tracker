import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function DynamicField({ field, value, onChange, selectedCategory, activeCategory, formState }) {
  if (
    selectedCategory === "computer" &&
    ["antivirusType", "remainingSubscriptionDays"].includes(field.name) &&
    !formState.antivirusInstalled
  ) {
    return null;
  }

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
        <Label htmlFor={field.name} className="cursor-pointer">
          {field.label}
        </Label>
        <Switch
          id={field.name}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(field.name, checked)}
        />
      </div>
    );
  }

  if (field.type === "select") {
    const options = field.options || (field.name === "status" ? activeCategory?.statuses || [] : []);
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>{field.label}</Label>
        <Select value={value || ""} onValueChange={(next) => onChange(field.name, next)}>
          <SelectTrigger id={field.name}>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>{field.label}</Label>
        <Input
          id={field.name}
          type="number"
          min="0"
          value={value ?? ""}
          onChange={(event) => onChange(field.name, event.target.value)}
          placeholder={field.label}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{field.label}</Label>
      <Input
        id={field.name}
        type="text"
        value={value || ""}
        onChange={(event) => onChange(field.name, event.target.value)}
        placeholder={field.label}
      />
    </div>
  );
}
