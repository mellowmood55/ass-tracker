import { ArrowUp, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function FloatingFieldActions({
  onSave,
  onAddField,
  onAddGroup,
  onScrollToTop,
  disabled,
  saving,
}) {
  return (
    <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-2 md:bottom-6 md:right-6">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shadow-lg"
        aria-label="Scroll to top"
        onClick={onScrollToTop}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        className="shadow-lg"
        disabled={disabled || saving}
        onClick={onSave}
      >
        {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        Save changes
      </Button>
      <Button type="button" variant="secondary" className="shadow-lg" disabled={disabled} onClick={onAddField}>
        <Plus className="h-4 w-4" />
        Add Field
      </Button>
      <Button type="button" variant="outline" className="shadow-lg" disabled={disabled} onClick={onAddGroup}>
        <Plus className="h-4 w-4" />
        Add Group
      </Button>
    </div>
  );
}
