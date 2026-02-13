import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config/api";

const DiscussionSummary = ({ task }) => {
  const [discussion, setDiscussion] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!task?._id) return;

    setLoading(true);

    fetch(`${API_BASE_URL}/api/tasks/${task._id}/messages`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        console.log("DISCUSSION API RESPONSE:", data);
        setDiscussion(data.discussion || []);
      })
      .catch(err => console.error("Discussion fetch error:", err))
      .finally(() => setLoading(false));
  }, [task?._id]);

  if (!task) {
    return <div className="text-gray-400">Select a task</div>;
  }

  if (loading) {
    return <div className="text-gray-400">Loading discussion…</div>;
  }

  if (!discussion.length) {
    return <div className="text-gray-400">No discussion available</div>;
  }

  return (
    <div className="space-y-3">
      {discussion.map((msg, i) => (
        <div
          key={i}
          className={`p-3 rounded ${
            msg.senderRole === "admin"
              ? "bg-blue-900"
              : "bg-green-900"
          }`}
        >
          <div className="text-xs text-gray-400 mb-1">
            {msg.senderRole.toUpperCase()} •{" "}
            {msg.createdAt
              ? new Date(msg.createdAt).toLocaleString()
              : "—"}
          </div>
          <div className="text-white text-sm">
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiscussionSummary;


















