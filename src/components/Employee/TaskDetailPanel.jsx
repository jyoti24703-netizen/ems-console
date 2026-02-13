import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";
import EmployeeModificationRequest from "./EmployeeModificationRequest";

const TaskDetailPanel = ({ task, token, onTaskRefresh }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const fetchMessages = async () => {
    const res = await fetch(
      `http://localhost:4000/api/tasks/${task._id}/messages`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    setMessages(data.discussion || []);
  };

  useEffect(() => {
    fetchMessages();
  }, [task._id]);

  const sendMessage = async () => {
    if (!text.trim()) return;

    await fetch(
      `http://localhost:4000/api/tasks/${task._id}/message`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    setText("");
    fetchMessages();
  };

  return (
    <div className="bg-[#020617] border border-gray-700 rounded p-4 mt-6 max-w-xl">
      <h3 className="font-semibold text-lg mb-1">{task.title}</h3>

      <p className="text-sm text-gray-400 mb-3">
        {task.description || "No description"}
      </p>

      {/* ===== DISCUSSION ===== */}
      <div className="border border-gray-700 rounded p-3 mb-3 max-h-[260px] overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500">No discussion yet.</p>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 rounded text-sm ${
              msg.senderRole === "admin"
                ? "bg-blue-900"
                : "bg-green-900"
            }`}
          >
            <p className="text-xs opacity-70">
              {msg.senderRole === "admin" ? "Admin" : "Employee"}
            </p>
            <p>{msg.text}</p>
          </div>
        ))}
      </div>

      {/* ===== REPLY ===== */}
      <textarea
        className="w-full bg-gray-900 p-2 rounded mb-2"
        placeholder="Reply / पूछें…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        onClick={sendMessage}
        className="bg-blue-600 px-4 py-2 rounded"
      >
        Send
      </button>

      {/* ===== MODIFICATION REQUESTS ===== */}
      {task && (
        <EmployeeModificationRequest
          task={task}
          onResponseSubmitted={onTaskRefresh}
        />
      )}
    </div>
  );
};

export default TaskDetailPanel;
