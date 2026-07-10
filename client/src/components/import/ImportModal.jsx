import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportWizard } from "@/components/import/ImportWizard";

/** Thin dialog wrapper around ImportWizard for optional modal use. Prefer /import page. */
export function ImportModal({ open, onOpenChange, categories, onImported }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            Headers don’t need to match exactly — upload a file, review the column mapping, then
            import.
          </DialogDescription>
        </DialogHeader>
        <ImportWizard
          categories={categories}
          onImported={() => onImported?.()}
          onFinished={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
