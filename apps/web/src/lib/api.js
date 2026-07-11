import { API_BASE } from "./constants";

export function buildAssetQuery(filters = {}) {
  const query = new URLSearchParams();
  if (filters.category) query.set("category", filters.category);
  if (filters.status) query.set("status", filters.status);
  if (filters.search) query.set("search", filters.search);
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function api(path, options = {}, token) {
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

export async function downloadReport(token, format, filters = {}) {
  const suffix = buildAssetQuery(filters);
  const endpoint = format === "xlsx" ? "/api/reports/assets.xlsx" : "/api/reports/assets.pdf";
  const response = await fetch(`${API_BASE}${endpoint}${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to export report.");
  }

  return response.blob();
}
