import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ChipInput({ label, values = [], onChange, placeholder, disabled = false }) {
  const [draft, setDraft] = useState("");

  function addValue(raw) {
    const next = String(raw || "").trim();
    if (!next) return;
    if (values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 pr-1">
            {value}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-transparent"
                onClick={() => onChange(values.filter((entry) => entry !== value))}
                aria-label={`Remove ${value}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && (
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue(draft);
            }
          }}
          onBlur={() => addValue(draft)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
