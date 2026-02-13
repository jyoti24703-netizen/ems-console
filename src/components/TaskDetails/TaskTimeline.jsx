import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";

const API_BASE = "http://localhost:4000/api/tasks";

const WORK_ACTIONS_EXCLUDE = new Set([
  "COMMENT_ADDED",
  "MESSAGE_SENT",
  "FILE_UPLOADED",
]);

const TaskTimeline = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = location.state?.returnPath || "/admin";
  const returnState = location.state?.returnState;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/${id}`, {
          headers: {
            Authorization: `Bearer ${user?.token}`,
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load task");
        setTask(data.task);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id && user?.token) {
      fetchTask();
    }
  }, [id, user?.token]);

  const timeline = useMemo(() => {
    const raw = task?.activityTimeline || [];
    const filtered = raw.filter((e) => !WORK_ACTIONS_EXCLUDE.has(e.action));
    return filtered
      .map((event) => ({
        ...event,
        actor: event.actorName || event.performedBy?.name || (event.role === "employee" ? "Employee" : "System"),
      }))
      .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
  }, [task]);

  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString() : "—";

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading timeline...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-400">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Work Timeline</h1>
          <p className="text-sm text-gray-400">{task?.title || "Task"}</p>
        </div>
        <button
          onClick={() => navigate(returnPath, { state: returnState || location.state })}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
        >
          Back
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded p-5 space-y-4">
        {timeline.length === 0 ? (
          <div className="text-gray-500">No work timeline events found.</div>
        ) : (
          timeline.map((event, idx) => (
            <div key={idx} className="flex items-start gap-3 border-b border-gray-800 pb-3 last:border-b-0">
              <div className="text-sm text-gray-400 w-40">{formatDateTime(event.createdAt || event.timestamp)}</div>
              <div className="flex-1">
                <div className="text-sm text-gray-200">
                  {event.action?.replace(/_/g, " ").toLowerCase()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  👤 {event.actor} • {event.role || "system"}
                  {event.targetName && <span className="ml-2">🎯 {event.targetName}</span>}
                </div>
                {event.details && (
                  <div className="text-xs text-gray-400 mt-1">{event.details}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskTimeline;
