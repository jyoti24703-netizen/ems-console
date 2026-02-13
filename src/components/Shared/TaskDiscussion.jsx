import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api";

const TaskDiscussion = ({ taskId, token, role }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${taskId}/messages`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    setMessages(data.discussion || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [taskId]);

  const sendMessage = async () => {
    if (!text.trim()) return;

    await fetch(
      `${API_BASE_URL}/api/tasks/${taskId}/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      }
    );

    setText("");
    fetchMessages();
  };

  return (
    <div className="bg-[#020617] border border-gray-700 p-4 rounded mt-4">
      <h4 className="font-semibold mb-3">Discussion</h4>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded ${
              m.senderRole === "admin"
                ? "bg-blue-900/40"
                : "bg-green-900/40"
            }`}
          >
            <p className="text-xs text-gray-400">
              {m.senderRole === "admin" ? "Admin" : "Employee"}
            </p>
            <p className="text-sm whitespace-pre-wrap">{m.text}</p>
          </div>
        ))}

        {messages.length === 0 && (
          <p className="text-sm text-gray-500">No messages yet.</p>
        )}
      </div>

      <textarea
        className="w-full mt-3 p-2 bg-gray-900 rounded"
        placeholder={
          role === "employee"
            ? "Ask clarification"
            : "Reply to employee"
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        onClick={sendMessage}
        className="mt-2 bg-blue-600 px-4 py-1 rounded"
      >
        Send
      </button>
    </div>
  );
};

export default TaskDiscussion;
