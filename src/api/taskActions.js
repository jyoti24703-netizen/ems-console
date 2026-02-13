import { API_BASE_URL } from "../config/api";
const API_BASE = `${API_BASE_URL}/api/tasks`;

const getToken = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  return user?.token;
};

const request = async (url, method, body) => {
  const token = getToken();

  if (!token) {
    throw new Error("No auth token found");
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 🔴 IMPORTANT: read raw text first
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || "Request failed");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from server");
  }
};

/* ===============================
   EXISTING FUNCTIONS (UNCHANGED)
================================ */

export const acceptTask = (id) =>
  request(`${API_BASE}/${id}/accept`, "PATCH");

export const rejectTask = (id) =>
  request(`${API_BASE}/${id}/reject`, "PATCH");

export const completeTask = (id) =>
  request(`${API_BASE}/${id}/complete`, "PATCH");

/* ===============================
   ✅ NEW: CREATE TASK (ADMIN)
   POST /api/tasks
================================ */

export const createTask = (payload) =>
  request(`${API_BASE}`, "POST", payload);

/* ===============================
   ✅ OPTIONAL (FOR TABS LATER)
================================ */

export const getAllTasks = () =>
  request(`${API_BASE}`, "GET");


