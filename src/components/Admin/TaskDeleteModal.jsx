import React, { useState } from "react";
import { API_BASE_URL } from "../../config/api";

const TaskDeleteModal = ({ task, user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!deleteReason.trim() || deleteReason.trim().length < 5) {
      setError("Delete reason required (minimum 5 characters)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/direct-delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          deleteReason: deleteReason.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Task deleted successfully!");
        onSuccess();
      } else {
        setError(data.error || "Failed to delete task");
      }
    } catch (err) {
      console.error("❌ Error deleting task:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full border border-gray-700">
        <div className="p-6">
          <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">⚠️</span> Delete Task
          </h2>

          <div className="bg-red-900/20 border border-red-700 rounded p-3 mb-4">
            <p className="text-sm text-red-300">
              <strong>Task:</strong> {task?.title}
            </p>
            <p className="text-sm text-red-300 mt-2">
              This action will permanently delete this task. It cannot be undone.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Deletion *
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Enter the reason for deleting this task (minimum 5 characters)..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              rows="4"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Characters: {deleteReason.length}
            </p>
          </div>

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
              onClick={handleDelete}
              disabled={loading || deleteReason.trim().length < 5}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span> Deleting...
                </>
              ) : (
                <>
                  🗑️ Delete Task
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDeleteModal;
