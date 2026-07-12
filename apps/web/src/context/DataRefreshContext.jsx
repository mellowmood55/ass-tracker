import { createContext, useCallback, useContext, useMemo, useState } from "react";

const DataRefreshContext = createContext(null);

export function DataRefreshProvider({ children }) {
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const value = useMemo(() => ({ version, bump }), [version, bump]);

  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
}

export function useDataRefresh() {
  const context = useContext(DataRefreshContext);
  if (!context) {
    throw new Error("useDataRefresh must be used within DataRefreshProvider");
  }
  return context;
}
