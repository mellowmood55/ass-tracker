import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const sharedFieldNames = ["location", "office", "model", "assetNo", "serialNo", "status"];

const CATEGORY_LIST_COLUMNS = {
  computer: [
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Location", value: (asset) => asset.location || "-" },
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Computer Type", value: (asset) => asset.details?.deviceType || "-" },
    { label: "OS Installed", value: (asset) => asset.details?.osInstalled || "-" },
    {
      label: "Antivirus Installed",
      value: (asset) => (asset.details?.antivirusInstalled ? "Yes" : "No"),
    },
    {
      label: "Antivirus Type",
      value: (asset) => asset.details?.antivirusType || "-",
    },
    {
      label: "Remaining Days",
      value: (asset) => asset.details?.remainingSubscriptionDays ?? "-",
    },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  printer: [
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  software: [
    { label: "Description", value: (asset) => asset.details?.description || "-" },
    { label: "Function", value: (asset) => asset.details?.function || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  ups: [
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  network: [
    { label: "Location", value: (asset) => asset.location || "-" },
    { label: "Item", value: (asset) => asset.details?.item || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  other: [
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Item", value: (asset) => asset.details?.item || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Serial No", value: (asset) => asset.serialNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
  mobile: [
    { label: "Office", value: (asset) => asset.office || "-" },
    { label: "Model", value: (asset) => asset.model || "-" },
    { label: "Asset No", value: (asset) => asset.assetNo || "-" },
    { label: "Status", value: (asset) => asset.status || "-" },
  ],
};

function App() {
  const [auth, setAuth] = useState({ token: "", user: null });
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "admin123" });
  const [loginError, setLoginError] = useState("");

  const [categories, setCategories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [insights, setInsights] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState({});
  const [activePage, setActivePage] = useState("form");

  const [filters, setFilters] = useState({ category: "", status: "", search: "" });

  const activeCategory = useMemo(
    () => categories.find((category) => category.code === selectedCategory),
    [categories, selectedCategory]
  );

  const assetsByCategory = useMemo(() => {
    return categories.reduce((accumulator, category) => {
      accumulator[category.code] = assets.filter((asset) => asset.category === category.code);
      return accumulator;
    }, {});
  }, [assets, categories]);

  const visibleCategories = useMemo(() => {
    if (filters.category) {
      return categories.filter((category) => category.code === filters.category);
    }

    return categories;
  }, [categories, filters.category]);

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    loadCategories(auth.token);
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    loadAssets(auth.token);
  }, [auth.token, filters]);

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    loadInsights(auth.token);
  }, [auth.token, filters]);

  function makeInitialFormState(category) {
    if (!category) {
      return {};
    }

    const state = {};

    for (const field of category.sharedFields) {
      state[field.name] = field.type === "boolean" ? false : "";
    }

    for (const field of category.detailFields) {
      state[field.name] = field.type === "boolean" ? false : "";
    }

    return state;
  }

  async function api(path, options = {}, tokenOverride) {
    const token = tokenOverride || auth.token;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const data =
      response.status === 204
        ? null
        : contentType.includes("application/json")
          ? await response.json()
          : await response.text();
    if (!response.ok) {
      const messageText =
        (data && typeof data === "object" && data?.errors?.join(" ")) ||
        (data && typeof data === "object" && data?.message) ||
        (typeof data === "string" ? data : "Request failed.");
      throw new Error(messageText);
    }

    return data;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      setAuth({ token: data.token, user: data.user });
    } catch (apiError) {
      setLoginError(apiError.message);
    }
  }

  async function loadCategories(token) {
    try {
      const data = await api("/api/categories", {}, token);
      setCategories(data.categories);
      if (data.categories.length > 0) {
        const firstCategory = data.categories[0];
        setSelectedCategory(firstCategory.code);
        setFormState(makeInitialFormState(firstCategory));
      }
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  async function loadAssets(token) {
    const query = new URLSearchParams();
    if (filters.category) {
      query.set("category", filters.category);
    }
    if (filters.status) {
      query.set("status", filters.status);
    }
    if (filters.search) {
      query.set("search", filters.search);
    }

    try {
      const data = await api(`/api/assets${query.toString() ? `?${query.toString()}` : ""}`, {}, token);
      setAssets(data.assets);
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  async function loadInsights(token) {
    const query = new URLSearchParams();
    if (filters.category) {
      query.set("category", filters.category);
    }
    if (filters.status) {
      query.set("status", filters.status);
    }
    if (filters.search) {
      query.set("search", filters.search);
    }

    try {
      const data = await api(`/api/insights${query.toString() ? `?${query.toString()}` : ""}`, {}, token);
      setInsights(data);
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  async function refreshData(token, nextFilters = filters) {
    const query = new URLSearchParams();
    if (nextFilters.category) {
      query.set("category", nextFilters.category);
    }
    if (nextFilters.status) {
      query.set("status", nextFilters.status);
    }
    if (nextFilters.search) {
      query.set("search", nextFilters.search);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const [assetsData, insightsData] = await Promise.all([
      api(`/api/assets${suffix}`, {}, token),
      api(`/api/insights${suffix}`, {}, token),
    ]);

    setAssets(assetsData.assets);
    setInsights(insightsData);
  }

  function handleCategoryChange(code) {
    const category = categories.find((entry) => entry.code === code);
    setSelectedCategory(code);
    setEditingId(null);
    setFormState(makeInitialFormState(category));
    setMessage("");
    setError("");
  }

  function handleFieldChange(fieldName, value) {
    setFormState((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function payloadFromForm() {
    const shared = {};
    const details = {};

    for (const name of sharedFieldNames) {
      if (Object.prototype.hasOwnProperty.call(formState, name)) {
        shared[name] = formState[name];
      }
    }

    if (activeCategory) {
      for (const field of activeCategory.detailFields) {
        details[field.name] = formState[field.name];
      }
    }

    return {
      category: selectedCategory,
      ...shared,
      details,
    };
  }

  async function handleExport(format, exportFilters = filters) {
    setError("");
    setMessage("");

    try {
      const query = new URLSearchParams();
      if (exportFilters.category) {
        query.set("category", exportFilters.category);
      }
      if (exportFilters.status) {
        query.set("status", exportFilters.status);
      }
      if (exportFilters.search) {
        query.set("search", exportFilters.search);
      }

      const endpoint = format === "xlsx" ? "/api/reports/assets.xlsx" : "/api/reports/assets.pdf";
      const response = await fetch(
        `${API_BASE}${endpoint}${query.toString() ? `?${query.toString()}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to export report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const selectedCategoryLabel =
        categories.find((category) => category.code === exportFilters.category)?.label || "all-categories";
      const filenamePrefix = selectedCategoryLabel.toLowerCase().replace(/\s+/g, "-");
      anchor.download =
        format === "xlsx" ? `${filenamePrefix}-asset-report.xlsx` : `${filenamePrefix}-asset-report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage(`Downloaded ${format.toUpperCase()} report.`);
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  async function handleSaveAsset(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = payloadFromForm();
      let savedAsset;
      if (editingId) {
        const response = await api(`/api/assets/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        savedAsset = response.asset;
        setMessage("Asset updated.");
      } else {
        const response = await api("/api/assets", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        savedAsset = response.asset;
        setMessage("Asset created.");
      }

      const category = categories.find((entry) => entry.code === selectedCategory);
      setFormState(makeInitialFormState(category));
      setEditingId(null);
      if (savedAsset) {
        setAssets((current) => {
          const withoutSaved = current.filter((asset) => asset.id !== savedAsset.id);
          return [savedAsset, ...withoutSaved];
        });
      }
      await refreshData(auth.token);
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  function handleEditAsset(asset) {
    const category = categories.find((entry) => entry.code === asset.category);
    if (!category) {
      return;
    }

    const nextState = makeInitialFormState(category);

    for (const field of category.sharedFields) {
      nextState[field.name] = asset[field.name] ?? nextState[field.name];
    }

    for (const field of category.detailFields) {
      nextState[field.name] = asset.details?.[field.name] ?? nextState[field.name];
    }

    setSelectedCategory(asset.category);
    setFormState(nextState);
    setEditingId(asset.id);
    setMessage(`Editing asset #${asset.id}`);
    setError("");
  }

  async function handleDeleteAsset(assetId) {
    setMessage("");
    setError("");

    try {
      await api(`/api/assets/${assetId}`, { method: "DELETE" });
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setMessage("Asset deleted.");
      await refreshData(auth.token);
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  function renderCategoryAssetCard(category) {
    const categoryAssets = assetsByCategory[category.code] || [];
    const columns = CATEGORY_LIST_COLUMNS[category.code] || [];

    return (
      <section className="category-panel glow-card-hover" key={category.code}>
        <header className="category-panel-header">
          <div>
            <h3>{category.label}</h3>
            <p className="muted">{categoryAssets.length} recorded asset{categoryAssets.length === 1 ? "" : "s"}</p>
          </div>
        </header>

        <div className="table-wrapper category-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                {columns.map((column) => (
                  <th key={column.label}>{column.label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categoryAssets.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2}>No records in this category.</td>
                </tr>
              ) : (
                categoryAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>{asset.id}</td>
                    {columns.map((column) => (
                      <td key={`${asset.id}-${column.label}`}>{column.value(asset)}</td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-small" type="button" onClick={() => handleEditAsset(asset)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          type="button"
                          onClick={() => handleDeleteAsset(asset.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderField(field, isDetail = false) {
    const value = formState[field.name];
    const fieldId = `${isDetail ? "detail" : "shared"}-${field.name}`;

    if (
      selectedCategory === "computer" &&
      ["antivirusType", "remainingSubscriptionDays"].includes(field.name) &&
      !formState.antivirusInstalled
    ) {
      return null;
    }

    if (field.type === "boolean") {
      return (
        <label className="switch" htmlFor={fieldId} key={field.name}>
          <input
            id={fieldId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => handleFieldChange(field.name, event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === "select") {
      const options = field.options || (field.name === "status" ? activeCategory?.statuses || [] : []);

      return (
        <label className="field" htmlFor={fieldId} key={field.name}>
          <span>{field.label}</span>
          <select
            id={fieldId}
            value={value || ""}
            onChange={(event) => handleFieldChange(field.name, event.target.value)}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {options.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "number") {
      return (
        <label className="field" htmlFor={fieldId} key={field.name}>
          <span>{field.label}</span>
          <input
            id={fieldId}
            type="number"
            min="0"
            value={value ?? ""}
            onChange={(event) => handleFieldChange(field.name, event.target.value)}
            placeholder={field.label}
          />
        </label>
      );
    }

    return (
      <label className="field" htmlFor={fieldId} key={field.name}>
        <span>{field.label}</span>
        <input
          id={fieldId}
          type="text"
          value={value || ""}
          onChange={(event) => handleFieldChange(field.name, event.target.value)}
          placeholder={field.label}
        />
      </label>
    );
  }

  function getRiskLabel(asset) {
    const outdatedWindows = ["Windows 7", "Windows 8", "Windows 8.1"];
    const antivirusDays = Number(asset.remainingSubscriptionDays);

    if (asset.antivirusInstalled === false || asset.antivirusInstalled === null || asset.antivirusInstalled === undefined) {
      return "Missing Antivirus";
    }

    if (asset.antivirusInstalled === true && Number.isFinite(antivirusDays) && antivirusDays <= 0) {
      return "Antivirus Expired";
    }

    if (asset.antivirusInstalled === true && Number.isFinite(antivirusDays) && antivirusDays > 0 && antivirusDays <= 30) {
      return "Antivirus Expiring Soon";
    }

    if (asset.osInstalled && outdatedWindows.includes(asset.osInstalled)) {
      return "Outdated OS";
    }

    return "Healthy";
  }

  if (!auth.token) {
    return (
      <main className="app login-layout">
        <section className="panel login-panel">
          <p className="eyebrow">ICT Asset Tracker</p>
          <h1>Sign in to continue</h1>
          <p className="muted">Default credentials for first startup: admin / admin123</p>

          <form className="form" onSubmit={handleLogin}>
            <label className="field" htmlFor="username">
              <span>Username</span>
              <input
                id="username"
                type="text"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>

            <label className="field" htmlFor="password">
              <span>Password</span>
              <input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>

            {loginError && <p className="error">{loginError}</p>}

            <button className="btn btn-primary" type="submit">
              Login
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="top-bar">
        <div>
          <p className="eyebrow">ICT Asset Tracker</p>
          <h1>Asset Register</h1>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setAuth({ token: "", user: null });
            setCategories([]);
            setAssets([]);
          }}
        >
          Logout ({auth.user?.username})
        </button>
      </header>

      <section className="panel glow-card-hover page-switcher">
        <div className="actions">
          <button className={`btn ${activePage === "form" ? "btn-primary" : ""}`} type="button" onClick={() => setActivePage("form")}>Asset Entry</button>
          <button className={`btn ${activePage === "assets" ? "btn-primary" : ""}`} type="button" onClick={() => setActivePage("assets")}>Asset Browser</button>
        </div>
      </section>

      {activePage === "form" && (
        <>
      <section className="panel glow-card-hover">
        <h2>Smart Insights</h2>
        <div className="insights-grid">
          <div className="insight-card warning">
            <span>Missing Antivirus</span>
            <strong>{insights?.totals.missingAntivirus ?? 0}</strong>
          </div>
          <div className="insight-card warning">
            <span>Antivirus Expired</span>
            <strong>{insights?.totals.antivirusExpired ?? 0}</strong>
          </div>
          <div className="insight-card warning glow-alert-pulse">
            <span>Antivirus Expiring Soon</span>
            <strong>{insights?.totals.antivirusExpiringSoon ?? 0}</strong>
          </div>
        </div>

        <div className="recommendations">
          <h3>Recommended actions</h3>
          <ul>
            {(insights?.recommendations || ["No insights available yet."]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel glow-card-hover">
        <h2>{editingId ? "Edit Asset" : "Add Asset"}</h2>

        <label className="field" htmlFor="asset-category">
          <span>Category</span>
          <select
            id="asset-category"
            value={selectedCategory}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            {categories.map((category) => (
              <option value={category.code} key={category.code}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <form className="form" onSubmit={handleSaveAsset}>
          <div className="grid">
            {activeCategory?.sharedFields.map((field) => renderField(field, false))}
          </div>

          {activeCategory?.detailFields.length > 0 && (
            <>
              <h3>Category Details</h3>
              <div className="grid">
                {activeCategory.detailFields.map((field) => renderField(field, true))}
              </div>
            </>
          )}

          <div className="actions">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Update Asset" : "Save Asset"}
            </button>
            {editingId && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  const category = categories.find((entry) => entry.code === selectedCategory);
                  setFormState(makeInitialFormState(category));
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
        </>
      )}

      {activePage === "assets" && (
      <section className="panel glow-card-hover asset-browser-page">
        <h2>Assets</h2>
        <div className="filters">
          <label className="field" htmlFor="filter-category">
            <span>Category</span>
            <select
              id="filter-category"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="filter-search">
            <span>Search</span>
            <input
              id="filter-search"
              type="text"
              value={filters.search}
              placeholder="Asset no, serial, office..."
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </label>
        </div>

        <div className="actions report-actions">
          <button className="btn" type="button" onClick={() => handleExport("xlsx")}>Export Excel</button>
          <button className="btn" type="button" onClick={() => handleExport("pdf")}>Export PDF</button>
        </div>

        <div className="actions report-actions category-actions">
          {categories.map((category) => (
            <button
              className="btn btn-small"
              key={`export-${category.code}`}
              type="button"
              onClick={() => {
                handleExport("xlsx", { ...filters, category: category.code });
              }}
            >
              {category.label} Excel
            </button>
          ))}
        </div>

        <div className="category-list">
          {visibleCategories.length === 0 ? (
            <p className="muted">No categories available.</p>
          ) : (
            visibleCategories.map((category) => renderCategoryAssetCard(category))
          )}
        </div>
      </section>
      )}
    </main>
  );
}

export default App;
