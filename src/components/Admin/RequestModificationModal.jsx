import React, { useState } from "react";

const RequestModificationModal = ({ task, user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [requestType, setRequestType] = useState("edit");
  const [slaHours, setSlaHours] = useState(24);
  const [proposedChanges, setProposedChanges] = useState({
    title: task?.title || "",
    description: task?.description || "",
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    category: task?.category || "",
    priority: task?.priority || ""
  });
  const [impactNote, setImpactNote] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim() || reason.length < 10) {
      setError("Reason required (minimum 10 characters)");
      return;
    }
    if (Number(slaHours) < 1 || Number(slaHours) > 168) {
      setError("Response SLA must be between 1 and 168 hours");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${task._id}/request-modification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          requestType,
          reason: reason.trim(),
          slaHours: Number(slaHours) || 24,
          proposedChanges: requestType === "edit" ? proposedChanges : undefined,
          impactNote: requestType === "delete" ? impactNote : undefined
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Modification request sent to employee!");
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to send request");
      }
    } catch (err) {
      console.error("Error:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full border border-gray-700">
        <div className="p-6">
          <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span> Request Modification
          </h2>

          <div className="bg-purple-900/20 border border-purple-700 rounded p-3 mb-4">
            <p className="text-sm text-purple-300">
              <strong>Task:</strong> {task?.title}
            </p>
            <p className="text-sm text-purple-300 mt-2">
              Send a modification request to the employee. They can approve or decline.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Modification Type *
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            >
              <option value="edit">Edit Task</option>
              <option value="delete">Delete Task</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Response SLA (hours) *
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[12, 24, 48, 72].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSlaHours(h)}
                  className={`px-2 py-1 rounded text-xs border ${
                    Number(slaHours) === h
                      ? "bg-purple-700 border-purple-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="168"
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">Employee must respond within this time.</p>
            <p className="text-xs text-gray-500 mt-1">
              Response due by: {new Date(Date.now() + (Number(slaHours) || 24) * 60 * 60 * 1000).toLocaleString("en-GB")}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Modification *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need to modify this task (minimum 10 characters)..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              rows="4"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Characters: {reason.length}
            </p>
          </div>

          {requestType === "edit" && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-200 mb-2">Proposed Changes</h4>
              <div className="space-y-3">
                <input
                  value={proposedChanges.title}
                  onChange={(e) => setProposedChanges({ ...proposedChanges, title: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
                <textarea
                  value={proposedChanges.description}
                  onChange={(e) => setProposedChanges({ ...proposedChanges, description: e.target.value })}
                  placeholder="Description"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows="3"
                />
                <input
                  type="date"
                  value={proposedChanges.dueDate}
                  onChange={(e) => setProposedChanges({ ...proposedChanges, dueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
                <select
                  value={proposedChanges.priority}
                  onChange={(e) => setProposedChanges({ ...proposedChanges, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="">Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}

          {requestType === "delete" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deletion Impact Note *
              </label>
              <textarea
                value={impactNote}
                onChange={(e) => setImpactNote(e.target.value)}
                placeholder="Explain impact of deletion (minimum 10 characters)..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                rows="3"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                loading ||
                reason.trim().length < 10 ||
                (requestType === "delete" && impactNote.trim().length < 10)
              }
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span> Sending...
                </>
              ) : (
                <>
                  📤 Send Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestModificationModal;
