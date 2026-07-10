import { useCallback, useEffect, useState } from "react";
import { api, buildAssetQuery } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useDataRefresh } from "@/context/DataRefreshContext";

export function useInsights(filters) {
  const { auth } = useAuth();
  const { version } = useDataRefresh();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filtersKey = JSON.stringify(filters);

  const loadInsights = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError("");
    try {
      const parsedFilters = JSON.parse(filtersKey);
      const data = await api(`/api/insights${buildAssetQuery(parsedFilters)}`, {}, auth.token);
      setInsights(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token, filtersKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInsights();
  }, [loadInsights, version]);

  return { insights, loading, error, reload: loadInsights };
}
