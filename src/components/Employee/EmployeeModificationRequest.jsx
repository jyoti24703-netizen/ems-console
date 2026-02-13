import React, { useState, useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";

const EmployeeModificationRequest = ({ task, onResponseSubmitted }) => {
  const { user } = useContext(AuthContext);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [disagreeReason, setDisagreeReason] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [viewedRequestIds, setViewedRequestIds] = useState({});


  const formatDuration = (ms) => {
    if (ms == null) return "-";
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  };

  const getModSlaMeta = (request) => {
    if (!request?.expiresAt) return null;
    const remainingMs = new Date(request.expiresAt).getTime() - Date.now();
    let level = "neutral";
    if (remainingMs <= 0) level = "danger";
    else if (remainingMs <= 12 * 60 * 60 * 1000) level = "warning";
    return {
      remainingMs,
      level,
      label: remainingMs > 0 ? `Respond within ${formatDuration(remainingMs)}` : "SLA expired"
    };
  };

  const getSlaLevelClasses = (level) => {
    switch (level) {
      case "danger":
        return "text-red-300";
      case "warning":
        return "text-yellow-300";
      default:
        return "text-gray-400";
    }
  };

  // Get pending modification requests for this task
  const pendingRequests = task?.modificationRequests?.filter(
    (req) => req.status === "pending"
  ) || [];

  const isSelectedExpired = selectedRequest?.expiresAt
    ? new Date(selectedRequest.expiresAt) < new Date()
    : false;

  const markRequestViewed = async (request) => {
    if (!request || request.employeeViewedAt) return;
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${task._id}/modification-request/${request._id}/viewed`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          }
        }
      );

      const data = await res.json();
      if (data.success) {
        setSelectedRequest(prev => prev ? { ...prev, employeeViewedAt: data.request?.employeeViewedAt || new Date().toISOString() } : prev);
        setViewedRequestIds(prev => ({
          ...prev,
          [request._id]: data.request?.employeeViewedAt || new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error("Error marking request viewed:", err);
    }
  };

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    setMessages(request.discussion || []);
    setNewMessage("");
    setDisagreeReason("");
    markRequestViewed(request);
  };

  // Send message to modification request discussion
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRequest) return;

    setSendingMessage(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${task._id}/modification-request/${selectedRequest._id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ message: newMessage.trim() }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setMessages([...messages, data.message]);
        setNewMessage("");
      } else {
        alert("❌ Error: " + (data.error || "Failed to send message"));
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Error sending message");
    } finally {
      setSendingMessage(false);
    }
  };

  // Employee approves modification request
  const approveModification = async () => {
    if (!selectedRequest) return;

    setSubmittingResponse(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${task._id}/modification-request/${selectedRequest._id}/respond`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            decision: "approved",
            note: "I approve this modification.",
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        alert("✅ You approved this modification. Admin can now execute it.");
        setSelectedRequest(null);
        setMessages([]);
        // Notify parent to refresh
        if (onResponseSubmitted) onResponseSubmitted();
      } else {
        alert("❌ Error: " + (data.error || "Failed to approve"));
      }
    } catch (err) {
      console.error("Error approving:", err);
      alert("Error approving modification");
    } finally {
      setSubmittingResponse(false);
    }
  };

  // Employee declines modification request
  const declineModification = async () => {
    if (!selectedRequest) return;
    if (!disagreeReason.trim()) {
      alert("Please provide a reason for declining");
      return;
    }

    setSubmittingResponse(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${task._id}/modification-request/${selectedRequest._id}/respond`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            decision: "rejected",
            note: disagreeReason.trim(),
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        alert("✅ You declined this modification.");
        setSelectedRequest(null);
        setMessages([]);
        setDisagreeReason("");
        // Notify parent to refresh
        if (onResponseSubmitted) onResponseSubmitted();
      } else {
        alert("❌ Error: " + (data.error || "Failed to decline"));
      }
    } catch (err) {
      console.error("Error declining:", err);
      alert("Error declining modification");
    } finally {
      setSubmittingResponse(false);
    }
  };

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mt-6">
      <h3 className="text-xl font-semibold mb-4">📝 Modification Requests</h3>
      <p className="text-gray-400 text-sm mb-4">
        The admin has requested modifications to this task. Please review and approve or decline.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request List */}
        <div className="lg:col-span-1 space-y-2">
          {pendingRequests.map((request) => (
            <div
              key={request._id}
              onClick={() => handleSelectRequest(request)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedRequest?._id === request._id
                  ? "bg-blue-900 border-blue-500 ring-2 ring-blue-400"
                  : "bg-gray-700 border-gray-600 hover:border-blue-500"
              }`}
            >
              <p className="font-semibold text-sm">
                {request.requestType === "edit" ? "Edit" : "Delete"}
              </p>
              <p className="text-xs text-gray-300">
                {request.requestType === "edit"
                  ? "Task changes requested"
                  : "Task deletion requested"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Reason: {request.reason}
              </p>
              <p className={`text-xs mt-1 ${getSlaLevelClasses(getModSlaMeta(request)?.level)}`}>
                {getModSlaMeta(request)?.label || "-"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(request.employeeViewedAt || viewedRequestIds[request._id])
                  ? `Seen: ${new Date(request.employeeViewedAt || viewedRequestIds[request._id]).toLocaleString()}`
                  : "New - not viewed"}
              </p>
            </div>
          ))}
        </div>

        {/* Request Detail & Discussion */}
        {selectedRequest && (
          <div className="lg:col-span-2 space-y-4">
            {/* Request Info */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Request Details</h4>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">Type:</span> {selectedRequest.requestType === "edit" ? "Edit Task" : "Delete Task"}
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-semibold">Reason:</span> {selectedRequest.reason}
              </p>
              <p className={`text-sm mt-2 ${getSlaLevelClasses(getModSlaMeta(selectedRequest)?.level)}`}>
                {getModSlaMeta(selectedRequest)?.label || "-"}
              </p>
              {isSelectedExpired && (
                <div className="mt-3 bg-red-900/30 border border-red-700 rounded p-2 text-xs text-red-300">
                  Action locked - SLA expired
                </div>
              )}

              {selectedRequest.requestType === "edit" && selectedRequest.proposedChanges && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="font-semibold text-sm mb-2">Proposed Changes:</p>
                  <div className="text-xs space-y-1 text-gray-400">
                    {selectedRequest.proposedChanges.title && (
                      <p>📝 Title: {selectedRequest.proposedChanges.title}</p>
                    )}
                    {selectedRequest.proposedChanges.description && (
                      <p>📄 Description: {selectedRequest.proposedChanges.description}</p>
                    )}
                    {selectedRequest.proposedChanges.dueDate && (
                      <p>📅 Due Date: {new Date(selectedRequest.proposedChanges.dueDate).toLocaleDateString()}</p>
                    )}
                    {selectedRequest.proposedChanges.priority && (
                      <p>🔴 Priority: {selectedRequest.proposedChanges.priority}</p>
                    )}
                    {selectedRequest.proposedChanges.category && (
                      <p>📂 Category: {selectedRequest.proposedChanges.category}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Discussion Thread */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="font-semibold mb-3">💬 Discussion</h4>
              <div className="bg-gray-800 border border-gray-600 rounded p-3 mb-3 max-h-48 overflow-y-auto space-y-2">
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-500">No messages yet</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        msg.senderRole === "admin"
                          ? "bg-blue-900 border-l-2 border-blue-500"
                          : "bg-green-900 border-l-2 border-green-500"
                      }`}
                    >
                      <p className="opacity-70 text-xs">
                        {msg.senderRole === "admin" ? "Admin" : "You"}
                      </p>
                      <p>{msg.text}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Reply to discussion..."
                className="w-full bg-gray-800 border border-gray-600 rounded p-2 mb-2 text-sm text-white placeholder-gray-500"
                rows="2"
                disabled={isSelectedExpired}
              />
              <button
                onClick={sendMessage}
                disabled={sendingMessage || isSelectedExpired}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-2 rounded text-sm font-semibold"
              >
                {sendingMessage ? "Sending..." : "Send Message"}
              </button>
            </div>

            {/* Decision Buttons */}
            <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
              <p className="text-sm font-semibold mb-3">⚠️ Make Your Decision</p>

              {/* Approve Button */}
              <button
                onClick={approveModification}
                disabled={submittingResponse || isSelectedExpired}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold mb-2"
              >
                {submittingResponse ? "Processing..." : "✅ Approve Modification"}
              </button>

              {/* Disagree Reason & Button */}
              <div className="space-y-2">
                <textarea
                  value={disagreeReason}
                  onChange={(e) => setDisagreeReason(e.target.value)}
                  placeholder="Provide reason for declining (required)..."
                  className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white placeholder-gray-500"
                  rows="2"
                  disabled={isSelectedExpired}
                />
                <button
                  onClick={declineModification}
                  disabled={submittingResponse || !disagreeReason.trim() || isSelectedExpired}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
                >
                  {submittingResponse ? "Processing..." : "❌ Decline Modification"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeModificationRequest;
