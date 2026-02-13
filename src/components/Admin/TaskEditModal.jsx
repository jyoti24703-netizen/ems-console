import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";

export default function TaskEditModal({ task, user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    dueDate: "",
    priority: "medium"
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        category: task.category || "",
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
        priority: task.priority || "medium"
      });
    }
  }, [task]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDirectEdit = async () => {
    if (!formData.title.trim()) {
      alert("Title is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/direct-edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          dueDate: formData.dueDate,
          priority: formData.priority,
          editNote: "Direct edit by admin"
        })
      });

      const data = await res.json();
      
      if (data.success) {
        alert("✅ Task updated successfully!");
        onSuccess();
        onClose();
      } else {
        alert(data.error || "Failed to edit task");
      }
    } catch (error) {
      console.error("Direct edit error:", error);
      alert("Error editing task");
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-white mb-4">✏️ Edit Task</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
                rows="3"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Due Date</label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
              />
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleDirectEdit}
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
              >
                {loading ? "Saving..." : "💾 Save Changes"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}