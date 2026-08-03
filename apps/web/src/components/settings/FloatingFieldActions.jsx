import { useEffect, useRef, useState } from "react";
import { ArrowUp, FolderPlus, Pencil, PencilOff, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function FloatingFieldActions({
  editMode,
  onEditModeChange,
  onSave,
  onAddField,
  onAddGroup,
  onScrollToTop,
  disabled,
  saving,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const actionsDisabled = disabled || !editMode;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-24 right-4 z-30 flex flex-col-reverse items-center gap-2 md:bottom-6 md:right-6"
    >
      <Button
        type="button"
        size="icon"
        className={cn("h-12 w-12 rounded-full shadow-lg", open && "bg-primary/90")}
        aria-label={open ? "Close toolkit" : "Open toolkit"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
      </Button>

      {open && (
        <div className="flex flex-col-reverse items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Button
            type="button"
            variant={editMode ? "default" : "outline"}
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            aria-label={editMode ? "Disable edit fields" : "Enable edit fields"}
            aria-pressed={editMode}
            onClick={() => onEditModeChange?.(!editMode)}
          >
            {editMode ? (
              <Pencil className="h-4 w-4" aria-hidden />
            ) : (
              <PencilOff className="h-4 w-4" aria-hidden />
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            aria-label="Scroll to top"
            onClick={onScrollToTop}
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            type="button"
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            aria-label="Save changes"
            disabled={actionsDisabled || saving}
            onClick={onSave}
          >
            {saving ? (
              <Spinner className="h-4 w-4" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            aria-label="Add field"
            disabled={actionsDisabled}
            onClick={onAddField}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            aria-label="Add group"
            disabled={actionsDisabled}
            onClick={onAddGroup}
          >
            <FolderPlus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
