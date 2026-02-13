import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";

const MeetingTemplates = ({ onSelectTemplate }) => {
  const { user } = useContext(AuthContext);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    title: "",
    agenda: "",
    defaultDuration: 60,
    recurrencePattern: "none",
    isPublic: false,
    tags: ""
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/meetings/templates", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/meetings/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map(tag => tag.trim()).filter(tag => tag),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert("✅ Template created successfully!");
      setShowCreateModal(false);
      setForm({
        name: "",
        description: "",
        title: "",
        agenda: "",
        defaultDuration: 60,
        recurrencePattern: "none",
        isPublic: false,
        tags: ""
      });
      fetchTemplates();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;

    try {
      const res = await fetch(`http://localhost:4000/api/meetings/templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!res.ok) throw new Error("Failed to delete template");

      alert("✅ Template deleted!");
      fetchTemplates();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-700 rounded mb-4"></div>
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Meeting Templates</h2>
          <p className="text-gray-400">Save time by reusing meeting configurations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Template</span>
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-gray-500 text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold mb-2">No Templates Yet</h3>
          <p className="text-gray-400 mb-6">Create your first template to save time on recurring meetings</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div 
              key={template._id} 
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  {template.isPublic && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-900 text-green-300 rounded">
                      Public
                    </span>
                  )}
                </div>
                <div className="text-gray-500 text-sm">
                  Used {template.usedCount} times
                </div>
              </div>

              {template.description && (
                <p className="text-gray-400 text-sm mb-4">{template.description}</p>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Title:</span>
                  <span className="text-gray-300">{template.title || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-gray-300">{template.defaultDuration} minutes</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onSelectTemplate(template)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                >
                  Use Template
                </button>
                {template.createdBy._id === user.id && (
                  <button
                    onClick={() => handleDeleteTemplate(template._id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Create Meeting Template</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Template Name *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <textarea
                placeholder="Description (Optional)"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateTemplate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-medium"
                >
                  Create Template
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingTemplates;