import { API_BASE_URL } from "../../config/api";
﻿import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";

const AdminNoticePanel = () => {
  const { user } = useContext(AuthContext);
  const [notices, setNotices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editNotice, setEditNotice] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    priority: "medium",
    expiresAt: ""
  });
  const [readersOpen, setReadersOpen] = useState({});
  const [noticeDiscussionOpen, setNoticeDiscussionOpen] = useState({});
  const [noticeMessageDrafts, setNoticeMessageDrafts] = useState({});
  const [showExpired, setShowExpired] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "medium",
    targetType: "all",
    selectedEmployees: [],
    expiresAt: ""
  });

  // Fetch notices
  const fetchNotices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notices?includeExpired=true`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotices(data.notices || []);
      }
    } catch (err) {
      console.error("Failed to fetch notices:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchNotices();
  }, []);

  // Send notice
  const handleSendNotice = async () => {
    try {
      if (!form.title.trim() || !form.content.trim()) {
        alert("Title and content are required");
        return;
      }

      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        priority: form.priority,
        targetType: form.targetType === "all" ? "all" : "specific",
        specificUsers: form.selectedEmployees.length > 0 ? form.selectedEmployees : undefined,
        expiresAt: form.expiresAt || undefined
      };

      console.log("Sending payload:", payload);

      const res = await fetch(`${API_BASE_URL}/api/notices/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("Response:", data);
      
      if (!res.ok) {
        throw new Error(data.error || `Failed to send notice: ${res.status}`);
      }

      alert("Notice sent successfully!");
      setShowCreateModal(false);
      setForm({
        title: "",
        content: "",
        priority: "medium",
        targetType: "all",
        selectedEmployees: [],
        expiresAt: ""
      });
      fetchNotices();
    } catch (err) {
      console.error("Send notice error:", err);
      alert(`Error: ${err.message}`);
    }
  };

  // Toggle employee selection
  const toggleEmployee = (employeeId) => {
    setForm(prev => ({
      ...prev,
      selectedEmployees: prev.selectedEmployees.includes(employeeId)
        ? prev.selectedEmployees.filter(id => id !== employeeId)
        : [...prev.selectedEmployees, employeeId]
    }));
  };

  const getNoticeEditMeta = (notice) => {
    const base = notice.sendAt || notice.createdAt;
    if (!base) return { canEdit: false, remainingMs: 0 };
    const editWindowMs = 15 * 60 * 1000;
    const remainingMs = editWindowMs - (Date.now() - new Date(base).getTime());
    return { canEdit: remainingMs > 0, remainingMs };
  };

  const handleOpenEdit = (notice) => {
    setEditNotice(notice);
    setEditForm({
      title: notice.title || "",
      content: notice.content || "",
      priority: notice.priority || "medium",
      expiresAt: notice.expiresAt ? new Date(notice.expiresAt).toISOString().slice(0, 16) : ""
    });
  };

  const handleUpdateNotice = async () => {
    if (!editNotice) return;
    if (!editForm.title.trim() || !editForm.content.trim()) {
      alert("Title and content are required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/notices/${editNotice._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          title: editForm.title.trim(),
          content: editForm.content.trim(),
          priority: editForm.priority,
          expiresAt: editForm.expiresAt || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update notice");
      }
      setEditNotice(null);
      fetchNotices();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm("Delete this notice?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notices/${noticeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete notice");
      }
      fetchNotices();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const sendNoticeMessage = async (noticeId) => {
    const text = (noticeMessageDrafts[noticeId] || "").trim();
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notices/${noticeId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }
      setNoticeMessageDrafts(prev => ({ ...prev, [noticeId]: "" }));
      fetchNotices();
    } catch (err) {
      alert(err.message || "Failed to send message");
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-gray-600",
      medium: "bg-blue-600",
      high: "bg-yellow-600",
      critical: "bg-red-700",
      urgent: "bg-red-600"
    };
    return colors[priority] || "bg-blue-600";
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      low: "LOW",
      medium: "MED",
      high: "HIGH",
      critical: "CRIT",
      urgent: "URG"
    };
    return icons[priority] || "MED";
  };

  const visibleNotices = notices.filter((notice) => {
    const title = (notice.title || "").toLowerCase();
    const category = (notice.category || "").toLowerCase();
    const subCategory = (notice.subCategory || "").toLowerCase();
    if (category === "system") return false;
    if (subCategory.includes("modification") || subCategory.includes("extension")) return false;
    if (title.includes("modification request expired") || title.includes("extension request expired")) return false;
    return true;
  });
  const isExpiredNotice = (notice) => notice.expiresAt && new Date(notice.expiresAt) < new Date();
  const activeNotices = visibleNotices.filter((notice) => !isExpiredNotice(notice));
  const expiredNotices = visibleNotices.filter((notice) => isExpiredNotice(notice));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Admin Notices</h2>
          <p className="text-sm text-gray-400">Send one-way notices to employees</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          + Send Notice
        </button>
      </div>

      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-xs font-semibold">INFO</span>
          <div>
            <h4 className="font-semibold">About Admin Notices</h4>
            <p className="text-sm text-gray-300">
              Admin notices are one-way communications. Employees can view them but cannot reply. 
              Use the Community feed for two-way discussions.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading notices...</div>
      ) : activeNotices.length === 0 ? (
        <div className="bg-gray-800 p-12 rounded-lg text-center">
          <span className="text-6xl">NOTE</span>
          <h3 className="text-xl font-semibold mt-4">No Notices Sent Yet</h3>
          <p className="text-gray-400 mt-2">
            Send your first notice to communicate with your team
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
          >
            Send First Notice
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Sent Notices</h3>
          {activeNotices.map((notice) => (
            <div 
              key={notice._id} 
              className={`bg-gray-800 border-l-4 ${getPriorityColor(notice.priority).replace('bg-', 'border-')} p-6 rounded-lg`}
            >
              {(() => {
                const isExpired = notice.expiresAt && new Date(notice.expiresAt) < new Date();
                return (
              <div className="flex items-start gap-4">
                <span className="text-xs font-semibold">{getPriorityIcon(notice.priority)}</span>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{notice.title}</h3>
                    <span className={`px-3 py-1 text-xs rounded text-white ${getPriorityColor(notice.priority)}`}>
                      {notice.priority.toUpperCase()}
                    </span>
                    {isExpired && (
                      <span className="px-2 py-1 text-xs rounded bg-red-900/30 text-red-300">
                        EXPIRED
                      </span>
                    )}
                  </div>

                  <p className="text-gray-300 whitespace-pre-wrap mb-3">{notice.content}</p>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <span>Sent: {formatDate(notice.createdAt)}</span>
                    <span>
                      Recipients: {notice.targetType === "all" 
                        ? "All Employees" 
                        : `${notice.sentCount || 0} Selected`}
                    </span>
                    {notice.expiresAt && (
                      <span className="text-yellow-400">
                        Expires: {formatDate(notice.expiresAt)}
                      </span>
                    )}
                    {notice.readCount !== undefined && (
                      <span className="text-green-400">
                        {notice.readCount} Views
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => setReadersOpen(prev => ({ ...prev, [notice._id]: !prev[notice._id] }))}
                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                    >
                      {readersOpen[notice._id] ? "Hide Read By" : "View Read By"}
                    </button>
                    <button
                      onClick={() => setNoticeDiscussionOpen(prev => ({ ...prev, [notice._id]: !prev[notice._id] }))}
                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                    >
                      {noticeDiscussionOpen[notice._id] ? "Hide Discussion" : "Open Discussion"}
                    </button>
                    {getNoticeEditMeta(notice).canEdit && (
                      <button
                        onClick={() => handleOpenEdit(notice)}
                        className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600"
                      >
                        Edit Notice
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotice(notice._id)}
                      className="px-3 py-1 rounded bg-red-700 hover:bg-red-600"
                    >
                      Delete Notice
                    </button>
                  </div>

                  {readersOpen[notice._id] && (
                    <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300">
                      <div className="font-semibold mb-2">Read By</div>
                      {(notice.recipients || []).filter(r => r.read && r.user).length === 0 ? (
                        <div className="text-gray-500">No readers yet.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(notice.recipients || [])
                            .filter(r => r.read && r.user)
                            .map(r => (
                              <span key={r.user._id} className="px-2 py-1 bg-gray-800 rounded">
                                {r.user.name} ({r.user.email})
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  {noticeDiscussionOpen[notice._id] && (
                    <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300">
                      <div className="font-semibold mb-2">Discussion</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(notice.discussion || []).length === 0 && (
                          <div className="text-gray-500">No messages yet.</div>
                        )}
                        {(notice.discussion || []).map((msg, idx) => (
                          <div key={idx}>
                            <span className="text-gray-400">
                              {msg.senderName || msg.senderRole}:
                            </span>{" "}
                            {msg.text}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-sm"
                          placeholder="Write a message..."
                          value={noticeMessageDrafts[notice._id] || ""}
                          onChange={(e) => setNoticeMessageDrafts(prev => ({ ...prev, [notice._id]: e.target.value }))}
                        />
                        <button
                          onClick={() => sendNoticeMessage(notice._id)}
                          className="bg-blue-600 px-3 py-1 rounded text-sm"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
                );
              })()}
            </div>
          ))}
          {expiredNotices.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowExpired((prev) => !prev)}
                className="text-sm px-3 py-2 bg-gray-900 border border-gray-700 rounded hover:border-gray-500"
              >
                {showExpired ? "Hide Expired Notices" : `Show Expired Notices (${expiredNotices.length})`}
              </button>
              {showExpired && (
                <div className="mt-3 space-y-3">
                  {expiredNotices.map((notice) => (
                    <div
                      key={notice._id}
                      className={`bg-gray-900 border-l-4 ${getPriorityColor(notice.priority).replace('bg-', 'border-')} p-5 rounded-lg opacity-80`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-white">{notice.title}</h4>
                        <span className="px-2 py-1 text-xs rounded bg-red-900/30 text-red-300">EXPIRED</span>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap mb-2">{notice.content}</p>
                      <div className="text-xs text-gray-400">
                        Expired: {formatDate(notice.expiresAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Send Admin Notice</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Priority Level</label>
                <select
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">Low - General Information</option>
                  <option value="medium">Medium - Standard Notice</option>
                  <option value="high">High - Important</option>
                  <option value="critical">Critical - Must Act</option>
                  <option value="urgent">Urgent - Immediate Attention Required</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Notice Title *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <textarea
                placeholder="Notice Content *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="6"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />

              <div>
                <label className="text-sm text-gray-400 block mb-2">Send To</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.targetType === "all"}
                      onChange={() => setForm({ ...form, targetType: "all", selectedEmployees: [] })}
                    />
                    <span>All Employees</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.targetType === "specific"}
                      onChange={() => setForm({ ...form, targetType: "specific" })}
                    />
                    <span>Selected Employees</span>
                  </label>
                </div>
              </div>

              {form.targetType === "specific" && (
                <div className="border border-gray-700 rounded p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-400 mb-2">Select employees:</p>
                  {employees.filter(e => e.status === "active").map((emp) => (
                    <label key={emp._id} className="flex items-center gap-2 py-1 hover:bg-gray-700 px-2 rounded">
                      <input
                        type="checkbox"
                        checked={form.selectedEmployees.includes(emp._id)}
                        onChange={() => toggleEmployee(emp._id)}
                      />
                      <span>{emp.name} ({emp.email})</span>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for notices that don't expire
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendNotice}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-medium"
                >
                  Send Notice
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

      {editNotice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Edit Notice</h3>
            <p className="text-xs text-gray-400 mb-4">
              Edit is available for 15 minutes after sending.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Priority Level</label>
                <select
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={editForm.priority}
                  onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="low">Low - General Information</option>
                  <option value="medium">Medium - Standard Notice</option>
                  <option value="high">High - Important</option>
                  <option value="critical">Critical - Must Act</option>
                  <option value="urgent">Urgent - Immediate Attention Required</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Notice Title *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />

              <textarea
                placeholder="Notice Content *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="6"
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
              />

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={editForm.expiresAt}
                  onChange={(e) => setEditForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateNotice}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditNotice(null)}
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

export default AdminNoticePanel;

