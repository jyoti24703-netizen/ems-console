import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";

const ModificationRequestsPanel = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

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
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const fetchAllRequests = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        sort: "recent",
        status: "all",
        origin: "all"
      });
      const res = await fetch(`http://localhost:4000/api/tasks/modification-requests/pending?${params.toString()}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPendingRequests(data.pendingRequests || []);
      } else {
        setPendingRequests([]);
      }
    } catch (err) {
      console.error("Failed to fetch pending requests:", err);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getSlaDisplayLabel = (request, kind) => {
    const meta = getModSlaMeta(request);
    if (!meta?.label) return "-";
    if (kind === "admin") {
      return meta.label.replace("Respond within", "Employee response due in");
    }
    // Employee-origin request should not read like employee is setting authority over admin.
    // Keep it neutral and operational.
    if (meta.level === "danger") return "Review SLA breached";
    return "Under admin review";
  };

  const getWorkflowStatusMeta = (request, kind) => {
    const status = request?.effectiveStatus || request?.status || "pending";
    if (status === "pending") {
      return kind === "employee"
        ? { label: "Awaiting admin response", color: "text-orange-400" }
        : { label: "Awaiting employee response", color: "text-orange-400" };
    }
    if (status === "approved") {
      return { label: "Approved - awaiting execution", color: "text-yellow-300" };
    }
    if (status === "counter_proposed") {
      return { label: "Counter proposed", color: "text-indigo-300" };
    }
    if (status === "executed") {
      return { label: "Executed", color: "text-blue-400" };
    }
    if (status === "rejected") {
      return { label: "Rejected", color: "text-red-400" };
    }
    if (status === "expired") {
      return { label: "SLA expired", color: "text-red-300" };
    }
    return { label: status, color: "text-gray-300" };
  };

  const matchesStatusFilter = (request) => {
    const status = request?.effectiveStatus || request?.status || "pending";
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") {
      // Open queue: pending + approved (awaiting execution), excluding expired/rejected/executed.
      return status === "pending" || status === "approved";
    }
    return status === statusFilter;
  };

  useEffect(() => {
    if (user && user.token) {
      fetchAllRequests();
    }
  }, [user]);

  const normalizedRequests = pendingRequests.map((item) => {
    const exp = item.expiresAt ? new Date(item.expiresAt).getTime() : null;
    const isExpiredOpenState =
      exp != null &&
      exp <= Date.now() &&
      ["pending", "approved"].includes(item.status || "pending");
    const effectiveStatus =
      isExpiredOpenState
        ? "expired"
        : item.status || "pending";
    return {
      kind: item.origin === "employee_initiated" ? "employee" : "admin",
      task: {
        _id: item.taskId,
        title: item.taskTitle,
        status: item.taskStatus,
        assignedTo: item.assignedTo,
        department: item.department
      },
      request: {
        _id: item.requestId || item._id,
        requestType: item.requestType,
        reason: item.reason,
        requestedBy: item.requestedBy,
        requestedAt: item.requestedAt,
        createdAt: item.createdAt || item.requestedAt,
        expiresAt: item.expiresAt,
        employeeViewedAt: item.employeeViewedAt,
        status: item.status,
        effectiveStatus,
        response: item.response,
        proposedChanges: item.proposedChanges,
        deletionImpact: item.deletionImpact,
        businessCase: item.businessCase,
        supportingDocs: item.supportingDocs,
        urgency: item.urgency,
        discussion: item.discussion || []
      }
    };
  });

  const adminRequests = normalizedRequests.filter(r => r.kind === "admin");
  const employeeRequests = normalizedRequests.filter(r => r.kind === "employee");
  const allRequests = normalizedRequests;

  const statusScopedAll =
    allRequests.filter((r) => matchesStatusFilter(r.request));
  const statusScopedAdmin = statusScopedAll.filter(r => r.kind === "admin");
  const statusScopedEmployee = statusScopedAll.filter(r => r.kind === "employee");

  const requestsToShow =
    activeTab === "admin"
      ? adminRequests
      : activeTab === "employee"
      ? employeeRequests
      : allRequests;

  const filteredRequestsToShow =
    requestsToShow.filter((r) => matchesStatusFilter(r.request));

  const handleSelectRequest = (payload) => {
    setSelectedRequest(payload);
    setMessages(payload.request?.discussion || []);
    setAdminNote("");
    setRejectionReason("");
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRequest) return;

    setSendingMessage(true);
    try {
      const url = `http://localhost:4000/api/tasks/${selectedRequest.task._id}/modification-request/${selectedRequest.request._id}/message`;
      console.log(" Sending message to:", url);
      console.log("Message:", newMessage);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);

      if (data.success) {
        setMessages([...messages, data.message]);
        setNewMessage("");
        fetchAllRequests(); // Refresh to get latest data
      } else {
        alert(" Error: " + (data.error || "Failed to send message"));
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Error: " + err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  // Open task management to review/execute approved edit
  const executeEdit = () => {
    if (!selectedRequest) return;
    const execNonce = Date.now();
    const search = new URLSearchParams({
      exec: String(execNonce),
      section: "task",
      tab: "manage",
      taskId: String(selectedRequest.task._id || ""),
      requestId: String(selectedRequest.request._id || ""),
      origin: "admin",
      requestType: String(selectedRequest.request.requestType || "edit")
    }).toString();
    navigate(`/admin?${search}`, {
      state: {
        activeSection: "task",
        activeTab: "manage",
        openEditFromModRequest: {
          taskId: selectedRequest.task._id,
          requestId: selectedRequest.request._id,
          proposedChanges: selectedRequest.request.proposedChanges || {},
          requestType: selectedRequest.request.requestType,
          origin: "admin",
          openNonce: execNonce
        }
      }
    });
  };

  // Execute delete after employee approves
  const executeDelete = async () => {
    if (!selectedRequest) return;

    if (!window.confirm("Are you sure you want to delete this task?")) return;

    setActionInProgress(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${selectedRequest.task._id}/approve-modification-request/${selectedRequest.request._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            adminNote: "Admin executed approved delete",
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        alert(" Task deleted successfully!");
        fetchAllRequests();
        setSelectedRequest(null);
        setMessages([]);
      } else {
        alert(data.error || "Failed to execute delete");
      }
    } catch (err) {
      console.error("Error executing delete:", err);
      alert("Error executing delete");
    } finally {
      setActionInProgress(false);
    }
  };

  const approveEmployeeRequest = async () => {
    if (!selectedRequest || selectedRequest.kind !== "employee") return;
    if (!adminNote.trim()) {
      alert("Admin note is required");
      return;
    }

    setActionInProgress(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${selectedRequest.task._id}/approve-employee-modification/${selectedRequest.request._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            adminNote: adminNote.trim(),
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        alert(" Employee request approved");
        setSelectedRequest(prev => prev ? ({
          ...prev,
          request: {
            ...prev.request,
            status: "approved",
            effectiveStatus: "approved",
            adminNote: adminNote.trim()
          }
        }) : prev);
        fetchAllRequests();
      } else {
        alert(data.error || "Failed to approve request");
      }
    } catch (err) {
      console.error("Error approving employee request:", err);
      alert("Error approving employee request");
    } finally {
      setActionInProgress(false);
    }
  };

  const rejectEmployeeRequest = async () => {
    if (!selectedRequest || selectedRequest.kind !== "employee") return;
    if (!rejectionReason.trim()) {
      alert("Rejection reason is required");
      return;
    }

    setActionInProgress(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${selectedRequest.task._id}/reject-employee-modification/${selectedRequest.request._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            reason: rejectionReason.trim()
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        alert(" Employee request rejected");
        setSelectedRequest(prev => prev ? ({
          ...prev,
          request: {
            ...prev.request,
            status: "rejected",
            effectiveStatus: "rejected"
          }
        }) : prev);
        setStatusFilter("rejected");
        fetchAllRequests();
      } else {
        alert(data.error || "Failed to reject request");
      }
    } catch (err) {
      console.error("Error rejecting employee request:", err);
      alert("Error rejecting employee request");
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Modification Requests</h2>
      <p className="text-gray-400">
        Full modification history with SLA visibility. Filter by status to review outcomes.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => {
            setActiveTab("all");
            setSelectedRequest(null);
          }}
          className={`p-4 rounded-lg border text-left ${
            activeTab === "all"
              ? "bg-blue-900/30 border-blue-600 text-white"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
          }`}
        >
          <div className="text-xs text-gray-400">All Requests</div>
          <div className="text-2xl font-semibold">{statusScopedAll.length}</div>
        </button>
        <button
          onClick={() => {
            setActiveTab("admin");
            setSelectedRequest(null);
          }}
          className={`p-4 rounded-lg border text-left ${
            activeTab === "admin"
              ? "bg-blue-900/30 border-blue-600 text-white"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
          }`}
        >
          <div className="text-xs text-gray-400">Admin Requests</div>
          <div className="text-2xl font-semibold">{statusScopedAdmin.length}</div>
        </button>
        <button
          onClick={() => {
            setActiveTab("employee");
            setSelectedRequest(null);
          }}
          className={`p-4 rounded-lg border text-left ${
            activeTab === "employee"
              ? "bg-blue-900/30 border-blue-600 text-white"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
          }`}
        >
          <div className="text-xs text-gray-400">Employee Requests</div>
          <div className="text-2xl font-semibold">{statusScopedEmployee.length}</div>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm bg-gray-900 border border-gray-700 text-gray-300"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="executed">Executed</option>
          <option value="expired">Expired</option>
          <option value="counter_proposed">Counter Proposed</option>
          <option value="all">All Status</option>
        </select>
      </div>

      {filteredRequestsToShow.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-lg">No modification requests match the current filters</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request List */}
          <div className="lg:col-span-1 space-y-3">
            {filteredRequestsToShow.map(({ task, request, kind }) => (
              <div
                key={`${task._id}-${request._id}`}
                onClick={() => handleSelectRequest({ task, request, kind })}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedRequest?.request._id === request._id
                    ? "bg-blue-900 border-blue-500 ring-2 ring-blue-400"
                    : "bg-gray-800 border-gray-700 hover:border-blue-500"
                }`}
              >
                <h3 className="font-semibold text-white truncate">
                  {task.title}
                </h3>
                <p className="text-sm text-gray-400">
                  {task.assignedTo?.name || "Unknown"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded font-medium ${
                      request.requestType === "edit"
                        ? "bg-yellow-900 text-yellow-300"
                        : request.requestType === "delete"
                        ? "bg-red-900 text-red-300"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {request.requestType === "edit"
                      ? "Edit"
                      : request.requestType === "delete"
                      ? "Delete"
                      : request.requestType?.replace(/_/g, " ") || "Request"}
                  </span>
                  <span className="inline-block text-xs px-2 py-1 rounded font-medium bg-slate-800 text-slate-300">
                    {kind === "admin" ? "Admin Request" : "Employee Request"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Status:{" "}
                  <span className={`font-semibold ${getWorkflowStatusMeta(request, kind).color}`}>
                    {getWorkflowStatusMeta(request, kind).label}
                  </span>
                </div>
                <div className={`mt-1 text-xs ${getSlaLevelClasses(getModSlaMeta(request)?.level)}`}>
                  {getSlaDisplayLabel(request, kind)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {kind === "employee"
                    ? "Awaiting admin review"
                    : request.employeeViewedAt
                    ? `Employee viewed: ${new Date(request.employeeViewedAt).toLocaleString()}`
                    : "Employee has not viewed yet"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Discussion: {(request.discussion || []).length} message(s)
                </div>
              </div>
            ))}
          </div>

          {/* Discussion & Actions */}
          {selectedRequest && (
            <div className="lg:col-span-2 space-y-4">
              {/* Request Info */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    {selectedRequest.task.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Assigned to: {selectedRequest.task.assignedTo?.name || "Unknown"}
                  </p>
                </div>

                {/* Request Type & Reason */}
                <div className="space-y-3 mb-4">
                  <div>
                    <span
                      className={`inline-block text-sm px-3 py-1 rounded font-medium ${
                        selectedRequest.request.requestType === "edit"
                          ? "bg-yellow-900 text-yellow-300"
                          : "bg-red-900 text-red-300"
                      }`}
                    >
                      {selectedRequest.request.requestType === "edit"
                        ? " Edit Request"
                        : selectedRequest.request.requestType === "delete"
                        ? " Delete Request"
                        : ` ${selectedRequest.request.requestType?.replace(/_/g, " ") || "Request"}`}
                    </span>
                  </div>

                  <div className={`text-sm ${getSlaLevelClasses(getModSlaMeta(selectedRequest.request)?.level)}`}>
                    {getSlaDisplayLabel(selectedRequest.request, selectedRequest.kind)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedRequest.kind === "employee"
                      ? "Awaiting admin review"
                      : selectedRequest.request.employeeViewedAt
                      ? `Employee viewed: ${new Date(selectedRequest.request.employeeViewedAt).toLocaleString()}`
                      : "Employee has not viewed yet"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Discussion activity: {(selectedRequest.request.discussion || []).length} message(s)
                  </div>


                  <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">
                      Request Reason:
                    </p>
                    <p className="text-gray-300 p-3 bg-gray-900 rounded border border-gray-700">
                      {selectedRequest.request.reason}
                    </p>
                  </div>

                  {/* Show Proposed Changes for Edit */}
                  {selectedRequest.request.requestType === "edit" &&
                    selectedRequest.request.proposedChanges && (
                      <div>
                        <p className="text-sm font-semibold text-gray-300 mb-2">
                          Proposed Changes:
                        </p>
                        <div className="bg-gray-900 p-3 rounded border border-gray-700 space-y-2 text-sm">
                          {selectedRequest.request.proposedChanges.title && (
                            <div>
                              <strong>Title:</strong>{" "}
                              {selectedRequest.request.proposedChanges.title}
                            </div>
                          )}
                          {selectedRequest.request.proposedChanges.description && (
                            <div>
                              <strong>Description:</strong>{" "}
                              {selectedRequest.request.proposedChanges.description}
                            </div>
                          )}
                          {selectedRequest.request.proposedChanges.dueDate && (
                            <div>
                              <strong>Due Date:</strong>{" "}
                              {new Date(
                                selectedRequest.request.proposedChanges.dueDate
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* Status & Timeline */}
                <div className="text-xs text-gray-500 border-t border-gray-700 pt-3">
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={`font-semibold ${getWorkflowStatusMeta(selectedRequest.request, selectedRequest.kind).color}`}>
                      {getWorkflowStatusMeta(selectedRequest.request, selectedRequest.kind).label}
                    </span>
                  </p>
                  <p className="mt-1">
                    <strong>Requested:</strong>{" "}
                    {new Date(selectedRequest.request.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Discussion Section */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-4">
                  Discussion between admin and employee
                </h4>

                {/* Messages */}
                <div className="bg-gray-900 rounded border border-gray-700 p-4 max-h-72 overflow-y-auto space-y-3 mb-4">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No discussion yet. Send a message to start!
                    </p>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border-l-4 ${
                          msg.senderRole === "admin"
                            ? "bg-blue-900/30 border-l-blue-500"
                            : "bg-green-900/30 border-l-green-500"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-300">
                              {msg.senderRole === "admin"
                                ? " Admin"
                                : " Employee"}{" "}
                              <span className="text-gray-500">
                                ({msg.senderRole})
                              </span>
                            </p>
                            <p className="text-sm text-gray-200 mt-1">
                              {msg.text}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Send a message to discuss this request..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") sendMessage();
                    }}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500"
                    disabled={sendingMessage}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm font-medium"
                  >
                    Send
                  </button>
                </div>
              </div>

              {selectedRequest.kind === "admin" ? (
                <div className={`${
                  (selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "pending"
                    ? "bg-yellow-900/20 border border-yellow-700"
                    : (selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "approved"
                    ? "bg-green-900/20 border border-green-700"
                    : (selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "executed"
                    ? "bg-blue-900/20 border border-blue-700"
                    : "bg-red-900/20 border border-red-700"
                } rounded-lg p-4`}>
                  {(selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "pending" && (
                    <>
                      <p className="text-sm text-yellow-300 mb-3">
                        Waiting for employee approval
                      </p>
                      <p className="text-xs text-gray-300 mb-4">
                        Once the employee approves in their task view, the execute button will activate.
                      </p>
                    </>
                  )}
                  {(selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "approved" && (
                    <>
                      <p className="text-sm text-green-300 mb-3">
                        Approved by employee
                      </p>
                      <p className="text-xs text-gray-300 mb-4">
                        You can now execute the requested changes.
                      </p>
                    </>
                  )}
                  {(selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "rejected" && (
                    <>
                      <p className="text-sm text-red-300 mb-3">
                        Declined by employee
                      </p>
                      <p className="text-xs text-gray-300 mb-4">
                        No action is required.
                      </p>
                    </>
                  )}

              {selectedRequest.request.requestType === "edit" ? (
                <button
                  onClick={executeEdit}
                  disabled={(selectedRequest.request.effectiveStatus || selectedRequest.request.status) !== "approved"}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-medium transition-all"
                  title={
                    (selectedRequest.request.effectiveStatus || selectedRequest.request.status) !== "approved"
                      ? "Enable only after employee approval"
                      : ""
                  }
                >
                  Open Task Management to Edit
                </button>
              ) : selectedRequest.request.requestType === "delete" ? (
                <button
                  onClick={executeDelete}
                  disabled={
                    actionInProgress ||
                    (selectedRequest.request.effectiveStatus || selectedRequest.request.status) !== "approved"
                  }
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded font-medium transition-all"
                  title={
                    (selectedRequest.request.effectiveStatus || selectedRequest.request.status) !== "approved"
                      ? "Enable only after employee approval"
                      : ""
                  }
                >
                  {actionInProgress
                    ? "Deleting..."
                    : "Execute Delete Task"}
                </button>
              ) : null}
                </div>
              ) : (
                <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-300">
                    Employee request requires admin approval. After approval, execute in Task Management.
                  </p>
                  {(selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "pending" ? (
                    <>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Admin note (required for approval)"
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                        rows="2"
                      />
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Rejection reason (required to decline)"
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                        rows="2"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          onClick={approveEmployeeRequest}
                          disabled={actionInProgress || !adminNote.trim()}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded"
                        >
                          Approve Request
                        </button>
                        <button
                          onClick={rejectEmployeeRequest}
                          disabled={actionInProgress || !rejectionReason.trim()}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded"
                        >
                          Reject Request
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-yellow-300 bg-yellow-900/20 border border-yellow-700 rounded px-3 py-2">
                      Review action already completed for this request. You can execute approved requests below.
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const execNonce = Date.now();
                      const search = new URLSearchParams({
                        exec: String(execNonce),
                        section: "task",
                        tab: "manage",
                        taskId: String(selectedRequest.task._id || ""),
                        requestId: String(selectedRequest.request._id || ""),
                        origin: "employee",
                        requestType: String(selectedRequest.request.requestType || "edit")
                      }).toString();
                      navigate(`/admin?${search}`, {
                        state: {
                          activeSection: "task",
                          activeTab: "manage",
                          openEditFromEmployeeRequest: {
                            origin: "employee",
                            taskId: selectedRequest.task._id,
                            requestId: selectedRequest.request._id,
                            requestType: selectedRequest.request.requestType,
                            proposedChanges: selectedRequest.request.proposedChanges || {},
                            requestedExtension: selectedRequest.request.requestedExtension,
                            requestedReassign: selectedRequest.request.requestedReassign || null,
                            openNonce: execNonce
                          }
                        }
                      });
                    }}
                    disabled={(selectedRequest.request.effectiveStatus || selectedRequest.request.status) !== "approved"}
                    className="w-full px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 disabled:bg-gray-700 text-white rounded text-sm font-medium"
                  >
                    Open Task Management to Execute
                  </button>
                  <div className="text-xs text-gray-400">
                    {(selectedRequest.request.effectiveStatus || selectedRequest.request.status) === "pending"
                      ? "Approve first to unlock execution."
                      : "Review decision is already recorded. Use execute for approved requests."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModificationRequestsPanel;
