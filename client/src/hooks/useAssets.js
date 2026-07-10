import { useCallback, useEffect, useState } from "react";
import { api, buildAssetQuery } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function useAssets(filters) {
  const { auth } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filtersKey = JSON.stringify(filters);

  const loadAssets = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError("");
    try {
      const parsedFilters = JSON.parse(filtersKey);
      const data = await api(`/api/assets${buildAssetQuery(parsedFilters)}`, {}, auth.token);
      setAssets(data.assets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token, filtersKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAssets();
  }, [loadAssets]);

  return { assets, setAssets, loading, error, reload: loadAssets };
}
