import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";

const TaskManagementPanel = ({ view = "all", openEditFromModRequest }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // "all" | "pending-mods" | "extension-requests"
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const modOpenHandledRef = useRef(null);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  const [extensionExecution, setExtensionExecution] = useState(null);
  const extensionOpenHandledRef = useRef(null);

  // Form states
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    category: "",
    dueDate: "",
    priority: "medium"
  });
  const [modExecution, setModExecution] = useState(null);
  const [editAdminNote, setEditAdminNote] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteReason, setDeleteReason] = useState("");
  const [modificationData, setModificationData] = useState({
    type: "edit",
    reason: "",
    slaHours: 24,
    proposedChanges: {
      title: "",
      description: "",
      dueDate: "",
      category: "",
      priority: ""
    },
    impactNote: ""
  });
  const [extensionData, setExtensionData] = useState({
    newDueDate: "",
    reason: ""
  });
  const [reopenReason, setReopenReason] = useState("");
  const [reassignForm, setReassignForm] = useState({
    newEmployeeId: "",
    reason: "",
    handoverNotes: ""
  });

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/tasks", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/admin/employees", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  useEffect(() => {
    if (user && user.token) {
      fetchTasks();
      fetchEmployees();
    }
  }, [user]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search || "");
    const searchExec = searchParams.get("exec");
    const searchTaskId = searchParams.get("taskId");
    const searchRequestId = searchParams.get("requestId");
    const searchOrigin = searchParams.get("origin");
    const searchRequestType = searchParams.get("requestType");
    const openFromSearch =
      searchExec && searchTaskId && searchRequestId
        ? {
            taskId: searchTaskId,
            requestId: searchRequestId,
            origin: searchOrigin || "employee",
            requestType: searchRequestType || "edit",
            openNonce: Number(searchExec)
          }
        : null;

    const openRequest = openEditFromModRequest || location.state?.openEditFromModRequest || location.state?.openEditFromEmployeeRequest || openFromSearch;
    const openKey = openRequest
      ? `${openRequest.taskId || ""}-${openRequest.requestId || ""}-${openRequest.openNonce || location.state?.openNonce || ""}`
      : null;
    if (!openRequest || (openKey && modOpenHandledRef.current === openKey)) return;
    if (!tasks || tasks.length === 0) return;

    const task = tasks.find(t => t._id === openRequest.taskId);
    if (!task) return;

    modOpenHandledRef.current = openKey || `${openRequest.taskId || ""}-${openRequest.requestId || ""}`;
    const proposed = openRequest.proposedChanges || {};
    const requestType = openRequest.requestType || "edit";
    setSelectedTask(task);
    setEditFormData({
      title: proposed.title ?? task.title ?? "",
      description: proposed.description ?? task.description ?? "",
      category: proposed.category ?? task.category ?? "",
      dueDate: requestType === "extension"
        ? (openRequest.requestedExtension
            ? new Date(openRequest.requestedExtension).toISOString().slice(0, 10)
            : (task.dueDate ? task.dueDate.split("T")[0] : ""))
        : (proposed.dueDate
            ? new Date(proposed.dueDate).toISOString().slice(0, 10)
            : (task.dueDate ? task.dueDate.split("T")[0] : "")),
      priority: proposed.priority ?? task.priority ?? "medium"
    });
    setEditAdminNote(openRequest.adminNote || "");
    setModExecution({ requestId: openRequest.requestId, origin: openRequest.origin || "admin", requestType });
    setShowEditModal(true);
    setFilterMode("all");
    setHighlightTaskId(task._id);

    setTimeout(() => {
      const element = document.getElementById(`task-${task._id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    navigate("/admin", {
      replace: true,
      state: {
        ...(location.state || {}),
        activeSection: "task",
        activeTab: "manage",
        openEditFromModRequest: null,
        openEditFromEmployeeRequest: null
      }
    });
  }, [location.state, navigate, tasks]);

  useEffect(() => {
    const openExtension = location.state?.openExtensionExecution;
    const openKey = openExtension?.requestId || `${openExtension?.taskId || ""}-${openExtension?.requestedExtension || ""}`;
    if (!openExtension || (openKey && extensionOpenHandledRef.current === openKey)) return;
    if (!tasks || tasks.length === 0) return;

    const task = tasks.find(t => t._id === openExtension.taskId);
    if (!task) return;

    extensionOpenHandledRef.current = openKey || "opened";
    setSelectedTask(task);
    setExtensionData({
      newDueDate: openExtension.requestedExtension
        ? new Date(openExtension.requestedExtension).toISOString().slice(0, 10)
        : "",
      reason: openExtension.reason || ""
    });
    setExtensionExecution({
      requestId: openExtension.requestId,
      mode: "execute"
    });
    setShowExtensionModal(true);
    setFilterMode("all");
    setHighlightTaskId(task._id);

    setTimeout(() => {
      const element = document.getElementById(`task-${task._id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    navigate("/admin", {
      replace: true,
      state: {
        ...(location.state || {}),
        activeSection: "task",
        activeTab: "manage",
        openExtensionExecution: null
      }
    });
  }, [location.state, navigate, tasks]);

  // Handle navigation from modifications panel
  useEffect(() => {
    if (location.state?.filterMode === "pending-mods") {
      setFilterMode("pending-mods");
      if (location.state?.taskId) {
        setHighlightTaskId(location.state.taskId);
        // Scroll to the task after a brief delay
        setTimeout(() => {
          const element = document.getElementById(`task-${location.state.taskId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    }
    if (location.state?.filterMode === "extension-requests") {
      setFilterMode("extension-requests");
      if (location.state?.taskId) {
        setHighlightTaskId(location.state.taskId);
        setTimeout(() => {
          const element = document.getElementById(`task-${location.state.taskId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    }
  }, [location.state]);

  // Categorize tasks
  const assignedTasks = tasks.filter(t => t.status === "assigned");
  const activeTasks = tasks.filter(t => ["accepted", "in_progress", "reopened"].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === "completed");
  const failedTasks = tasks.filter(t => t.status === "failed");
  const withdrawnTasks = tasks.filter(t => t.status === "withdrawn");
  const declinedAssignmentTasks = tasks.filter(
    t => t.status === "declined_by_employee" && (!t.declineType || t.declineType === "assignment_decline")
  );
  const reassignEligibleTasks = tasks.filter(
    t => t.status === "withdrawn" || (t.status === "declined_by_employee" && (!t.declineType || t.declineType === "assignment_decline"))
  );
  const recentlyReassignedTasks = tasks.filter(
    t => (t.activityTimeline || []).some(a => a.action === "TASK_REASSIGNED")
  );

  // Filter for tasks with pending modifications
  const tasksWithPendingMods = tasks.filter(task =>
    task.modificationRequests && task.modificationRequests.some(req => req.status === "pending")
  );
  const tasksWithPendingExtensions = tasks.filter(task =>
    task.extensionRequests && task.extensionRequests.some(req => req.status === "pending")
  );

  // Helper function to check if task is overdue
  const isOverdue = (task) => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date();
  };

  // ==================== EDIT TASK HANDLERS ====================
  const handleEditTask = (task) => {
    setSelectedTask(task);
    setModExecution(null);
    setEditAdminNote("");
    setEditFormData({
      title: task.title,
      description: task.description || "",
      category: task.category || "",
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : "",
      priority: task.priority || "medium"
    });
    setShowEditModal(true);
  };

  const submitEditTask = async () => {
    if (!editFormData.title.trim()) {
      alert("Title is required");
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/direct-edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          title: editFormData.title,
          description: editFormData.description,
          category: editFormData.category,
          dueDate: editFormData.dueDate,
          priority: editFormData.priority,
          editNote: "Direct edit by admin"
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(" Task updated successfully!");
        fetchTasks();
        setShowEditModal(false);
        setSelectedTask(null);
      } else {
        alert(data.error || "Failed to edit task");
      }
    } catch (err) {
      console.error("Edit error:", err);
      alert("Error editing task");
    }
  };

  // ==================== DELETE TASK HANDLERS ====================
  const handleDeleteTask = (task) => {
    setSelectedTask(task);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const submitDeleteTask = async () => {
    if (!deleteReason.trim() || deleteReason.length < 5) {
      alert("Please provide a reason (minimum 5 characters)");
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/direct-delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ deleteReason })
      });

      const data = await res.json();
      if (data.success) {
        alert(" Task deleted successfully!");
        fetchTasks();
        setShowDeleteModal(false);
        setSelectedTask(null);
      } else {
        alert(data.error || "Failed to delete task");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting task");
    }
  };

  // ==================== MODIFICATION REQUEST HANDLERS ====================
  const handleModificationRequest = (task) => {
    setSelectedTask(task);
    setModificationData({
      type: "edit",
      reason: "",
      slaHours: 24,
      proposedChanges: {
        title: task?.title || "",
        description: task?.description || "",
        dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
        category: task?.category || "",
        priority: task?.priority || ""
      },
      impactNote: ""
    });
    setShowModificationModal(true);
  };

  const submitModificationRequest = async () => {
    if (!modificationData.reason.trim() || modificationData.reason.length < 10) {
      alert("Please provide a reason (minimum 10 characters)");
      return;
    }
    if (Number(modificationData.slaHours) < 1 || Number(modificationData.slaHours) > 168) {
      alert("Response SLA must be between 1 and 168 hours");
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/request-modification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          requestType: modificationData.type,
          reason: modificationData.reason,
          slaHours: Number(modificationData.slaHours) || 24,
          proposedChanges: modificationData.type === "edit" ? modificationData.proposedChanges : undefined,
          impactNote: modificationData.type === "delete" ? modificationData.impactNote : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(` Modification request sent to ${selectedTask.assignedTo?.name || "employee"}!`);
        fetchTasks();
        setShowModificationModal(false);
        setSelectedTask(null);
      } else {
        alert(data.error || "Failed to send request");
      }
    } catch (err) {
      console.error("Modification request error:", err);
      alert("Error sending modification request");
    }
  };

  // ==================== EXTENSION HANDLERS ====================
  const handleExtendTime = (task) => {
    setSelectedTask(task);
    setExtensionData({ newDueDate: "", reason: "" });
    setShowExtensionModal(true);
  };

  const submitExtension = async () => {
    if (!extensionData.newDueDate || !extensionData.reason.trim()) {
      alert("Please provide both new due date and reason");
      return;
    }

    try {
      const isExecute = extensionExecution?.mode === "execute";
      const url = isExecute
        ? `http://localhost:4000/api/tasks/${selectedTask._id}/extend-due`
        : `http://localhost:4000/api/tasks/${selectedTask._id}/request-extension`;
      const method = isExecute ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          newDueDate: extensionData.newDueDate,
          reason: extensionData.reason
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(isExecute ? "Extension executed." : "Time extension request sent.");
        fetchTasks();
        setShowExtensionModal(false);
        setSelectedTask(null);
        setExtensionExecution(null);
        setExtensionData({ newDueDate: "", reason: "" });
      } else {
        alert(data.error || "Failed to extend time");
      }
    } catch (err) {
      console.error("Extension error:", err);
      alert("Error extending time");
    }
  };

  // ==================== REOPEN TASK HANDLERS ====================
  const handleReopenTask = (task) => {
    setSelectedTask(task);
    setReopenReason("");
    setShowReopenModal(true);
  };

  const submitReopen = async () => {
    if (!reopenReason.trim()) {
      alert("Please provide a reason for reopening");
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/reopen`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ reason: reopenReason })
      });

      const data = await res.json();
      if (data.success) {
        alert(" Task reopened successfully!");
        fetchTasks();
        setShowReopenModal(false);
        setSelectedTask(null);
      } else {
        alert(data.error || "Failed to reopen task");
      }
    } catch (err) {
      console.error("Reopen error:", err);
      alert("Error reopening task");
    }
  };

  // ==================== REASSIGN HANDLERS ====================
  const handleReassignTask = (task) => {
    setSelectedTask(task);
    setReassignForm({
      newEmployeeId: "",
      reason: "",
      handoverNotes: ""
    });
    setShowReassignModal(true);
  };

  const submitReassign = async () => {
    if (!reassignForm.newEmployeeId) {
      alert("Please select an employee to reassign");
      return;
    }
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/reassign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          newEmployeeId: reassignForm.newEmployeeId,
          reason: reassignForm.reason || "Admin reassignment",
          handoverNotes: reassignForm.handoverNotes || ""
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(" Task reassigned successfully!");
        fetchTasks();
        setShowReassignModal(false);
        setSelectedTask(null);
      } else {
        alert(data.error || "Failed to reassign task");
      }
    } catch (err) {
      console.error("Reassign error:", err);
      alert("Error reassigning task");
    }
  };

  const submitApprovedModification = async () => {
    if (!selectedTask || !modExecution?.requestId) return;
    if (!editFormData.title.trim()) {
      alert("Title is required");
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${selectedTask._id}/approve-modification-request/${modExecution.requestId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            adminNote: editAdminNote.trim() || "Executed after employee approval (admin adjusted)",
            proposedChanges: {
              title: editFormData.title,
              description: editFormData.description,
              category: editFormData.category,
              dueDate: editFormData.dueDate,
              priority: editFormData.priority
            }
          })
        }
      );

      const data = await res.json();
      if (data.success) {
        alert(" Approved modification executed.");
        fetchTasks();
        setShowEditModal(false);
        setSelectedTask(null);
        setModExecution(null);
        setEditAdminNote("");
      } else {
        alert(data.error || "Failed to execute approved modification");
      }
    } catch (err) {
      console.error("Execute approved modification error:", err);
      alert("Error executing approved modification");
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitEmployeeRequestExecution = async () => {
    if (!selectedTask || !modExecution?.requestId) return;

    setEditSubmitting(true);
    try {
      const payload = {
        adminNote: editAdminNote.trim() || "Approved and executed by admin"
      };

      if (modExecution.requestType === "edit") {
        if (!editFormData.title.trim()) {
          alert("Title is required");
          setEditSubmitting(false);
          return;
        }
        payload.proposedChanges = {
          title: editFormData.title,
          description: editFormData.description,
          category: editFormData.category,
          dueDate: editFormData.dueDate,
          priority: editFormData.priority
        };
      }

      if (modExecution.requestType === "extension") {
        if (!editFormData.dueDate) {
          alert("New due date is required");
          setEditSubmitting(false);
          return;
        }
        payload.requestedExtension = editFormData.dueDate;
      }

      const res = await fetch(
        `http://localhost:4000/api/tasks/${selectedTask._id}/execute-employee-modification/${modExecution.requestId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      if (data.success) {
        alert(" Employee request executed.");
        fetchTasks();
        setShowEditModal(false);
        setSelectedTask(null);
        setModExecution(null);
        setEditAdminNote("");
      } else {
        alert(data.error || "Failed to execute employee request");
      }
    } catch (err) {
      console.error("Execute employee request error:", err);
      alert("Error executing employee request");
    } finally {
      setEditSubmitting(false);
    }
  };

  const formatDuration = (ms) => {
    if (ms == null) return "?";
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

  const getReopenSlaMeta = (task) => {
    if (!task?.reopenDueAt) return null;
    const remainingMs = new Date(task.reopenDueAt).getTime() - Date.now();
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

  const getLatestModRequest = (task) => {
    const list = task?.modificationRequests || [];
    if (list.length === 0) return null;
    return list.slice().sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];
  };

  const getModStatusBadge = (task) => {
    const latest = getLatestModRequest(task);
    if (!latest) return null;
    const exp = latest.expiresAt ? new Date(latest.expiresAt).getTime() : null;
    const isExpired = latest.status === "pending" && exp != null && exp <= Date.now();
    if (isExpired) {
      return { label: "MOD EXPIRED", className: "bg-red-700 text-white" };
    }
    const normalized = String(latest.status || "").toLowerCase();
    if (normalized === "pending") return { label: "MOD PENDING", className: "bg-orange-600 text-white" };
    if (normalized === "approved") return { label: "MOD APPROVED", className: "bg-green-600 text-white" };
    if (normalized === "rejected") return { label: "MOD REJECTED", className: "bg-red-600 text-white" };
    if (normalized === "executed") return { label: "MOD EXECUTED", className: "bg-blue-600 text-white" };
    if (normalized === "counter_proposed") return { label: "COUNTER PROPOSED", className: "bg-yellow-600 text-black" };
    return { label: `MOD ${normalized.toUpperCase()}`, className: "bg-slate-600 text-white" };
  };

  const getLastTimelineEvent = (task) => {
    const timeline = task?.activityTimeline || [];
    if (timeline.length === 0) return null;
    return timeline[timeline.length - 1];
  };

  const formatTimelineAction = (action) => {
    if (!action) return "-";
    return action.replace(/_/g, " ");
  };

  const formatDateTime = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleString('en-GB');
    } catch {
      return "-";
    }
  };

  const toggleCard = (taskId) => {
    setExpandedCards(prev => ({ ...prev, [taskId]: !prev[taskId] }));
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

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading tasks...</div>;
  }

  if (view === "reassign") {
  
  return (
      <div className="space-y-6">
        {/* ==================== WITHDRAWN TASKS ==================== */}
        {withdrawnTasks.length > 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
              <span className="text-2xl"></span> Withdrawn Tasks ({withdrawnTasks.length})
            </h2>
            <div className="space-y-3">
              {withdrawnTasks.map(task => (
                <div key={task._id} className="bg-gray-700 rounded p-4 border border-orange-700 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    <p className="text-sm text-orange-300">Status: Withdrawn</p>
                  </div>
                  <button
                    onClick={() => handleReassignTask(task)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium"
                  >
                    Reassign (Withdrawn)
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">No withdrawn tasks to reassign</div>
        )}

        {/* ==================== REASSIGN TASKS ==================== */}
      {reassignEligibleTasks.length > 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
              <span className="text-2xl"></span> Reassign Tasks ({reassignEligibleTasks.length})
            </h2>
            <div className="space-y-3">
              {reassignEligibleTasks.map(task => {
                const isWithdrawn = task.status === "withdrawn";
                const isDeclinedAssign = task.status === "declined_by_employee" && task.declineType === "assignment_decline";
              
  return (
                  <div key={task._id} className="bg-gray-700 rounded p-4 border border-purple-700 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{task.title}</h3>
                      <p className="text-sm text-gray-300">
                        {isWithdrawn && <span className="font-semibold text-orange-300">Withdrawn</span>}
                        {isDeclinedAssign && <span className="font-semibold text-yellow-300">Declined (Assignment)</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReassignTask(task)}
                      className={`px-3 py-2 text-white rounded text-sm font-medium ${
                        isWithdrawn ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {isWithdrawn ? "Reassign (Withdrawn)" : "Reassign (Declined)"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">No declined assignment tasks to reassign</div>
        )}

        {/* ==================== RECENTLY REASSIGNED ==================== */}
        {recentlyReassignedTasks.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
              <span className="text-2xl"></span> Recently Reassigned ({recentlyReassignedTasks.length})
            </h2>
            <div className="space-y-3">
              {recentlyReassignedTasks.map(task => {
                const lastReassign = [...(task.activityTimeline || [])]
                  .reverse()
                  .find(a => a.action === "TASK_REASSIGNED");
              
  return (
                  <div key={task._id} className="bg-gray-700 rounded p-4 border border-blue-700 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{task.title}</h3>
                      <p className="text-sm text-gray-300">Current status: {task.status}</p>
                      {lastReassign?.details && (
                        <p className="text-xs text-gray-400 mt-1">{lastReassign.details}</p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/task-details/${task._id}`)}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium"
                    >
                      View Task
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== REASSIGN MODAL ==================== */}
        {showReassignModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-purple-400 mb-4"> Reassign Task</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">New Employee *</label>
                  <select
                    value={reassignForm.newEmployeeId}
                    onChange={(e) => setReassignForm({ ...reassignForm, newEmployeeId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="">Select employee</option>
                    {employees
                      .filter(e => e.status === "active")
                      .map(emp => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.email})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Reason</label>
                  <input
                    type="text"
                    value={reassignForm.reason}
                    onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="Admin reassignment"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Handover Notes</label>
                  <textarea
                    value={reassignForm.handoverNotes}
                    onChange={(e) => setReassignForm({ ...reassignForm, handoverNotes: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    rows="3"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={submitReassign}
                    disabled={!reassignForm.newEmployeeId}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => setShowReassignModal(false)}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
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
  }


  return (
    <div className="space-y-6">
      {/* ==================== FILTER SECTION ==================== */}
      {filterMode !== "all" && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xs font-semibold">FILTER</span>
            <div>
              <p className="font-semibold text-white">
                {filterMode === "extension-requests" ? "Filtered: Pending Extensions" : "Filtered: Pending Modifications"}
              </p>
              <p className="text-sm text-gray-300">
                {filterMode === "extension-requests"
                  ? `Showing ${tasksWithPendingExtensions.length} task(s) with pending extension requests`
                  : `Showing ${tasksWithPendingMods.length} task(s) with pending modification requests`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterMode("all")}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* ==================== ASSIGNED TASKS (NOT ACCEPTED) ==================== */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
          <span className="text-2xl"></span> Assigned Tasks ({assignedTasks.length})
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Tasks waiting for employee acceptance. Admin can edit or delete directly.
        </p>

        {assignedTasks.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No assigned tasks</div>
        ) : (
          <div className="space-y-3">
            {assignedTasks.map(task => {
              const modBadge = getModStatusBadge(task);
              return (
              <div key={task._id} className="bg-gray-700 rounded p-4 flex items-center justify-between border border-gray-600">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    {modBadge && (
                      <span className={`text-xs px-2 py-1 rounded ${modBadge.className}`}>
                        {modBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-500">Created: {new Date(task.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditTask(task)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                  >
                     Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
                  >
                     Delete
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* ==================== ACTIVE TASKS ==================== */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
          <span className="text-2xl"></span> Active Tasks ({activeTasks.length})
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Ongoing tasks. Request employee approval for edits/deletions. Extend time for overdue tasks.
        </p>

        {activeTasks.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No active tasks</div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map(task => {
              const hasPendingMods = task.modificationRequests && task.modificationRequests.some(r => r.status === "pending");
              const hasPendingExtensions = task.extensionRequests && task.extensionRequests.some(r => r.status === "pending");
              const latestMod = getLatestModRequest(task);
              const modBadge = getModStatusBadge(task);
              const latestModSla = latestMod ? getModSlaMeta(latestMod) : null;
              const lastEvent = getLastTimelineEvent(task);
              const reopenMeta = getReopenSlaMeta(task);
              const shouldShow =
                filterMode === "all" ||
                (filterMode === "pending-mods" && hasPendingMods) ||
                (filterMode === "extension-requests" && hasPendingExtensions);
              
              return shouldShow ? (
              <div 
                key={task._id} 
                id={`task-${task._id}`}
                className={`rounded p-4 border flex items-center justify-between transition-all ${
                  highlightTaskId === task._id
                    ? "bg-yellow-700/40 border-yellow-500 ring-2 ring-yellow-400"
                    : isOverdue(task) 
                      ? "bg-red-900/30 border-red-700" 
                      : "bg-gray-700 border-gray-600"
                }`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    {isOverdue(task) && (
                      <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">OVERDUE</span>
                    )}
                    {hasPendingMods && (
                      <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded animate-pulse" title="Modification request pending employee approval"> MODIFICATION PENDING</span>
                    )}
                    {task.extensionRequests && task.extensionRequests.some(r => r.status === "pending") && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded" title="Extension request pending"> EXTENSION PENDING</span>
                    )}
                    {modBadge && !hasPendingMods && (
                      <span className={`text-xs px-2 py-1 rounded ${modBadge.className}`}>
                        {modBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    Status: <span className="font-medium">{task.status}</span> | 
                    Assigned to: {task.assignedTo?.name || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">Due: {new Date(task.dueDate).toLocaleDateString('en-GB')}</p>
                  {latestMod && (
                    <div className="mt-2 text-xs text-gray-300 space-y-1">
                      <div>
                        Mod Request: <span className="font-semibold">{latestMod.requestType}</span>{" "}
                        <span className="text-gray-400">({latestMod.status})</span>
                      </div>
                      <div className="text-gray-400">Reason: {latestMod.reason}</div>
                      {latestModSla && (
                        <div className={getSlaLevelClasses(latestModSla.level)}>
                          {latestModSla.label}
                        </div>
                      )}
                      {latestMod.employeeViewedAt && (
                        <div className="text-gray-400">Employee viewed: {new Date(latestMod.employeeViewedAt).toLocaleString('en-GB')}</div>
                      )}
                    </div>
                  )}
                  {task.reopenDueAt && (
                    <div className={`mt-2 text-xs ${getSlaLevelClasses(getReopenSlaMeta(task)?.level)}`}>
                      Reopen SLA: {getReopenSlaMeta(task)?.label || "-"}
                    </div>
                  )}

                  <button
                    onClick={() => toggleCard(task._id)}
                    className="mt-3 text-xs text-blue-300 hover:underline"
                  >
                    {expandedCards[task._id] ? "Hide Timeline" : "View Timeline"}
                  </button>

                  {expandedCards[task._id] && (
                    <div className="mt-3 bg-[#0f172a] border border-gray-700 rounded p-3 text-xs space-y-2">
                      <div className="text-gray-300 font-semibold">Compact Timeline</div>
                      <div className="text-gray-400">
                        Last Activity:{" "}
                        <span className="text-gray-200">
                          {lastEvent
                            ? `${formatTimelineAction(lastEvent.action)}  ${formatDateTime(lastEvent.createdAt || lastEvent.timestamp)}`
                            : "No activity"}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        Reopen SLA:{" "}
                        <span className={getSlaLevelClasses(reopenMeta?.level)}>
                          {reopenMeta?.label || "-"}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        Latest Mod Request:{" "}
                        <span className="text-gray-200">
                          {latestMod
                            ? `${latestMod.requestType}  ${latestMod.status}`
                            : "None"}
                        </span>
                      </div>
                      {latestMod?.requestedAt && (
                        <div className="text-gray-500">
                          Requested: {formatDateTime(latestMod.requestedAt)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleModificationRequest(task)}
                    title="Request employee approval for edit/delete"
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium"
                  >
                     Request Change
                  </button>
                  {isOverdue(task) && (
                    <button
                      onClick={() => handleExtendTime(task)}
                      title="Extend due date"
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
                    >
                       Extend Time
                    </button>
                  )}
                </div>
              </div>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* ==================== COMPLETED TASKS FOR VERIFICATION ==================== */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
          <span className="text-2xl"></span> Completed Tasks Awaiting Review ({completedTasks.length})
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Tasks submitted for review. Admin can verify or reopen for corrections.
        </p>

        {completedTasks.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No completed tasks awaiting review</div>
        ) : (
          <div className="space-y-3">
            {completedTasks.map(task => {
              const modBadge = getModStatusBadge(task);
              return (
              <div key={task._id} className="bg-gray-700 rounded p-4 flex items-center justify-between border border-gray-600">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    {modBadge && (
                      <span className={`text-xs px-2 py-1 rounded ${modBadge.className}`}>
                        {modBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">Completed by: {task.assignedTo?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-500">Submitted: {new Date(task.updatedAt).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/task-details/${task._id}`)}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium"
                  >
                     Review
                  </button>
                  <button
                    onClick={() => handleReopenTask(task)}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium"
                  >
                     Reopen
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* ==================== FAILED TASKS ==================== */}
      {failedTasks.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span> Failed Tasks ({failedTasks.length})
          </h2>
          <div className="space-y-3">
            {failedTasks.map(task => (
              <div key={task._id} className="bg-gray-700 rounded p-4 border border-red-700 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white">{task.title}</h3>
                  <p className="text-sm text-red-300">Status: Failed</p>
                </div>
                <button
                  onClick={() => navigate(`/task-details/${task._id}`)}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.filter(t => t.status === "reopened").length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span> Reopened Tasks ({tasks.filter(t => t.status === "reopened").length})
          </h2>
          <div className="space-y-3">
            {tasks.filter(t => t.status === "reopened").map(task => {
              const modBadge = getModStatusBadge(task);
              return (
              <div key={task._id} className="bg-gray-700 rounded p-4 border border-orange-700 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    {modBadge && (
                      <span className={`text-xs px-2 py-1 rounded ${modBadge.className}`}>
                        {modBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">Assigned to: {task.assignedTo?.name || "Unknown"}</p>
                  {task.reopenDueAt && (
                    <p className={`text-sm ${getSlaLevelClasses(getReopenSlaMeta(task)?.level)}`}
                    >
                    {getReopenSlaMeta(task)?.label || `Due: ${new Date(task.reopenDueAt).toLocaleDateString('en-GB')}`}
                  </p>
                  )}
                  {task.reopenSlaStatus && (
                    <p className="text-sm text-gray-400">SLA Status: {task.reopenSlaStatus}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReopenTask(task)}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium"
                  >
                    Reopen Details
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}
      {/* ==================== DECLINED ASSIGNMENT TASKS ==================== */}
      {declinedAssignmentTasks.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span> Declined Tasks (Assignment) ({declinedAssignmentTasks.length})
          </h2>
          <div className="space-y-3">
            {declinedAssignmentTasks.map(task => {
              const modBadge = getModStatusBadge(task);
              return (
              <div key={task._id} className="bg-gray-700 rounded p-4 border border-yellow-700 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    {modBadge && (
                      <span className={`text-xs px-2 py-1 rounded ${modBadge.className}`}>
                        {modBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-yellow-300">Status: Declined (Assignment)</p>
                </div>
                <button
                  onClick={() => handleReassignTask(task)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                >
                  Reassign (Declined)
                </button>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* ==================== WITHDRAWN TASKS ==================== */}
      {withdrawnTasks.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span> Withdrawn Tasks ({withdrawnTasks.length})
          </h2>
          <div className="space-y-3">
            {withdrawnTasks.map(task => {
              const modBadge = getModStatusBadge(task);
              return (
              <div key={task._id} className="bg-gray-700 rounded p-4 border border-orange-700 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    {modBadge && (
                      <span className={`text-xs px-2 py-1 rounded ${modBadge.className}`}>
                        {modBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-orange-300">Status: Withdrawn</p>
                </div>
                <button
                  onClick={() => handleReassignTask(task)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium"
                >
                  Reassign (Withdrawn)
                </button>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* ==================== REASSIGN TASKS ==================== */}
      {reassignEligibleTasks.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span> Reassign Tasks ({reassignEligibleTasks.length})
          </h2>
          <div className="space-y-3">
            {reassignEligibleTasks.map(task => {
              const isWithdrawn = task.status === "withdrawn";
              const isDeclinedAssign = task.status === "declined_by_employee" && task.declineType === "assignment_decline";
            
  return (
                <div key={task._id} className="bg-gray-700 rounded p-4 border border-purple-700 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{task.title}</h3>
                    <p className="text-sm text-gray-300">
                      {isWithdrawn && <span className="font-semibold text-orange-300">Withdrawn</span>}
                      {isDeclinedAssign && <span className="font-semibold text-yellow-300">Declined (Assignment)</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReassignTask(task)}
                    className={`px-3 py-2 text-white rounded text-sm font-medium ${
                      isWithdrawn ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isWithdrawn ? "Reassign (Withdrawn)" : "Reassign (Declined)"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== EDIT MODAL ==================== */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {modExecution
                ? (modExecution.origin === "employee"
                    ? " Execute Employee Request"
                    : " Execute Approved Edit")
                : " Edit Task"}
            </h3>
            {modExecution && (
              <div className="mb-4 bg-emerald-900/20 border border-emerald-700 rounded p-3 text-sm text-emerald-200">
                {modExecution.origin === "employee"
                  ? "Employee request selected. Review and execute the changes."
                  : "Employee approval received. Review and adjust fields, then execute to apply the changes."}
              </div>
            )}
            <div className="space-y-4">
              {modExecution?.requestType === "extension" ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Task</label>
                    <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white">
                      {selectedTask?.title || "Task"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">New Due Date *</label>
                    <input
                      type="date"
                      value={editFormData.dueDate}
                      onChange={(e) => setEditFormData({...editFormData, dueDate: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Title *</label>
                    <input
                      type="text"
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Description</label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      rows="3"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Category</label>
                      <input
                        type="text"
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Priority</label>
                      <select
                        value={editFormData.priority}
                        onChange={(e) => setEditFormData({...editFormData, priority: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
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
                      value={editFormData.dueDate}
                      onChange={(e) => setEditFormData({...editFormData, dueDate: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                </>
              )}
              {modExecution && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Admin Note (optional)</label>
                  <textarea
                    value={editAdminNote}
                    onChange={(e) => setEditAdminNote(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    rows="2"
                    placeholder="Execution note for audit log"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={
                    modExecution
                      ? (modExecution.origin === "employee"
                          ? submitEmployeeRequestExecution
                          : submitApprovedModification)
                      : submitEditTask
                  }
                  disabled={editSubmitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium"
                >
                  {editSubmitting
                    ? "Working..."
                    : (modExecution ? "Execute Changes" : "Save Changes")}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setModExecution(null);
                    setEditAdminNote("");
                  }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE MODAL ==================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-400 mb-4"> Delete Task</h3>
            <div className="bg-red-900/20 border border-red-700 rounded p-3 mb-4">
              <p className="text-sm text-red-300">Are you sure? This task will be marked as deleted.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason for Deletion *</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Explain why you're deleting this task..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitDeleteTask}
                  disabled={deleteReason.trim().length < 5}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODIFICATION REQUEST MODAL ==================== */}
      {showModificationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-purple-400 mb-4"> Request Modification</h3>
            <p className="text-sm text-gray-400 mb-4">
              Send a request to the employee to approve modifications.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Type of Change</label>
                <select
                  value={modificationData.type}
                  onChange={(e) => setModificationData({...modificationData, type: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="edit">Edit Task</option>
                  <option value="delete">Delete Task</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Response SLA (hours)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[12, 24, 48, 72].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setModificationData({ ...modificationData, slaHours: h })}
                      className={`px-2 py-1 rounded text-xs border ${
                        Number(modificationData.slaHours) === h
                          ? "bg-indigo-700 border-indigo-500 text-white"
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
                  value={modificationData.slaHours}
                  onChange={(e) => setModificationData({...modificationData, slaHours: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Response due by: {new Date(Date.now() + (Number(modificationData.slaHours) || 24) * 60 * 60 * 1000).toLocaleString("en-GB")}
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason *</label>
                <textarea
                  value={modificationData.reason}
                  onChange={(e) => setModificationData({...modificationData, reason: e.target.value})}
                  placeholder="Explain why you want to make this change..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows="3"
                />
              </div>
              {modificationData.type === "edit" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300 font-semibold">Proposed Changes</p>
                  <input
                    value={modificationData.proposedChanges.title}
                    onChange={(e) => setModificationData({
                      ...modificationData,
                      proposedChanges: { ...modificationData.proposedChanges, title: e.target.value }
                    })}
                    placeholder="Title"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <textarea
                    value={modificationData.proposedChanges.description}
                    onChange={(e) => setModificationData({
                      ...modificationData,
                      proposedChanges: { ...modificationData.proposedChanges, description: e.target.value }
                    })}
                    placeholder="Description"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    rows="3"
                  />
                  <input
                    type="date"
                    value={modificationData.proposedChanges.dueDate}
                    onChange={(e) => setModificationData({
                      ...modificationData,
                      proposedChanges: { ...modificationData.proposedChanges, dueDate: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                  <select
                    value={modificationData.proposedChanges.priority}
                    onChange={(e) => setModificationData({
                      ...modificationData,
                      proposedChanges: { ...modificationData.proposedChanges, priority: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="">Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              )}
              {modificationData.type === "delete" && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Deletion Impact Note</label>
                  <textarea
                    value={modificationData.impactNote}
                    onChange={(e) => setModificationData({...modificationData, impactNote: e.target.value})}
                    placeholder="Explain impact of deletion..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    rows="3"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={submitModificationRequest}
                  disabled={
                    modificationData.reason.trim().length < 10 ||
                    (modificationData.type === "delete" && modificationData.impactNote.trim().length < 10)
                  }
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50"
                >
                  Send Request
                </button>
                <button
                  onClick={() => setShowModificationModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EXTENSION MODAL ==================== */}
      {showExtensionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-green-400 mb-4"> Extend Due Date</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">New Due Date *</label>
                <input
                  type="date"
                  value={extensionData.newDueDate}
                  onChange={(e) => setExtensionData({...extensionData, newDueDate: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason for Extension *</label>
                <textarea
                  value={extensionData.reason}
                  onChange={(e) => setExtensionData({...extensionData, reason: e.target.value})}
                  placeholder="Why is more time needed?"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitExtension}
                  disabled={!extensionData.newDueDate || !extensionData.reason.trim()}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium disabled:opacity-50"
                >
                  Grant Extension
                </button>
                <button
                  onClick={() => setShowExtensionModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== REOPEN MODAL ==================== */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-orange-400 mb-4"> Reopen Task</h3>
            <p className="text-sm text-gray-400 mb-4">
              Send this task back to the employee for corrections.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason for Reopening *</label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="What needs to be corrected?"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitReopen}
                  disabled={!reopenReason.trim()}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium disabled:opacity-50"
                >
                  Reopen
                </button>
                <button
                  onClick={() => setShowReopenModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== REASSIGN MODAL ==================== */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-purple-400 mb-4"> Reassign Task</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">New Employee *</label>
                <select
                  value={reassignForm.newEmployeeId}
                  onChange={(e) => setReassignForm({ ...reassignForm, newEmployeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="">Select employee</option>
                  {employees
                    .filter(e => e.status === "active")
                    .map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason</label>
                <input
                  type="text"
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="Admin reassignment"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Handover Notes</label>
                <textarea
                  value={reassignForm.handoverNotes}
                  onChange={(e) => setReassignForm({ ...reassignForm, handoverNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitReassign}
                  disabled={!reassignForm.newEmployeeId}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50"
                >
                  Reassign
                </button>
                <button
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
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

export default TaskManagementPanel;


