import React, { useState, useEffect, useContext } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";
import TaskEditModal from "../Admin/TaskEditModal";
import TaskDeleteModal from "../Admin/TaskDeleteModal";
import RequestModificationModal from "../Admin/RequestModificationModal";
import { API_BASE_URL } from "../../config/api";

const API_BASE = `${API_BASE_URL}/api/tasks`;
const toAbsoluteFileUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
};

const TaskDetails = () => {
  const location = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showReopenActions, setShowReopenActions] = useState(false);
  const [resolutionInfo, setResolutionInfo] = useState(null);
  const [workSubmissionContext, setWorkSubmissionContext] = useState(null);
  const [showExpandedDebug, setShowExpandedDebug] = useState(false);
  
  // Modal states for edit/delete/modification
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [expandedModificationRequestId, setExpandedModificationRequestId] = useState(null);
  const [showAllModificationTimeline, setShowAllModificationTimeline] = useState(false);

  useEffect(() => {
    console.log("🟢 TaskDetails MOUNTED with ID:", id);
    return () => {
      console.log("🔴 TaskDetails UNMOUNTED");
    };
  }, []);

  const fromEmployeeInsights = location.state?.fromEmployeeInsights;
  const returnPath = location.state?.returnPath;
  const returnState = location.state?.returnState;
  const requestedTab = location.state?.activeTab;

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  useEffect(() => {
    console.log("🔍 TaskDetails useEffect triggered");
    console.log("📍 Return path from state:", returnPath);
    
    if (id) {
      fetchTaskDetails();
    } else {
      setError("No task ID provided");
      setLoading(false);
    }
  }, [id]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const token = user?.token || localStorage.getItem("token");
      
      console.log("🔍 Fetching task details for ID:", id);
      
      const response = await fetch(`${API_BASE}/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch task");
      }
      
      const taskData = data.task;
      
      console.log("✅ Task loaded:", {
        id: taskData._id,
        title: taskData.title,
        status: taskData.status,
        hasDescription: !!taskData.description,
        assignedTo: taskData.assignedTo?.name,
        resolution: taskData.resolution,
        workSubmission: taskData.workSubmission,
        activityTimelineLength: taskData.activityTimeline?.length || 0
      });
      
      // Process the task data
      processTaskData(taskData);
      
    } catch (err) {
      console.error("❌ Error fetching task details:", err);
      setError(`Failed to load task details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processTaskData = (taskData) => {
    setTask(taskData);
    
    // Set resolution info from backend
    if (taskData.resolution) {
      setResolutionInfo(taskData.resolution);
    } else {
      // Fallback resolution calculation
      setResolutionInfo(calculateResolution(taskData));
    }
    
    // Process work submission context
    if (taskData.workSubmission) {
      const context = {
        hasSubmission: hasWorkSubmission(taskData),
        version: taskData.workSubmission.version || 1,
        submittedAt: taskData.workSubmission.submittedAt || taskData.completedAt,
        employeeNote: taskData.workSubmission.employeeNote || "",
        submissionStatus: taskData.workSubmission.submissionStatus || "pending",
        isReopenPhase: isReopenPhase(taskData)
      };
      
      if (context.isReopenPhase) {
        const lastReopenIndex = taskData.activityTimeline?.findLastIndex(a => a.action === "TASK_REOPENED");
        context.isOriginalSubmission = !taskData.activityTimeline
          ?.slice(lastReopenIndex)
          .some(a => a.action === "TASK_COMPLETED");
      }
      
      setWorkSubmissionContext(context);
    }
    
    // Check for reopen actions
    if (taskData.status === "reopened" && user?.role === "employee") {
      const isAssignedEmployee = taskData.assignedTo && 
        taskData.assignedTo._id === user.id;
      
      if (isAssignedEmployee) {
        setShowReopenActions(true);
      }
    }
  };

  useEffect(() => {
    const markReopenViewed = async () => {
      if (!task || !user) return;
      if (user.role !== "employee") return;
      if (task.status !== "reopened") return;
      if (task.assignedTo?._id !== user.id) return;
      if (task.reopenViewedAt) return;

      try {
        const token = user?.token || localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/${task._id}/reopen/viewed`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setTask(prev => prev ? { ...prev, reopenViewedAt: data.reopenViewedAt || new Date().toISOString() } : prev);
        }
      } catch (err) {
        console.error("Failed to mark reopen viewed:", err);
      }
    };

    markReopenViewed();
  }, [task, user]);

  // Helper functions
  const hasWorkSubmission = (task) => {
    if (!task || !task.workSubmission) return false;
    
    const work = task.workSubmission;
    const hasLink = work.link && work.link.trim().length > 0;
    const hasFiles = work.files && Array.isArray(work.files) && work.files.length > 0;
    const hasNote = work.employeeNote && work.employeeNote.trim().length > 0;
    
    return hasLink || hasFiles || hasNote;
  };

  const isReopenPhase = (task) => {
    if (!task) return false;
    return task.status === "reopened" || 
           task.activityTimeline?.some(a => a.action === "TASK_REOPENED");
  };

  const calculateResolution = (task) => {
    const actions = task.activityTimeline?.map(a => a.action) || [];
    const hasReopen = actions.includes("TASK_REOPENED");
    const lastAction = actions[actions.length - 1];
    
    // Assignment Declined
    if (actions.includes("TASK_DECLINED") && !hasReopen) {
      return {
        code: "DECLINED_ASSIGNMENT",
        label: "Assignment Declined",
        severity: "neutral",
        phase: "assignment",
        isFinal: true
      };
    }
    
    // Reopen Declined
    if (actions.includes("TASK_REOPEN_DECLINED")) {
      if (lastAction === "TASK_VERIFIED") {
        return {
          code: "REOPEN_DECLINED_VERIFIED",
          label: "Original Work Accepted",
          severity: "positive",
          phase: "reopen",
          isFinal: true
        };
      } else if (lastAction === "TASK_FAILED") {
        return {
          code: "REOPEN_DECLINED_FAILED",
          label: "Rework Declined - Failed",
          severity: "critical",
          phase: "reopen",
          isFinal: true
        };
      } else {
        return {
          code: "REOPEN_DECLINED_PENDING",
          label: "Rework Declined - Pending Review",
          severity: "warning",
          phase: "reopen",
          isFinal: false
        };
      }
    }
    
    // Reopen Failed
    if (hasReopen && task.status === "failed") {
      const lastReopenIndex = actions.lastIndexOf("TASK_REOPENED");
      const hasResubmission = actions.slice(lastReopenIndex).includes("TASK_COMPLETED");
      
      if (hasResubmission) {
        return {
          code: "REOPEN_FAILED_AFTER_REWORK",
          label: "Rework Failed",
          severity: "critical",
          phase: "reopen",
          isFinal: true
        };
      } else {
        return {
          code: "REOPEN_FAILED_WITHOUT_REWORK",
          label: "Failed Without Rework",
          severity: "critical",
          phase: "reopen",
          isFinal: true
        };
      }
    }
    
    // First Submission Failed
    if (task.status === "failed" && !hasReopen) {
      return {
        code: "FAILED_EXECUTION",
        label: "Work Did Not Meet Expectations",
        severity: "critical",
        phase: "first_submission",
        isFinal: true
      };
    }
    
    // Verified After Reopen
    if (hasReopen && task.status === "verified") {
      const lastReopenIndex = actions.lastIndexOf("TASK_REOPENED");
      const hasResubmission = actions.slice(lastReopenIndex).includes("TASK_COMPLETED");
      
      if (hasResubmission) {
        return {
          code: "REOPEN_VERIFIED_WITH_RESUBMISSION",
          label: "Verified After Rework",
          severity: "positive",
          phase: "reopen",
          isFinal: true
        };
      } else {
        return {
          code: "REOPEN_VERIFIED_WITHOUT_RESUBMISSION",
          label: "Original Work Accepted",
          severity: "positive",
          phase: "reopen",
          isFinal: true
        };
      }
    }
    
    // Normal Successful Completion
    if (task.status === "verified" && !hasReopen) {
      return {
        code: "SUCCESSFUL",
        label: "Verified",
        severity: "positive",
        phase: "first_submission",
        isFinal: true
      };
    }
    
    // Still Active
    if (["assigned", "accepted", "in_progress", "completed"].includes(task.status)) {
      return {
        code: "ACTIVE",
        label: "In Progress",
        severity: "info",
        phase: "active",
        isFinal: false
      };
    }
    
    // Reopened and Waiting
    if (task.status === "reopened") {
      return {
        code: "REOPEN_PENDING",
        label: "Reopened - Pending",
        severity: "warning",
        phase: "reopen",
        isFinal: false
      };
    }
    
    // Default
    return {
      code: "UNKNOWN",
      label: "Unknown",
      severity: "neutral",
      phase: "unknown",
      isFinal: false
    };
  };

  const getResolutionSeverityColor = (severity) => {
    switch(severity) {
      case "positive": return "bg-green-900/30 text-green-400 border-green-800";
      case "critical": return "bg-red-900/30 text-red-400 border-red-800";
      case "warning": return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
      case "info": return "bg-blue-900/30 text-blue-400 border-blue-800";
      case "neutral": return "bg-gray-900/30 text-gray-400 border-gray-800";
      default: return "bg-gray-900/30 text-gray-400 border-gray-800";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return "—";
    }
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (err) {
      return "—";
    }
  };

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

  const getReopenSlaMeta = () => {
    if (!task?.reopenDueAt) return null;
    const due = new Date(task.reopenDueAt).getTime();
    const now = Date.now();
    const remainingMs = due - now;
    const lastReopenEvent = task.activityTimeline
      ?.slice()
      .reverse()
      .find(e => e.action === "TASK_REOPENED");
    const reopenedAt = lastReopenEvent?.createdAt ? new Date(lastReopenEvent.createdAt).getTime() : null;
    const totalMs = reopenedAt ? (due - reopenedAt) : null;
    const percentLeft = totalMs && totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : null;

    let level = "neutral";
    if (percentLeft !== null) {
      if (percentLeft < 0.2) level = "danger";
      else if (percentLeft < 0.5) level = "warning";
    } else {
      if (remainingMs <= 0) level = "danger";
      else if (remainingMs <= 12 * 60 * 60 * 1000) level = "warning";
    }

    return {
      remainingMs,
      percentLeft,
      level,
      label: remainingMs > 0 ? `Respond within ${formatDuration(remainingMs)}` : "SLA expired"
    };

  const getSlaLevelClasses = (level) => {
    switch (level) {
      case "danger":
        return "bg-red-900/30 border-red-800 text-red-300";
      case "warning":
        return "bg-yellow-900/30 border-yellow-800 text-yellow-300";
      default:
        return "bg-gray-800 border-gray-700 text-gray-300";
    }
  };
  };

  const getEmployeeName = () => {
    if (!task) return "Loading...";
    
    if (task.assignedTo && typeof task.assignedTo === 'object') {
      return task.assignedTo.name || 
             task.assignedTo.email || 
             `Employee ${task.assignedTo._id?.substring(0, 8) || 'Unknown'}`;
    }
    
    return "Not Assigned";
  };

  const getPriorityInfo = () => {
    if (!task) return { color: "text-gray-400", bg: "bg-gray-800", label: "Unknown", icon: "❓" };
    
    const priority = task.priority || "medium";
    const priorityLower = String(priority).toLowerCase();
    
    if (priorityLower.includes('high') || priority === '3') {
      return { color: "text-red-400", bg: "bg-red-900/30", label: "High", icon: "🔴" };
    }
    if (priorityLower.includes('medium') || priority === '2') {
      return { color: "text-yellow-400", bg: "bg-yellow-900/30", label: "Medium", icon: "🟡" };
    }
    if (priorityLower.includes('low') || priority === '1') {
      return { color: "text-green-400", bg: "bg-green-900/30", label: "Low", icon: "🟢" };
    }
    
    return { color: "text-blue-400", bg: "bg-blue-900/30", label: "Normal", icon: "⚡" };
  };

  const calculateLateStatus = () => {
    if (!task?.dueDate) return null;
    
    const dueDate = new Date(task.dueDate);
    const submittedDate = task.completedAt ? new Date(task.completedAt) : null;
    const now = new Date();
    
    if (submittedDate) {
      if (submittedDate > dueDate) {
        const daysLate = Math.floor((submittedDate - dueDate) / (1000 * 60 * 60 * 24));
        return { 
          status: "late", 
          days: daysLate, 
          message: `Submitted ${daysLate} day${daysLate !== 1 ? 's' : ''} late`,
          date: submittedDate
        };
      }
      return { 
        status: "ontime", 
        message: "Submitted on time",
        date: submittedDate
      };
    }
    
    if (now > dueDate) {
      const daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      return { 
        status: "overdue", 
        days: daysLate, 
        message: `${daysLate} day${daysLate !== 1 ? 's' : ''} overdue`,
        date: dueDate
      };
    }
    
    const daysRemaining = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));
    return { 
      status: "ontrack", 
      message: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`,
      date: dueDate
    };
  };

  const getStatusInfo = () => {
    const status = task?.status || "assigned";
    const config = {
      'assigned': { color: "bg-gray-700 text-gray-300", label: "Assigned", icon: "📋" },
      'accepted': { color: "bg-blue-900/30 text-blue-400", label: "Accepted", icon: "✅" },
      'in_progress': { color: "bg-yellow-900/30 text-yellow-400", label: "In Progress", icon: "⚡" },
      'completed': { color: "bg-purple-900/30 text-purple-400", label: "Completed", icon: "📤" },
      'verified': { color: "bg-green-900/30 text-green-400", label: "Verified", icon: "✔️" },
      'reopened': { color: "bg-orange-900/30 text-orange-400", label: "Reopened", icon: "🔄" },
      'failed': { color: "bg-red-900/30 text-red-400", label: "Failed", icon: "❌" },
      'declined_by_employee': { color: "bg-red-900/30 text-red-400", label: "Declined", icon: "🚫" },
    };
    return config[status] || { color: "bg-gray-800 text-gray-400", label: status.replace('_', ' '), icon: "📄" };
  };

  const getWorkSubmissionData = () => {
    if (!task?.workSubmission) return null;

    const hasLink = task.workSubmission.link && task.workSubmission.link.trim().length > 0;
    const hasFiles = Array.isArray(task.workSubmission.files) && task.workSubmission.files.length > 0;
    const hasNote = task.workSubmission.employeeNote && task.workSubmission.employeeNote.trim().length > 0;

    if (!hasLink && !hasFiles && !hasNote) return null;

    return {
      version: task.workSubmission.version || 1,
      link: task.workSubmission.link,
      files: task.workSubmission.files || [],
      employeeNote: task.workSubmission.employeeNote || "",
      submittedAt: task.workSubmission.submittedAt || task.completedAt,
      submissionStatus: task.workSubmission.submissionStatus || "pending"
    };
  };

  const getActivityTimeline = () => {
    if (!task?.activityTimeline) return [];
    
    return task.activityTimeline.map(event => {
      let icon = "📝";
      let description = event.action?.replace(/_/g, ' ');
      let color = "text-gray-400";
      
      switch(event.action) {
        case "TASK_CREATED":
          icon = "📌"; description = "Task created"; color = "text-blue-400";
          break;
        case "TASK_ACCEPTED":
          icon = "✅"; description = "Task accepted"; color = "text-green-400";
          break;
        case "TASK_DECLINED":
          icon = "🚫"; description = "Task declined"; color = "text-red-400";
          break;
        case "TASK_STARTED":
          icon = "🚀"; description = "Work started"; color = "text-yellow-400";
          break;
        case "TASK_COMPLETED":
          icon = "📤"; description = "Work submitted"; 
          if (event.details?.includes("v")) {
            description = `Work submitted ${event.details.match(/v(\d+)/)?.[0] || ""}`;
          }
          color = "text-purple-400";
          break;
        case "TASK_VERIFIED":
          icon = "✅"; description = "Work verified"; color = "text-green-400";
          break;
        case "TASK_FAILED":
          icon = "❌"; description = "Work failed"; color = "text-red-400";
          break;
        case "TASK_REOPENED":
          icon = "🔄"; description = "Task reopened"; color = "text-orange-400";
          break;
        case "TASK_REOPEN_ACCEPTED":
          icon = "✅"; description = "Reopen accepted"; color = "text-green-400";
          break;
        case "TASK_REOPEN_DECLINED":
          icon = "🚫"; description = "Reopen declined"; color = "text-red-400";
          break;
        case "TASK_REOPEN_TIMEOUT":
          icon = "⏱️"; description = "Reopen response timeout"; color = "text-red-400";
          break;
        case "REOPEN_VIEWED":
          icon = "--"; description = "Reopen request viewed"; color = "text-orange-300";
          break;
        case "MODIFICATION_VIEWED":
          icon = "--"; description = "Modification request viewed"; color = "text-blue-300";
          break;
        case "MODIFICATION_EXPIRED":
          icon = "-"; description = "Modification request expired"; color = "text-red-300";
          break;
        case "MODIFICATION_REQUESTED":
          icon = "MOD"; description = "Modification requested"; color = "text-blue-300";
          break;
        case "EMPLOYEE_MODIFICATION_REQUESTED":
          icon = "MOD"; description = "Employee modification requested"; color = "text-blue-300";
          break;
        case "MODIFICATION_APPROVED":
          icon = "MOD"; description = "Modification approved"; color = "text-green-300";
          break;
        case "MODIFICATION_REJECTED":
          icon = "MOD"; description = "Modification rejected"; color = "text-red-300";
          break;
        case "MODIFICATION_COUNTER_PROPOSAL":
          icon = "MOD"; description = "Modification counter proposal"; color = "text-yellow-300";
          break;
        case "MODIFICATION_MESSAGE":
          icon = "MOD"; description = "Modification discussion message"; color = "text-blue-300";
          break;
        case "EMPLOYEE_MODIFICATION_MESSAGE":
          icon = "MOD"; description = "Employee modification message"; color = "text-blue-300";
          break;
        case "EXTENSION_REQUESTED":
          icon = "EXT"; description = "Extension requested"; color = "text-yellow-300";
          break;
        case "EXTENSION_APPROVED":
          icon = "EXT"; description = "Extension approved"; color = "text-green-300";
          break;
        case "EXTENSION_REJECTED":
          icon = "EXT"; description = "Extension rejected"; color = "text-red-300";
          break;
        case "DEADLINE_EXTENDED":
          icon = "EXT"; description = "Deadline extended"; color = "text-green-300";
          break;
        case "COMMENT_ADDED":
          icon = "💬"; description = "Comment added"; color = "text-blue-400";
          break;
      }
      
      return {
        ...event,
        icon,
        description,
        color,
        actor: event.actorName || event.performedBy?.name || (event.role === "employee" ? "Employee" : "System"),
        role: event.role || "system"
      };
    }).sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
  };

  const modificationActions = new Set([
    "MODIFICATION_REQUESTED",
    "EMPLOYEE_MODIFICATION_REQUESTED",
    "MODIFICATION_APPROVED",
    "MODIFICATION_REJECTED",
    "MODIFICATION_COUNTER_PROPOSAL",
    "MODIFICATION_VIEWED",
    "MODIFICATION_EXPIRED",
    "EMPLOYEE_MODIFICATION_EXPIRED",
    "MODIFICATION_MESSAGE",
    "EMPLOYEE_MODIFICATION_MESSAGE",
    "EXTENSION_REQUESTED",
    "EXTENSION_APPROVED",
    "EXTENSION_REJECTED",
    "DEADLINE_EXTENDED"
  ]);

  const getActorLabel = (userObj, fallback = "System") => {
    if (!userObj) return fallback;
    if (typeof userObj === "string") return fallback;
    return userObj.name || userObj.email || fallback;
  };

  const getModificationRequests = () => {
    const adminRequests = Array.isArray(task?.modificationRequests)
      ? task.modificationRequests.map((req) => ({ ...req, origin: "admin" }))
      : [];
    const employeeRequests = Array.isArray(task?.employeeModificationRequests)
      ? task.employeeModificationRequests.map((req) => ({ ...req, origin: "employee" }))
      : [];

    return [...adminRequests, ...employeeRequests].sort((a, b) => {
      const aDate = new Date(a?.requestedAt || a?.createdAt || 0).getTime();
      const bDate = new Date(b?.requestedAt || b?.createdAt || 0).getTime();
      return bDate - aDate;
    });
  };

  const getModificationStatusBadge = (status) => {
    const map = {
      pending: "bg-yellow-900/40 text-yellow-300 border border-yellow-700",
      approved: "bg-blue-900/40 text-blue-300 border border-blue-700",
      executed: "bg-green-900/40 text-green-300 border border-green-700",
      rejected: "bg-red-900/40 text-red-300 border border-red-700",
      expired: "bg-red-900/40 text-red-300 border border-red-700",
      counter_proposed: "bg-orange-900/40 text-orange-300 border border-orange-700"
    };
    return map[status] || "bg-gray-800 text-gray-300 border border-gray-700";
  };

  const handleBackClick = () => {
    // If we have a specific return path, use it instead of browser history
    if (returnPath) {
      console.log("🔙 Navigating to returnPath:", returnPath);
      console.log("📦 Passing state back:", location.state);
      navigate(returnPath, { state: returnState || location.state });
    } else {
      // Fallback: navigate back in browser history
      console.log("🔙 No returnPath, using browser history");
      navigate(-1);
    }
  };

  const handleVerifyTask = async () => {
    // ✅ STEP 4: HARDEN ACTION HANDLERS - Add guard at TOP
    if (!task?.canAdminVerify) {
      alert("❌ Verification not allowed in current task state.");
      return;
    }

    try {
      const note = prompt("Add verification notes (minimum 5 characters):");
      if (!note || note.trim().length < 5) {
        alert("Verification note must be at least 5 characters");
        return;
      }
      
      const token = user?.token || localStorage.getItem("token");
      
      const response = await fetch(`${API_BASE}/${id}/verify`, {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: note.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("✅ Task verified successfully!");
        fetchTaskDetails();
      } else {
        alert(data.error || "Failed to verify task");
      }
    } catch (err) {
      console.error("Verify task error:", err);
      alert("Error verifying task: " + err.message);
    }
  };

  const handleReopenTask = async () => {
    // ✅ STEP 4: HARDEN ACTION HANDLERS - Add guard at TOP
    if (!task?.canAdminReopen) {
      alert("❌ Only verified tasks can be reopened.");
      return;
    }

    const reason = prompt("Enter reason for reopening (minimum 5 characters):");
    if (!reason || reason.length < 5) {
      alert("Reason must be at least 5 characters");
      return;
    }
    
    try {
      const token = user?.token || localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/reopen`, {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("🔄 Task reopened successfully!");
        fetchTaskDetails();
      } else {
        alert(data.error || "Failed to reopen task");
      }
    } catch (err) {
      console.error("Reopen task error:", err);
      alert("Error reopening task: " + err.message);
    }
  };

  const handleFailTask = async () => {
    // ✅ STEP 4: HARDEN ACTION HANDLERS - Add guard at TOP
    if (!task?.canAdminFail) {
      alert("❌ Task cannot be failed in current state.");
      return;
    }

    const reason = prompt("Enter failure reason (minimum 5 characters):");
    if (!reason || reason.trim().length < 5) {
      alert("Failure reason must be at least 5 characters");
      return;
    }
    
    try {
      const token = user?.token || localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/reject`, {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("❌ Task marked as failed!");
        fetchTaskDetails();
      } else {
        alert(data.error || "Failed to mark task as failed");
      }
    } catch (err) {
      console.error("Fail task error:", err);
      alert("Error marking task as failed: " + err.message);
    }
  };

  const handleAcceptReopenDecline = async () => {
    if (!window.confirm("Accept this reopen decline and verify original work-")) {
      return;
    }
    
    const note = prompt("Enter acceptance note (minimum 5 characters):");
    if (!note || note.trim().length < 5) {
      alert("Acceptance note must be at least 5 characters");
      return;
    }
    
    try {
      const token = user?.token || localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/accept-reopen-decline`, {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: note.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("✅ Reopen decline accepted. Original work verified!");
        fetchTaskDetails();
      } else {
        alert(data.error || "Failed to accept reopen decline");
      }
    } catch (err) {
      console.error("Accept reopen decline error:", err);
      alert("Failed to accept reopen decline: " + err.message);
    }
  };

  const handleAcceptReopenedTask = async () => {
    if (isReopenSlaExpired) {
      alert("Action locked - Reopen SLA expired");
      return;
    }

    if (!window.confirm("Accept this reopened task- You'll need to complete it again.")) {
      return;
    }
    
    try {
      const token = user?.token || localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/accept-reopen`, {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("✅ Reopened task accepted! You can now start working on it.");
        fetchTaskDetails();
        setShowReopenActions(false);
      } else {
        alert(data.error || "Failed to accept reopened task");
      }
    } catch (err) {
      console.error("Accept reopened task error:", err);
      alert("Failed to accept reopened task: " + err.message);
    }
  };

  const handleDeclineReopenedTask = async () => {
    if (isReopenSlaExpired) {
      alert("Action locked - Reopen SLA expired");
      return;
    }

    const reason = prompt("Enter reason for declining (minimum 5 characters):");
    if (!reason || reason.length < 5) {
      alert("Reason must be at least 5 characters");
      return;
    }
    
    if (!window.confirm("Decline this reopened task- This cannot be undone.")) {
      return;
    }
    
    try {
      const token = user?.token || localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/decline-reopen`, {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("🚫 Reopened task declined.");
        fetchTaskDetails();
        setShowReopenActions(false);
      } else {
        alert(data.error || "Failed to decline reopened task");
      }
    } catch (err) {
      console.error("Decline reopened task error:", err);
      alert("Failed to decline reopened task: " + err.message);
    }
  };

  // Enhanced Debug Information Component
  const DebugInformation = () => {
    if (!task) return null;

    const timeline = Array.isArray(task.activityTimeline) ? task.activityTimeline : [];
    
    // Build detailed reopen history
    const reopenCycles = [];
    let currentCycle = null;
    let cycleIndex = 0;

    timeline.forEach((event, idx) => {
      if (event.action === "TASK_REOPENED") {
        if (currentCycle) {
          currentCycle.endIndex = idx - 1;
          reopenCycles.push(currentCycle);
        }
        cycleIndex++;
        currentCycle = {
          cycleNumber: cycleIndex,
          reopenedAt: event.createdAt,
          adminReason: event.details || task.reopenReason || "No reason",
          adminBy: event.performedBy?.name || task.reopenedBy?.name || "Admin",
          events: [],
          hasResponse: false,
          responseType: null,
          responseAt: null,
          endIndex: timeline.length - 1
        };
      }

      if (currentCycle) {
        currentCycle.events.push({
          action: event.action,
          timestamp: event.createdAt,
          details: event.details,
          actor: event.performedBy?.name || "System"
        });

        if (event.action === "TASK_REOPEN_ACCEPTED") {
          currentCycle.hasResponse = true;
          currentCycle.responseType = "ACCEPTED";
          currentCycle.responseAt = event.createdAt;
          currentCycle.employeeReason = event.details;
        }

        if (event.action === "TASK_REOPEN_DECLINED") {
          currentCycle.hasResponse = true;
          currentCycle.responseType = "DECLINED";
          currentCycle.responseAt = event.createdAt;
          currentCycle.employeeReason = event.details || task.declineReason;
        }

        if (event.action === "TASK_VERIFIED" && currentCycle.responseType === "DECLINED") {
          currentCycle.finalOutcome = "VERIFIED_AFTER_DECLINE";
          currentCycle.finalizedAt = event.createdAt;
        }

        if (event.action === "TASK_FAILED" && currentCycle.responseType === "DECLINED") {
          currentCycle.finalOutcome = "FAILED_AFTER_DECLINE";
          currentCycle.finalizedAt = event.createdAt;
        }
      }
    });

    if (currentCycle) {
      reopenCycles.push(currentCycle);
    }

    const wasReopened = reopenCycles.length > 0;
    const reopenCount = reopenCycles.length;
    const currentReopen = reopenCycles[reopenCycles.length - 1];
    
    // Count submission versions
    const submissionVersions = timeline.filter(e => e.action === "TASK_COMPLETED").length;
    const workVersions = task.workSubmission?.version || 1;
    
    // Count action types
    const actionCounts = {};
    timeline.forEach(event => {
      actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;
    });
    
    // Check backend virtual fields
    const backendVirtuals = {
      canAdminVerify: task.canAdminVerify !== undefined ? task.canAdminVerify : "Not loaded",
      canAdminFail: task.canAdminFail !== undefined ? task.canAdminFail : "Not loaded",
      canAdminReopen: task.canAdminReopen !== undefined ? task.canAdminReopen : "Not loaded",
      hasWorkSubmission: task.hasWorkSubmission !== undefined ? task.hasWorkSubmission : "Not loaded",
      isOverdue: task.isOverdue !== undefined ? task.isOverdue : "Not loaded",
      overdueDays: task.overdueDays !== undefined ? task.overdueDays : "Not loaded"
    };
    
    // Resolution source
    const resolutionSource = task.resolution ? "Backend" : "Calculated";
    
    // Late/Ontime status
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const completedDate = task.completedAt ? new Date(task.completedAt) : null;
    const now = new Date();
    
    let timingStatus = "Unknown";
    let timingDetails = "";
    
    if (dueDate) {
      if (completedDate) {
        if (completedDate > dueDate) {
          const daysLate = Math.floor((completedDate - dueDate) / (1000 * 60 * 60 * 24));
          timingStatus = "Late Submission";
          timingDetails = `${daysLate} days late`;
        } else {
          timingStatus = "On Time";
        }
      } else if (now > dueDate) {
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        timingStatus = "Overdue";
        timingDetails = `${daysOverdue} days overdue`;
      } else {
        const daysRemaining = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));
        timingStatus = "On Track";
        timingDetails = `${daysRemaining} days remaining`;
      }
    }

    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-gray-400">🔧 Debug Information</h4>
          <button
            onClick={() => setShowExpandedDebug(!showExpandedDebug)}
            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
          >
            {showExpandedDebug ? "▲ Collapse" : "▼ Expand"}
          </button>
        </div>

        {/* Basic Info - Always Visible */}
        <div className="text-xs space-y-2 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-gray-500">Task ID:</span>
              <span className="text-gray-300 font-mono text-xs">{task._id?.substring(0, 12)}...</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Status:</span>
              <span className={`font-medium ${
                task.status === 'verified' ? 'text-green-400' :
                task.status === 'failed' ? 'text-red-400' :
                task.status === 'reopened' ? 'text-orange-400' :
                'text-gray-300'
              }`}>
                {task.status}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Events:</span>
              <span className="text-gray-300">{timeline.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Submissions:</span>
              <span className="text-gray-300">v{workVersions}</span>
            </div>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Resolution:</span>
            <span className={`font-medium ${
              resolutionInfo?.severity === 'positive' ? 'text-green-400' :
              resolutionInfo?.severity === 'critical' ? 'text-red-400' :
              resolutionInfo?.severity === 'warning' ? 'text-yellow-400' :
              'text-gray-300'
            }`}>
              {resolutionInfo?.code || "N/A"}
            </span>
          </div>
        </div>

        {/* Expanded Debug Information */}
        {showExpandedDebug && (
          <div className="border-t border-gray-800 pt-3 space-y-3">
            {/* Reopen History */}
            {wasReopened ? (
              <div>
                <div className="text-gray-500 text-xs mb-1">
                  🔄 Reopen History ({reopenCount} cycle{reopenCount !== 1 ? 's' : ''}):
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {reopenCycles.map((cycle, index) => (
                    <div key={index} className="bg-gray-800/50 p-2 rounded border border-gray-700">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="text-gray-300 font-medium text-xs">
                            Cycle #{cycle.cycleNumber}
                          </span>
                          <span className="text-gray-500 text-xs ml-2">
                            {formatDateOnly(cycle.reopenedAt)}
                          </span>
                        </div>
                        <div className={`px-2 py-0.5 text-xs rounded ${
                          cycle.responseType === "ACCEPTED" ? 'bg-green-900/30 text-green-400' :
                          cycle.responseType === "DECLINED" ? 'bg-red-900/30 text-red-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {cycle.responseType || "Pending"}
                        </div>
                      </div>
                      
                      <div className="text-gray-400 text-xs mb-1 truncate">
                        {cycle.adminReason.substring(0, 50)}
                        {cycle.adminReason.length > 50 ? '...' : ''}
                      </div>
                      
                      {cycle.employeeReason && (
                        <div className="text-gray-400 text-xs mb-1 truncate">
                          Emp: {cycle.employeeReason.substring(0, 40)}
                          {cycle.employeeReason.length > 40 ? '...' : ''}
                        </div>
                      )}
                      
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">
                          Events: {cycle.events.length}
                        </span>
                        {cycle.finalOutcome && (
                          <span className={`${
                            cycle.finalOutcome.includes('VERIFIED') ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {cycle.finalOutcome.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-xs">Task has never been reopened</div>
            )}

            {/* Timeline Analysis */}
            <div>
              <div className="text-gray-500 text-xs mb-1">📊 Timeline Analysis:</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(actionCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between">
                      <span className="text-gray-400 text-xs truncate">
                        {action.replace('TASK_', '').replace('_', ' ')}:
                      </span>
                      <span className="text-gray-300 text-xs">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Backend Virtual Fields */}
            <div>
              <div className="text-gray-500 text-xs mb-1">⚙️ Backend Virtuals:</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(backendVirtuals).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-400 text-xs">{key}:</span>
                    <span className={`text-xs ${
                      value === true ? 'text-green-400' :
                      value === false ? 'text-red-400' :
                      'text-gray-300'
                    }`}>
                      {typeof value === 'boolean' ? (value ? '✓' : '✗') : value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timing Information */}
            {dueDate && (
              <div>
                <div className="text-gray-500 text-xs mb-1">⏰ Timing:</div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <span className="text-gray-400 text-xs">Status:</span>
                    <span className={`text-xs ml-1 ${
                      timingStatus.includes('Late') || timingStatus === 'Overdue' ? 'text-red-400' :
                      timingStatus === 'On Time' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {timingStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Details:</span>
                    <span className="text-gray-300 text-xs ml-1">{timingDetails}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Work Submission Details */}
            {workSubmissionContext && (
              <div>
                <div className="text-gray-500 text-xs mb-1">📤 Submission:</div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">Has Work:</span>
                    <span className={`text-xs ${
                      workSubmissionContext.hasSubmission ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {workSubmissionContext.hasSubmission ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">Reopen Phase:</span>
                    <span className={`text-xs ${
                      workSubmissionContext.isReopenPhase ? 'text-orange-400' : 'text-gray-300'
                    }`}>
                      {workSubmissionContext.isReopenPhase ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Source Information */}
            <div>
              <div className="text-gray-500 text-xs mb-1">🔗 Source:</div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Access Point:</span>
                <span className="text-gray-300 text-xs">
                  {fromEmployeeInsights ? "Employee Insights" : "Direct"}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-400 text-xs">User Role:</span>
                <span className="text-gray-300 text-xs">{user?.role || "Unknown"}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-gray-800">
              <div className="flex gap-2">
                <button 
                  onClick={fetchTaskDetails}
                  className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium flex items-center justify-center"
                >
                  🔄 Refresh
                </button>
                <button 
                  onClick={() => console.log("📊 Task Data:", task)}
                  className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium flex items-center justify-center"
                >
                  📝 Log Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading task details...</p>
          <p className="text-gray-500 text-sm mt-2">Task ID: {id}</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <button
            type="button"
            onClick={handleBackClick}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg"
          >
            ← Back
          </button>
          
          <div className="text-center py-12">
            <p className="text-red-400 text-xl mb-2">{error || "Task Not Found"}</p>
            <button 
              onClick={fetchTaskDetails}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const employeeName = getEmployeeName();
  const statusInfo = getStatusInfo();
  const priorityInfo = getPriorityInfo();
  const lateStatus = calculateLateStatus();
  const workSubmission = getWorkSubmissionData();
  const activityTimeline = getActivityTimeline();
  const modificationRequests = getModificationRequests();
  const modificationTimeline = activityTimeline.filter((event) =>
    modificationActions.has(event.action)
  );
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const isAssignedEmployee = isEmployee && task.assignedTo?._id === user.id;
  const hasReopenDeclined = task.activityTimeline?.some(e => e.action === "TASK_REOPEN_DECLINED");
  const isReopenSlaExpired = task?.reopenSlaStatus === "timed_out" || (task?.reopenDueAt && new Date(task.reopenDueAt) < new Date());
  const reopenSlaMeta = getReopenSlaMeta();

  // ✅ STEP 1: DEFINE PERMISSIONS ONCE
  const adminPermissions = {
    canVerify: Boolean(task.canAdminVerify),
    canFail: Boolean(task.canAdminFail),
    canReopen: Boolean(task.canAdminReopen),
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleBackClick}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg transition-colors"
              >
                <span className="mr-2">←</span> Back
              </button>
              <h1 className="text-xl font-bold">Task Details</h1>
            </div>
            
            {/* Admin Action Buttons */}
            {user?.role === "admin" && (
              <div className="flex items-center gap-2">
              </div>
            )}
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.label}
              </div>
              {resolutionInfo && resolutionInfo.code !== "ACTIVE" && (
                <div className={`px-2 py-1 text-xs rounded ${getResolutionSeverityColor(resolutionInfo.severity)}`}>
                  {resolutionInfo.label}
                </div>
              )}
              <div className="text-sm text-gray-400">
                ID: {task._id?.substring(0, 8)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{task.title || "Untitled Task"}</h2>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-400">📁 {task.category || "General"}</span>
                  <span className="text-gray-400">👤 {employeeName}</span>
                  <span className={`px-2 py-1 rounded ${priorityInfo.bg} ${priorityInfo.color} font-medium`}>
                    {priorityInfo.icon} {priorityInfo.label}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">📝 Description</h3>
                <div className="bg-gray-900/50 rounded p-4 border border-gray-700">
                  <p className="text-gray-300 whitespace-pre-wrap">
                    {task.description || "No description provided."}
                  </p>
                </div>
              </div>

              {resolutionInfo && resolutionInfo.code !== "ACTIVE" && (
                <div className={`mb-4 p-4 rounded border ${getResolutionSeverityColor(resolutionInfo.severity)}`}>
                  <div className="flex items-center mb-2">
                    <h4 className="font-semibold text-lg">🎯 Resolution</h4>
                    <span className="ml-2 text-xs bg-gray-800 px-2 py-1 rounded">
                      {resolutionInfo.code}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Status</div>
                      <div className="font-medium">{resolutionInfo.label}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Phase</div>
                      <div className="font-medium capitalize">{resolutionInfo.phase?.replace(/_/g, ' ')}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Final</div>
                      <div className="font-medium">{resolutionInfo.isFinal ? "Yes" : "No"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Severity</div>
                      <div className="font-medium capitalize">{resolutionInfo.severity}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-xs text-gray-500">Assigned</div>
                  <div className="text-sm font-medium">{formatDateOnly(task.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Due Date</div>
                  <div className={`text-sm font-medium ${lateStatus?.status === "overdue" ? "text-red-400" : ""}`}>
                    {task.dueDate ? formatDateOnly(task.dueDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Last Updated</div>
                  <div className="text-sm font-medium">{formatDateTime(task.updatedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Completed</div>
                  <div className="text-sm font-medium">
                    {task.completedAt ? formatDateOnly(task.completedAt) : "—"}
                  </div>
                </div>
              </div>

              {lateStatus && (
                <div className={`p-3 rounded-lg mb-4 ${
                  lateStatus.status === "overdue" ? "bg-red-900/30 border border-red-800" :
                  lateStatus.status === "late" ? "bg-yellow-900/30 border border-yellow-800" :
                  "bg-green-900/30 border border-green-800"
                }`}>
                  <div className="flex items-center">
                    <span className="mr-2">⏰</span>
                    <span className={lateStatus.status === "overdue" ? "text-red-300" : 
                                     lateStatus.status === "late" ? "text-yellow-300" : "text-green-300"}>
                      {lateStatus.message}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="border-b border-gray-700">
                <nav className="flex overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === "details" ? "text-blue-400 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"}`}
                  >
                    📋 Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("work")}
                    className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === "work" ? "text-blue-400 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"}`}
                  >
                    📤 Submission
                  </button>
                  <button
                    onClick={() => setActiveTab("timeline")}
                    className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === "timeline" ? "text-blue-400 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"}`}
                  >
                    ⏰ Activity ({activityTimeline.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("reviews")}
                    className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === "reviews" ? "text-blue-400 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"}`}
                  >
                    📜 Review Log
                  </button>

                  <button
                    onClick={() => setActiveTab("modification")}
                    className={`px-4 py-3 font-medium whitespace-nowrap ${activeTab === "modification" ? "text-blue-400 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"}`}
                  >
                    Modification ({modificationRequests.length})
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === "details" && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Task Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status:</span>
                          <span className={statusInfo.color.replace('bg-', 'text-')}>
                            {statusInfo.icon} {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Priority:</span>
                          <span className={`font-medium ${priorityInfo.color}`}>
                            {priorityInfo.icon} {priorityInfo.label}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Created By:</span>
                          <span className="font-medium">
                            {task.createdBy?.name || "Admin"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Reviewed By:</span>
                          <span className="font-medium">
                            {task.reviewedBy?.name || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Last Activity:</span>
                          <span className="font-medium">{formatDateTime(task.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {task.canAdminVerify !== undefined && isAdmin && (
                      <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
                        <h5 className="text-sm font-medium mb-2">🔧 Backend Permissions</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`px-2 py-1 rounded ${task.canAdminVerify ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                            canAdminVerify: {task.canAdminVerify ? 'Yes' : 'No'}
                          </div>
                          <div className={`px-2 py-1 rounded ${task.canAdminFail ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                            canAdminFail: {task.canAdminFail ? 'Yes' : 'No'}
                          </div>
                          <div className={`px-2 py-1 rounded ${task.canAdminReopen ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                            canAdminReopen: {task.canAdminReopen ? 'Yes' : 'No'}
                          </div>
                          <div className={`px-2 py-1 rounded ${task.hasWorkSubmission ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                            hasWorkSubmission: {task.hasWorkSubmission ? 'Yes' : 'No'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "work" && (
                  <div>
                    {workSubmission ? (
                      <div className="space-y-4">
                        <div className="bg-gray-900/50 rounded p-4 border border-gray-700">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-medium">Work Submission</h4>
                            <div className="text-sm text-gray-400">
                              {workSubmission.submissionStatus === "verified" ? "✅ Verified" :
                               workSubmission.submissionStatus === "failed" ? "❌ Failed" :
                               workSubmission.submissionStatus === "submitted" ? "📤 Submitted" : "⏳ Pending"}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <div className="text-sm text-gray-400">Version</div>
                              <div className="font-medium text-white">v{workSubmission.version}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-400">Submitted</div>
                              <div className="font-medium text-white">{formatDateTime(workSubmission.submittedAt)}</div>
                            </div>
                          </div>
                          
                          {workSubmission.link && (
                            <div className="mb-3">
                              <div className="text-sm text-gray-400 mb-1">🔗 Work Link</div>
                              <a 
                                href={workSubmission.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline break-all"
                              >
                                {workSubmission.link}
                              </a>
                            </div>
                          )}
                          
                          {workSubmission.files.length > 0 && (
                            <div className="mb-3">
                              <div className="text-sm text-gray-400 mb-1">📎 Attached Files</div>
                              <div className="space-y-1">
                                {workSubmission.files.map((file, idx) => {
                                  const fileUrl = toAbsoluteFileUrl(file?.url);
                                  if (!fileUrl) {
                                    return (
                                      <div key={`${file?.name || "file"}-${idx}`} className="text-gray-300">
                                        {file?.name || `File ${idx + 1}`}
                                      </div>
                                    );
                                  }
                                  return (
                                    <a
                                      key={`${file?.url || file?.name || "file"}-${idx}`}
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-400 hover:underline break-all block"
                                    >
                                      {file?.name || `File ${idx + 1}`}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {workSubmission.employeeNote && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <div className="text-sm text-gray-400 mb-1">📝 Employee Note:</div>
                              <div className="text-gray-300 bg-gray-800 p-2 rounded">
                                {workSubmission.employeeNote}
                              </div>
                            </div>
                          )}
                        </div>

                        {workSubmissionContext && workSubmissionContext.isReopenPhase && (
                          <div className="bg-orange-900/20 border border-orange-800 rounded p-3">
                            <div className="text-orange-400 font-medium mb-1">🔄 Reopened Task</div>
                            <p className="text-gray-300 text-sm">
                              {workSubmissionContext.isOriginalSubmission 
                                ? "Original submission is being reviewed" 
                                : "New submission after reopen"}
                            </p>
                          </div>
                        )}

                        {lateStatus?.status === "late" && workSubmission.submittedAt && (
                          <div className="bg-yellow-900/30 border border-yellow-800 rounded p-3">
                            <div className="flex items-center">
                              <span className="text-yellow-400 mr-2">⚠️</span>
                              <span className="text-yellow-300">Work submitted {lateStatus.days} days late</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-gray-500 text-4xl mb-3">📭</div>
                        <p className="text-gray-400">No work submitted yet</p>
                        </div>
                    )}
                  </div>
                )}

                {activeTab === "timeline" && (
                  <div>
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-300">Activity Timeline</h4>
                      <p className="text-sm text-gray-500">All activities for this task</p>
                    </div>
                    
                    <div className="space-y-4">
                      {activityTimeline.length > 0 ? (
                        activityTimeline.map((event, index) => (
                          <div key={index} className="flex items-start space-x-4 border-l-2 border-blue-500 pl-4 py-3">
                            <div className="text-xl mt-1">{event.icon}</div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <div className={`text-sm font-medium ${event.color}`}>
                                  {event.description}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDateTime(event.createdAt || event.timestamp)}
                                </div>
                              </div>
                              
                              {event.actor && (
                                <div className="text-xs text-gray-400 mt-1">
                                  👤 {event.actor} • {event.role}
                                  {event.targetName && (
                                    <span className="ml-2">🎯 {event.targetName}</span>
                                  )}
                                </div>
                              )}
                              
                              {event.details && (
                                <div className="text-xs text-gray-300 mt-1 bg-gray-900 p-2 rounded">
                                  {event.details}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-gray-500 text-3xl mb-3">⏰</div>
                          <p className="text-gray-500">No timeline events found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "reviews" && (
                  <div>
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-300">Admin Reviews</h4>
                      <p className="text-sm text-gray-500">All admin actions and reviews</p>
                    </div>
                    
                    <div className="space-y-4">
                      {activityTimeline.filter(e => 
                        e.action === "TASK_VERIFIED" || 
                        e.action === "TASK_FAILED" ||
                        e.action === "TASK_REOPENED"
                      ).length > 0 ? (
                        activityTimeline
                          .filter(e => 
                            e.action === "TASK_VERIFIED" || 
                            e.action === "TASK_FAILED" ||
                            e.action === "TASK_REOPENED"
                          )
                          .map((review, index) => (
                            <div key={index} className={`rounded-lg p-4 border ${
                              review.action === "TASK_VERIFIED" ? 'bg-green-900/20 border-green-800' :
                              review.action === "TASK_FAILED" ? 'bg-red-900/20 border-red-800' :
                              'bg-orange-900/20 border-orange-800'
                            }`}>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center">
                                  <span className="text-lg mr-2">{review.icon}</span>
                                  <span className="font-medium text-white">
                                    {review.description}
                                  </span>
                                  <span className="text-gray-400 text-sm ml-2">by {review.actor}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDateTime(review.createdAt)}
                                </div>
                              </div>
                              
                              {review.details && (
                                <div className="mt-2">
                                  <div className="text-xs text-gray-400">Details:</div>
                                  <div className={`text-sm ${
                                    review.action === "TASK_FAILED" ? 'text-red-300' : 
                                    review.action === "TASK_REOPENED" ? 'text-orange-300' : 'text-green-300'
                                  }`}>
                                    {review.details}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-gray-500 text-4xl mb-3">📝</div>
                          <p className="text-gray-500">No admin reviews found</p>
                        </div>
                      )}
                      
                      {task.adminNote && (
                        <div className="bg-blue-900/20 rounded p-4 border border-blue-800">
                          <div className="flex items-center mb-2">
                            <span className="text-blue-400 mr-2">📝</span>
                            <span className="font-medium text-white">Admin Note</span>
                          </div>
                          <div className="text-sm text-blue-300">{task.adminNote}</div>
                          {task.reviewedBy?.name && (
                            <div className="text-xs text-gray-400 mt-1">
                              By: {task.reviewedBy.name}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {activeTab === "modification" && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-medium text-gray-300">Modification Status</h4>
                      <p className="text-sm text-gray-500">
                        Read-only log of modification requests from both admin and employee.
                      </p>
                    </div>

                    {modificationRequests.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-gray-500 text-3xl mb-3">-</div>
                        <p className="text-gray-500">No modification requests for this task</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {modificationRequests.map((request, index) => (
                          <div key={request._id || `${request.origin}-${index}`} className="rounded-lg p-4 border border-gray-700 bg-gray-900/40">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className="px-2 py-1 rounded bg-gray-800 text-gray-200 text-xs uppercase tracking-wide">
                                {request.origin === "employee" ? "Employee Request" : "Admin Request"}
                              </span>
                              <span className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
                                {request.requestType?.replace(/_/g, " ") || "modification"}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs uppercase tracking-wide ${getModificationStatusBadge(request.status)}`}>
                                {request.status || "unknown"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-3">
                              <div>
                                <span className="text-gray-500">Requested by: </span>
                                <span className="text-gray-200">{getActorLabel(request.requestedBy, request.origin === "employee" ? "Employee" : "Admin")}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Requested at: </span>
                                <span className="text-gray-200">{formatDateTime(request.requestedAt || request.createdAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">SLA / expires: </span>
                                <span className="text-gray-200">{request.expiresAt ? formatDateTime(request.expiresAt) : "-"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Responded at: </span>
                                <span className="text-gray-200">{request.response?.respondedAt ? formatDateTime(request.response.respondedAt) : "-"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Executed at: </span>
                                <span className="text-gray-200">{request.executedAt ? formatDateTime(request.executedAt) : "-"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Responder: </span>
                                <span className="text-gray-200">{getActorLabel(request.response?.respondedBy, "-")}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs text-gray-500 uppercase tracking-wide">Reason</div>
                              <div className="bg-gray-950/70 border border-gray-800 rounded p-3 text-gray-200 text-sm">
                                {request.reason ? (request.reason.length > 180 ? `${request.reason.slice(0, 180)}...` : request.reason) : "-"}
                              </div>
                            </div>

                            {Array.isArray(request.discussion) && request.discussion.length > 0 && (
                              <div className="mt-3 border-t border-gray-800 pt-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                                    Discussion ({request.discussion.length})
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedModificationRequestId((prev) =>
                                        prev === String(request._id || index) ? null : String(request._id || index)
                                      )
                                    }
                                    className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                                  >
                                    {expandedModificationRequestId === String(request._id || index) ? "Collapse" : "Expand"}
                                  </button>
                                </div>
                                {expandedModificationRequestId === String(request._id || index) && (
                                  <div className="space-y-2 mt-2 max-h-56 overflow-y-auto pr-1">
                                    {request.discussion.map((msg, msgIdx) => (
                                      <div key={`${request._id || index}-msg-${msgIdx}`} className="rounded border border-gray-800 bg-gray-950/60 p-3">
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-gray-300">
                                            {getActorLabel(msg.sender, msg.senderRole === "admin" ? "Admin" : "Employee")} ({msg.senderRole || "user"})
                                          </span>
                                          <span className="text-gray-500">{formatDateTime(msg.createdAt)}</span>
                                        </div>
                                        <div className="text-sm text-gray-200 whitespace-pre-wrap">{msg.text || ""}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-300">Modification Timeline</h5>
                        {modificationTimeline.length > 6 && (
                          <button
                            type="button"
                            onClick={() => setShowAllModificationTimeline((prev) => !prev)}
                            className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                          >
                            {showAllModificationTimeline ? "Show Less" : `Show All (${modificationTimeline.length})`}
                          </button>
                        )}
                      </div>
                      {modificationTimeline.length === 0 ? (
                        <p className="text-sm text-gray-500">No modification timeline events</p>
                      ) : (
                        <div className="space-y-2">
                          {(showAllModificationTimeline ? modificationTimeline : modificationTimeline.slice(0, 6)).map((event, idx) => (
                            <div key={`mod-event-${idx}`} className="flex items-start justify-between rounded border border-gray-800 bg-gray-900/50 p-3">
                              <div>
                                <div className={`text-sm font-medium ${event.color}`}>{event.description}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {event.actor} {event.role ? `(${event.role})` : ""}
                                </div>
                                {event.details && <div className="text-xs text-gray-300 mt-1">{event.details}</div>}
                              </div>
                              <div className="text-xs text-gray-500 ml-3 whitespace-nowrap">
                                {formatDateTime(event.createdAt || event.timestamp)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            
            {showReopenActions && (
              <div className="bg-orange-900/30 rounded-lg border border-orange-700 p-6">
                <h3 className="text-lg font-semibold mb-4 text-orange-300">🔄 Reopened Task</h3>
                
                <div className="mb-4">
                  <div className="text-sm text-orange-400 mb-2">Admin's Reason:</div>
                  <div className="text-white bg-orange-900/50 p-3 rounded">
                    {task.reopenReason || "No reason provided"}
                  </div>
                </div>
                


                {reopenSlaMeta && (
                  <div className={`mb-4 border rounded p-3 text-sm ${getSlaLevelClasses(reopenSlaMeta.level)}`}>
                    <div className="font-medium">Admin review request - response required</div>
                    <div>{reopenSlaMeta.label}</div>
                  </div>
                )}

                {isReopenSlaExpired && (
                  <div className="mb-4 bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">
                    Action locked - Reopen SLA expired
                  </div>
                )}

                <div className="space-y-3">
                  <button 
                    onClick={handleAcceptReopenedTask}
                    disabled={isReopenSlaExpired}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                  >
                    <span className="mr-2 text-lg">✅</span> Accept & Continue Task
                  </button>
                  
                  <button 
                    onClick={handleDeclineReopenedTask}
                    disabled={isReopenSlaExpired}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                  >
                    <span className="mr-2 text-lg">🚫</span> Decline Reopened Task
                  </button>
                </div>
              </div>
            )}

            {hasReopenDeclined && task.status === "declined_by_employee" && isAdmin && (
              <div className="bg-orange-900/30 rounded-lg border border-orange-700 p-6">
                <h3 className="text-lg font-semibold mb-4 text-orange-300">⚠️ Reopen Declined</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Employee declined the reopen request. You can accept original work or mark as failed.
                </p>
                
                <div className="space-y-3">
                  <button 
                    onClick={handleAcceptReopenDecline}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                  >
                    <span className="mr-2 text-lg">✅</span> Accept Original Work
                  </button>
                  
                  <button 
                    onClick={handleFailTask}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                  >
                    <span className="mr-2 text-lg">❌</span> Mark as Failed
                  </button>
                </div>
              </div>
            )}

            {/* ✅ STEP 2: FIX "Review Actions" PANEL VISIBILITY */}
            {isAdmin && (adminPermissions.canVerify || adminPermissions.canFail || adminPermissions.canReopen) && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4">✅ Review Actions</h3>
                

                {reopenSlaMeta && (
                  <div className={`mb-4 border rounded p-3 text-sm ${getSlaLevelClasses(reopenSlaMeta.level)}`}>
                    <div className="font-medium">Admin review request - response required</div>
                    <div>{reopenSlaMeta.label}</div>
                  </div>
                )}


                {reopenSlaMeta && (
                  <div className={`mb-4 border rounded p-3 text-sm ${getSlaLevelClasses(reopenSlaMeta.level)}`}>
                    <div className="font-medium">Reopen SLA</div>
                    <div>{reopenSlaMeta.label}</div>
                  </div>
                )}

                {isReopenSlaExpired && (
                  <div className="mb-4 bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">
                    Reopen SLA expired - request closed, original work preserved
                  </div>
                )}

                <div className="mb-6 space-y-3">
                  {task.adminNote && (
                    <div className="bg-blue-900/20 rounded p-3 border border-blue-800">
                      <div className="text-xs text-blue-400 mb-1">Admin Notes</div>
                      <div className="text-sm text-blue-300">{task.adminNote}</div>
                    </div>
                  )}
                  
                  {task.reopenReason && (
                    <div className={`rounded p-3 border ${
                      task.status === 'reopened' ? 'bg-orange-900/20 border-orange-800' : 'bg-yellow-900/20 border-yellow-800'
                    }`}>
                      <div className={`text-xs mb-1 ${task.status === 'reopened' ? 'text-orange-400' : 'text-yellow-400'}`}>
                        Reopen Reason
                      </div>
                      <div className={`text-sm ${task.status === 'reopened' ? 'text-orange-300' : 'text-yellow-300'}`}>
                        {task.reopenReason}
                      </div>
                      {task.status === 'reopened' && isAssignedEmployee && (
                        <div className="text-xs text-gray-400 mt-1">
                          ⏳ Waiting for your response
                        </div>
                      )}
                      {isAdmin && task.reopenViewedAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          Employee viewed: {formatDateTime(task.reopenViewedAt)}
                        </div>
                      )}
                      {isAdmin && !task.reopenViewedAt && task.status === 'reopened' && (
                        <div className="text-xs text-gray-500 mt-1">
                          Employee has not viewed this reopen request yet
                        </div>
                      )}
                    </div>
                  )}
                  
                  {task.declineReason && (
                    <div className="bg-red-900/20 rounded p-3 border border-red-800">
                      <div className="text-xs text-red-400 mb-1">Decline Reason</div>
                      <div className="text-sm text-red-300">{task.declineReason}</div>
                    </div>
                  )}
                </div>

                {/* ✅ STEP 3: REPLACE ADMIN ACTION BUTTONS (BACKEND-ALIGNED) */}
                {isAdmin && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-300">Admin Actions</h4>

                    {adminPermissions.canVerify && (
                      <button
                        onClick={handleVerifyTask}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                      >
                        <span className="mr-2 text-lg">✅</span>
                        Verify Task
                      </button>
                    )}

                    {adminPermissions.canReopen && (
                      <button
                        onClick={handleReopenTask}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                      >
                        <span className="mr-2 text-lg">🔄</span>
                        Reopen Task
                      </button>
                    )}

                    {adminPermissions.canFail && (
                      <button
                        onClick={handleFailTask}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium flex items-center justify-center"
                      >
                        <span className="mr-2 text-lg">❌</span>
                        Mark as Failed
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">📊 Quick Info</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Assigned To:</span>
                  <span className="font-medium text-white bg-blue-900/30 px-3 py-1 rounded">
                    {employeeName}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${statusInfo.color.replace('bg-', 'text-')}`}>
                    {statusInfo.icon} {statusInfo.label}
                  </span>
                </div>
                
                {resolutionInfo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Resolution:</span>
                    <span className={`font-medium ${getResolutionSeverityColor(resolutionInfo.severity).split(' ')[2]}`}>
                      {resolutionInfo.label}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Priority Level:</span>
                  <span className={`font-medium ${priorityInfo.color}`}>
                    {priorityInfo.icon} {priorityInfo.label}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Due Date:</span>
                  <span className={lateStatus?.status === "overdue" ? "text-red-400 font-medium" : "text-white"}>
                    {task.dueDate ? formatDateOnly(task.dueDate) : "—"}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Activity:</span>
                  <span className="text-white font-medium">{formatDateTime(task.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Debug Information Component */}
            <DebugInformation />
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <TaskEditModal
            task={task}
            user={user}
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              setShowEditModal(false);
              fetchTaskDetails();
            }}
          />
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <TaskDeleteModal
            task={task}
            user={user}
            onClose={() => setShowDeleteModal(false)}
            onSuccess={() => {
              setShowDeleteModal(false);
              // Navigate back after successful deletion
              setTimeout(() => navigate(-1), 1000);
            }}
          />
        )}

        {/* Modification Request Modal */}
        {showModificationModal && (
          <RequestModificationModal
            task={task}
            user={user}
            onClose={() => setShowModificationModal(false)}
            onSuccess={() => {
              setShowModificationModal(false);
              fetchTaskDetails();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TaskDetails;
