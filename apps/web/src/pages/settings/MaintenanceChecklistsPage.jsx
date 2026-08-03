import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CADENCES = ["quarterly", "monthly"];
const CATEGORIES = ["computer", "printer"];

function draftKey(cadence, category) {
  return `${cadence}:${category}`;
}

export function MaintenanceChecklistsPage() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [cadence, setCadence] = useState("quarterly");
  const [category, setCategory] = useState("computer");

  async function load() {
    setLoading(true);
    try {
      const data = await api("/api/maintenance/templates", {}, auth.token);
      const list = data.templates || [];
      const nextDrafts = {};
      for (const c of CADENCES) {
        for (const cat of CATEGORIES) {
          const template = list.find((entry) => entry.cadence === c && entry.category === cat);
          nextDrafts[draftKey(c, cat)] = {
            name: template?.name || `${cat} ${c} checklist`,
            items: (template?.items || []).map((item) => ({
              label: item.label,
              descriptionHint: item.descriptionHint || "",
            })),
          };
        }
      }
      setDrafts(nextDrafts);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [auth.token]);

  function updateItem(key, index, patch) {
    setDrafts((current) => {
      const draft = current[key] || { name: "", items: [] };
      const items = draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
      return { ...current, [key]: { ...draft, items } };
    });
  }

  function addItem(key) {
    setDrafts((current) => {
      const draft = current[key] || { name: "", items: [] };
      return {
        ...current,
        [key]: {
          ...draft,
          items: [...draft.items, { label: "New checklist item", descriptionHint: "" }],
        },
      };
    });
  }

  function removeItem(key, index) {
    setDrafts((current) => {
      const draft = current[key];
      return {
        ...current,
        [key]: {
          ...draft,
          items: draft.items.filter((_, i) => i !== index),
        },
      };
    });
  }

  async function handleSave() {
    const key = draftKey(cadence, category);
    const draft = drafts[key];
    if (!draft) return;
    setSaving(true);
    try {
      await api(
        `/api/settings/maintenance-checklists/${cadence}/${category}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: draft.name,
            items: draft.items.filter((item) => String(item.label || "").trim()),
          }),
        },
        auth.token
      );
      toast.success(`${cadence} ${category} checklist saved.`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Alert>
        <AlertDescription>
          Edit quarterly and monthly checklists for computers and printers. These items appear on
          the in-app maintenance form only and are not printed on the change-request PDF.
        </AlertDescription>
      </Alert>

      <div
        role="group"
        aria-label="Checklist cadence view"
        className="flex w-full flex-wrap gap-2"
      >
        <Button
          type="button"
          className="flex-1 sm:flex-none"
          variant={cadence === "quarterly" ? "default" : "outline"}
          onClick={() => setCadence("quarterly")}
          aria-pressed={cadence === "quarterly"}
        >
          Quarterly
        </Button>
        <Button
          type="button"
          className="flex-1 sm:flex-none"
          variant={cadence === "monthly" ? "default" : "outline"}
          onClick={() => setCadence("monthly")}
          aria-pressed={cadence === "monthly"}
        >
          Monthly
        </Button>
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          {CATEGORIES.map((code) => (
            <TabsTrigger key={code} value={code} className="capitalize">
              {code}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((code) => {
          const key = draftKey(cadence, code);
          const draft = drafts[key] || { name: "", items: [] };
          return (
            <TabsContent key={key} value={code} className="space-y-4">
              <div className="space-y-2">
                <Label>Checklist name</Label>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [key]: { ...draft, name: event.target.value },
                    }))
                  }
                />
              </div>
              {draft.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row"
                >
                  <div className="flex-1 space-y-2">
                    <Label>What is to be done</Label>
                    <Input
                      value={item.label}
                      onChange={(event) =>
                        updateItem(key, index, { label: event.target.value })
                      }
                    />
                    <Label>Description hint (optional)</Label>
                    <Input
                      value={item.descriptionHint || ""}
                      placeholder="Hint for notes on the form"
                      onChange={(event) =>
                        updateItem(key, index, {
                          descriptionHint: event.target.value,
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="self-start"
                    onClick={() => removeItem(key, index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => addItem(key)}>
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving && <Spinner className="mr-2" />}
                  Save checklist
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
