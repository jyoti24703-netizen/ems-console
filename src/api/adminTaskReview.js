const API = "http://localhost:4000/api/tasks";

export const approveTask = async (taskId, token) => {
  const res = await fetch(`${API}/${taskId}/verify`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Approve failed");
  return res.json();
};

export const rejectTask = async (taskId, reason, token) => {
  const res = await fetch(`${API}/${taskId}/reopen`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) throw new Error("Reject failed");
  return res.json();
};

