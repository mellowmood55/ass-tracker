export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export const SHARED_FIELD_NAMES = [
  "location",
  "office",
  "model",
  "assetNo",
  "serialNo",
  "status",
];

export const AUTH_STORAGE_KEY = "ass-tracker-auth";

export const PAGE_SIZE = 25;

export const EMPTY_FILTERS = Object.freeze({
  category: "",
  status: "",
  search: "",
});
