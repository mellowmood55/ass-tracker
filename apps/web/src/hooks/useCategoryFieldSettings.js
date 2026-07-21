import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useDataRefresh } from "@/context/DataRefreshContext";

export function useCategoryFieldSettings() {
  const { auth } = useAuth();
  const { version } = useDataRefresh();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/settings/category-fields", {}, auth.token);
      setCategories(data.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings, version]);

  const saveCategory = useCallback(
    async (code, config) => {
      const data = await api(
        `/api/settings/category-fields/${code}`,
        { method: "PUT", body: JSON.stringify(config) },
        auth.token
      );
      await loadSettings();
      return data.config;
    },
    [auth.token, loadSettings]
  );

  return { categories, loading, error, reload: loadSettings, saveCategory };
}
