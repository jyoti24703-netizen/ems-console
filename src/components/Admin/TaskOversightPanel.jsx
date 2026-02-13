// src/components/Admin/TaskOversightPanel.jsx
import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthProvider";

const TaskOversightPanel = () => {
  const { user } = useContext(AuthContext);
  
  // Core state
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View and filter state
  const [globalFilter, setGlobalFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [showFullscreen, setShowFullscreen] = useState(false);
  
  // Collapsible sections state
  const [expandedReviewActions, setExpandedReviewActions] = useState(false);
  const [expandedWorkTimeline, setExpandedWorkTimeline] = useState(false);
  const [expandedDiscussion, setExpandedDiscussion] = useState(false);
  const [expandedLifecycle, setExpandedLifecycle] = useState(false);
  const [expandedRequestCenter, setExpandedRequestCenter] = useState(false);
  const [modRequestFilter, setModRequestFilter] = useState("all");
  const [extRequestFilter, setExtRequestFilter] = useState("all");
  const [reopenRequestFilter, setReopenRequestFilter] = useState("all");
  
  // Action state
  const [reviewNote, setReviewNote] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [taskDiscussion, setTaskDiscussion] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [modApprovalNote, setModApprovalNote] = useState("");
  const [modRejectReason, setModRejectReason] = useState("");
  const [modAltSolution, setModAltSolution] = useState("");

  // ==================== DATA FETCHING ====================
  
  const fetchTasks = async () => {
    try {
      console.log("🔍 Fetching tasks from /api/tasks");
      const res = await fetch("http://localhost:4000/api/tasks", {
        headers: { 
          "Authorization": `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
      });
      
      if (!res.ok) {
        console.error(`❌ Failed to fetch tasks: ${res.status}`);
        return;
      }
      
      const data = await res.json();
      console.log("📦 Tasks response:", data);
      
      if (data.success && data.tasks) {
        console.log(`✅ Found ${data.tasks.length} tasks`);
        
        // Process tasks with backend data
        const processedTasks = data.tasks.map(task => {
          // Ensure all required fields exist
          return {
            ...task,
            assignedTo: task.assignedTo || { name: "Unknown", email: "", _id: task.assignedTo },
            createdBy: task.createdBy || { name: "Admin", email: "" },
            category: task.category || "General",
            priority: task.priority || "medium",
            description: task.description || "No description provided",
            activityTimeline: task.activityTimeline || [],
            discussion: task.discussion || [],
            workSubmission: task.workSubmission || { 
              link: "", 
              files: [], 
              employeeNote: "",
              version: 1,
              submissionStatus: "pending"
            },
            // Backend already provides these virtual fields
            resolution: task.resolution || {
              code: "UNKNOWN",
              label: "Unknown",
              severity: "neutral",
              phase: "unknown",
              isFinal: false
            },
            isOverdue: task.isOverdue || false,
            overdueDays: task.overdueDays || 0
          };
        });
        
        setTasks(processedTasks);
        console.log("📊 Tasks processed:", processedTasks.length);
        
        // Debug: Log task status distribution
        const statusCount = {};
        processedTasks.forEach(t => {
          statusCount[t.status] = (statusCount[t.status] || 0) + 1;
        });
        console.log("📈 Task status distribution:", statusCount);
        
        // Debug: Log resolutions
        const resolutionCount = {};
        processedTasks.forEach(t => {
          if (t.resolution) {
            resolutionCount[t.resolution.code] = (resolutionCount[t.resolution.code] || 0) + 1;
          }
        });
        console.log("🎯 Resolution distribution:", resolutionCount);
        
      } else {
        console.error("❌ No tasks in response:", data);
      }
    } catch (err) {
      console.error("❌ Network error fetching tasks:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      console.log("👥 Fetching employees...");
      const res = await fetch("http://localhost:4000/api/admin/employees", {
        headers: { 
          "Authorization": `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
      });
      
      if (!res.ok) {
        console.log(`⚠️ /api/admin/employees returned ${res.status}, extracting from tasks`);
        // Extract from tasks as fallback
        if (tasks.length > 0) {
          const uniqueEmployees = {};
          tasks.forEach(task => {
            if (task.assignedTo && task.assignedTo._id) {
              uniqueEmployees[task.assignedTo._id] = {
                ...task.assignedTo,
                _id: task.assignedTo._id,
                name: task.assignedTo.name || "Unknown Employee",
                email: task.assignedTo.email || "",
                role: "employee"
              };
            }
          });
          const employeeList = Object.values(uniqueEmployees);
          setEmployees(employeeList);
          console.log(`🔄 Extracted ${employeeList.length} employees from tasks`);
        }
        return;
      }
      
      const data = await res.json();
      console.log("👥 Employees response:", data);
      
      if (data.employees && Array.isArray(data.employees)) {
        setEmployees(data.employees);
        console.log(`✅ Loaded ${data.employees.length} employees`);
      } else {
        console.error("❌ Invalid employees data format");
      }
      
    } catch (err) {
      console.error("❌ Fetch employees failed:", err);
      setEmployees([]);
    }
  };

  const fetchAllData = async () => {
    console.log("🔄 Starting data fetch...");
    setLoading(true);
    try {
      await fetchTasks();
      await fetchEmployees();
    } catch (error) {
      console.error("❌ Error fetching data:", error);
    } finally {
      setLoading(false);
      console.log("✅ Data fetch completed");
    }
  };

  const fetchTaskDiscussion = async (taskId) => {
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${taskId}/messages`, {
        headers: { 
          "Authorization": `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
      });
      const data = await res.json();
      if (data.success) {
        setTaskDiscussion(data.discussion || []);
      } else {
        // Fallback
        const task = tasks.find(t => t._id === taskId);
        if (task && task.discussion) {
          setTaskDiscussion(task.discussion);
        }
      }
    } catch (err) {
      console.error("Failed to fetch discussion:", err);
    }
  };

  const fetchSingleTask = async (taskId) => {
    try {
      console.log(`🔍 Fetching single task ${taskId}`);
      const res = await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
        headers: { 
          "Authorization": `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
      });
      const data = await res.json();
      console.log(`📦 Single task response:`, data);
      
      if (data.success && data.task) {
        return {
          ...data.task,
          activityTimeline: data.task.activityTimeline || [],
          discussion: data.task.discussion || [],
          workSubmission: data.task.workSubmission || { 
            link: "", 
            files: [], 
            employeeNote: "",
            version: 1
          }
        };
      }
    } catch (err) {
      console.error("Failed to fetch task:", err);
    }
    return tasks.find(t => t._id === taskId) || null;
  };

  useEffect(() => {
    if (user && user.token) {
      console.log("👤 User authenticated, fetching data...");
      fetchAllData();
    } else {
      console.log("⚠️ No user or token found");
    }
  }, [user]);

  // ==================== TIMELINE LOGIC ====================
  
  const getWorkSubmissionTimeline = (task) => {
    const timeline = [];
    
    if (!task) return timeline;
    
    // WORK ASSIGNED
    if (task.createdAt) {
      timeline.push({
        icon: "📌",
        description: "Task assigned",
        timestamp: task.createdAt,
        actor: task.createdBy?.name || "Admin",
        role: "admin",
        type: "TASK_CREATED"
      });
    }
    
    // Process activity timeline from backend
    if (task.activityTimeline && Array.isArray(task.activityTimeline)) {
      task.activityTimeline.forEach(event => {
        let icon = "📝";
        let description = event.action.replace(/_/g, ' ');
        
        switch(event.action) {
          case "TASK_CREATED":
            icon = "📌";
            description = "Task created";
            break;
          case "TASK_ACCEPTED":
            icon = "✅";
            description = "Task accepted";
            break;
          case "TASK_DECLINED":
            icon = "🚫";
            description = "Task declined";
            break;
          case "TASK_STARTED":
            icon = "🚀";
            description = "Work started";
            break;
          case "TASK_COMPLETED":
            icon = "📤";
            description = event.details || "Work submitted";
            if (event.details && event.details.includes("v")) {
              description = `Work submitted ${event.details.match(/v(\d+)/)?.[0] || ""}`;
            }
            break;
          case "TASK_VERIFIED":
            icon = "✅";
            description = "Work verified";
            break;
          case "TASK_FAILED":
            icon = "❌";
            description = "Work failed";
            break;
          case "TASK_REOPENED":
            icon = "🔄";
            description = "Task reopened";
            break;
          case "TASK_REOPEN_ACCEPTED":
            icon = "✅";
            description = "Reopen accepted";
            break;
          case "TASK_REOPEN_DECLINED":
            icon = "🚫";
            description = "Reopen declined";
            break;
          case "TASK_REOPEN_TIMEOUT":
            icon = "⏱️";
            description = "Reopen response timeout";
            break;
          case "COMMENT_ADDED":
            icon = "💬";
            description = "Comment added";
            break;
          default:
            icon = "📝";
        }
        
        timeline.push({
          icon,
          description,
          timestamp: event.createdAt || event.timestamp || task.updatedAt,
          actor: event.actorName || event.performedBy?.name || (event.role === "employee" ? "Employee" : "System"),
          role: event.role || "system",
          details: event.details || "",
          targetName: event.targetName || "",
          type: event.action
        });
      });
    }
    
    // OVERDUE MARKED
    if (task.dueDate && task.isOverdue) {
      timeline.push({
        icon: "⏰",
        description: `Marked as overdue (${task.overdueDays || 0} days)`,
        timestamp: task.dueDate,
        actor: "System",
        role: "system",
        type: "OVERDUE_MARKED"
      });
    }
    
    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  // ==================== HELPER FUNCTIONS ====================
  
  const hasWorkSubmission = (task) => {
    if (!task) return false;
    
    const work = task.workSubmission || {};
    const hasLink = work.link && work.link.trim().length > 0;
    const hasFiles = work.files && Array.isArray(work.files) && work.files.length > 0;
    const hasNote = work.employeeNote && work.employeeNote.trim().length > 0;
    
    return hasLink || hasFiles || hasNote;
  };

  const getTurnaroundTime = (task) => {
    if (!task.completedAt || !task.createdAt) return null;
    
    const start = new Date(task.createdAt);
    const end = new Date(task.completedAt);
    const diffMs = end - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays === 0 && diffHours === 0) return "<1h";
    if (diffDays === 0) return `${diffHours}h`;
    if (diffHours === 0) return `${diffDays}d`;
    return `${diffDays}d ${diffHours}h`;
  };

  const isOverdue = (task) => {
    if (!task.dueDate || ["verified", "failed", "declined_by_employee"].includes(task.status)) return false;
    return new Date(task.dueDate) < new Date();
  };

  const getOverdueDays = (task) => {
    if (!task.dueDate) return 0;
    const due = new Date(task.dueDate);
    const now = new Date();
    const diffTime = now - due;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // ==================== TASK FILTERING LOGIC ====================
  
  const getFilteredTasks = useMemo(() => {
    let filteredTasks = tasks;
    
    if (selectedEmployee) {
      filteredTasks = filteredTasks.filter(t => t.assignedTo?._id === selectedEmployee.employee._id);
    }
    
    // ✅ ENHANCED FILTERING WITH RESOLUTION SUPPORT
    switch(globalFilter) {
      case "awaiting-review":
        // Show: completed tasks, overdue in-progress tasks, reopened tasks
        filteredTasks = filteredTasks.filter(t => 
          t.status === "completed" || 
          (t.status === "in_progress" && isOverdue(t)) ||
          t.status === "reopened"
        );
        break;
      case "reopened":
        filteredTasks = filteredTasks.filter(t => t.status === "reopened");
        break;
      case "failed":
        filteredTasks = filteredTasks.filter(t => t.status === "failed");
        break;
      case "verified":
        filteredTasks = filteredTasks.filter(t => t.status === "verified");
        break;
      case "no-submission":
        filteredTasks = filteredTasks.filter(t => ["assigned", "accepted", "in_progress"].includes(t.status));
        break;
      case "declined-assignment":
        filteredTasks = filteredTasks.filter(t => {
          if (t.status !== "declined_by_employee") return false;
          const declinedEvent = t.activityTimeline?.find(e => e.action === "TASK_DECLINED");
          return !!declinedEvent;
        });
        break;
      case "declined-reopen":
        filteredTasks = filteredTasks.filter(t => {
          if (t.status !== "declined_by_employee") return false;
          const declinedReopenEvent = t.activityTimeline?.find(e => e.action === "TASK_REOPEN_DECLINED");
          return !!declinedReopenEvent;
        });
        break;
      default:
        break;
    }
    
    // Date filtering
    const now = new Date();
    switch(dateFilter) {
      case "today":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredTasks = filteredTasks.filter(t => {
          const taskDate = new Date(t.updatedAt || t.createdAt);
          return taskDate >= today;
        });
        break;
      case "week":
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filteredTasks = filteredTasks.filter(t => {
          const taskDate = new Date(t.updatedAt || t.createdAt);
          return taskDate >= weekAgo;
        });
        break;
      case "month":
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        filteredTasks = filteredTasks.filter(t => {
          const taskDate = new Date(t.updatedAt || t.createdAt);
          return taskDate >= monthAgo;
        });
        break;
      default:
        break;
    }
    
    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(t => 
        t.title.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.assignedTo?.name?.toLowerCase().includes(term) ||
        t.category?.toLowerCase().includes(term) ||
        (t.resolution?.label && t.resolution.label.toLowerCase().includes(term))
      );
    }
    
    // Sort: overdue > reopened > recent
    return filteredTasks.sort((a, b) => {
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      const aReopen = a.status === "reopened";
      const bReopen = b.status === "reopened";
      if (aReopen && !bReopen) return -1;
      if (!aReopen && bReopen) return 1;
      
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
  }, [tasks, selectedEmployee, globalFilter, dateFilter, searchTerm]);

  // ==================== EMPLOYEE DATA PROCESSING ====================
  
  const getEmployeeTasks = (employeeId) => {
    return tasks.filter(task => task.assignedTo?._id === employeeId);
  };

  const getEmployeeSubmissionCounts = (employeeId) => {
    const employeeTasks = getEmployeeTasks(employeeId);
    
    return {
      totalTasks: employeeTasks.length,
      awaitingReview: employeeTasks.filter(t => 
        t.status === "completed" || 
        (t.status === "in_progress" && isOverdue(t)) ||
        t.status === "reopened"
      ).length,
      reopened: employeeTasks.filter(t => t.status === "reopened").length,
      failed: employeeTasks.filter(t => t.status === "failed").length,
      verified: employeeTasks.filter(t => t.status === "verified").length,
      inProgress: employeeTasks.filter(t => ["assigned", "accepted", "in_progress"].includes(t.status)).length,
      declined: employeeTasks.filter(t => t.status === "declined_by_employee").length,
      overdue: employeeTasks.filter(t => isOverdue(t)).length,
      latestSubmission: employeeTasks
        .filter(t => t.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
    };
  };

  const filteredEmployees = useMemo(() => {
    if (!employees.length) return [];
    
    return employees.map(emp => {
      const counts = getEmployeeSubmissionCounts(emp._id);
      const employeeTasks = getEmployeeTasks(emp._id);
      const latestActivity = employeeTasks
        .map(t => new Date(t.updatedAt || t.createdAt))
        .sort((a, b) => b - a)[0];
      
      return {
        employee: emp,
        ...counts,
        latestActivity,
        hasUrgentWork: counts.overdue > 0 || counts.awaitingReview > 0 || counts.reopened > 0,
        // Enterprise triage score:
        // overdue > reopened > awaiting review > failed > in progress > verified.
        urgencyScore:
          (counts.overdue * 100) +
          (counts.reopened * 60) +
          (counts.awaitingReview * 40) +
          (counts.failed * 30) +
          (counts.declined * 20) +
          (counts.inProgress * 10) -
          (counts.verified * 5)
      };
    }).sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      if (b.latestActivity && a.latestActivity) {
        return b.latestActivity - a.latestActivity;
      }
      if (b.latestActivity) return -1;
      if (a.latestActivity) return 1;
      return a.employee.name.localeCompare(b.employee.name);
    });
  }, [tasks, employees]);

  const queueEmployees = useMemo(() => {
    // Keep queue focused on employees with active workload or submissions.
    return filteredEmployees.filter((item) => item.totalTasks > 0);
  }, [filteredEmployees]);

  // ==================== STATISTICS ====================
  
  const stats = useMemo(() => {
    const allTasks = tasks;
    
    return {
      totalTasks: allTasks.length,
      awaitingReview: allTasks.filter(t => 
        t.status === "completed" || 
        (t.status === "in_progress" && isOverdue(t)) ||
        t.status === "reopened"
      ).length,
      reopened: allTasks.filter(t => t.status === "reopened").length,
      failed: allTasks.filter(t => t.status === "failed").length,
      verified: allTasks.filter(t => t.status === "verified").length,
      noSubmission: allTasks.filter(t => ["assigned", "accepted", "in_progress"].includes(t.status)).length,
      declinedAssignment: allTasks.filter(t => {
        if (t.status !== "declined_by_employee") return false;
        const declinedEvent = t.activityTimeline?.find(e => e.action === "TASK_DECLINED");
        return !!declinedEvent;
      }).length,
      declinedReopen: allTasks.filter(t => {
        if (t.status !== "declined_by_employee") return false;
        const declinedReopenEvent = t.activityTimeline?.find(e => e.action === "TASK_REOPEN_DECLINED");
        return !!declinedReopenEvent;
      }).length,
      overdue: allTasks.filter(t => isOverdue(t)).length,
      activeEmployees: employees.filter(e => e.status === 'active').length
    };
  }, [tasks, employees]);

  // ==================== ACTION HANDLERS ====================
  
  const handleSelectTask = async (task) => {
    console.log("🎯 Selecting task:", task._id);
    setSelectedTask(task);
    const fullTask = await fetchSingleTask(task._id);
    if (fullTask) {
      setSelectedTask(fullTask);
      console.log("✅ Task loaded with resolution:", fullTask.resolution);
    }
    fetchTaskDiscussion(task._id);
    setReviewNote("");
    setFailureReason("");
    setReopenReason("");
    setDiscussionMessage("");
    setExpandedReviewActions(false);
    setExpandedWorkTimeline(false);
    setExpandedDiscussion(false);
    setExpandedLifecycle(false);
  };

  const handleClearSelection = () => {
    setSelectedTask(null);
  };

  const handleSelectEmployee = (emp) => {
    if (selectedEmployee?.employee._id === emp.employee._id) {
      setSelectedEmployee(null);
      setSelectedTask(null);
    } else {
      setSelectedEmployee(emp);
      setSelectedTask(null);
    }
  };

  const sendDiscussionMessage = async () => {
    if (!discussionMessage.trim() || !selectedTask) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({ text: discussionMessage }),
      });
      
      const data = await res.json();
      if (data.success) {
        setDiscussionMessage("");
        fetchTaskDiscussion(selectedTask._id);
        fetchAllData();
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ ENHANCED: Handle verify task (supports reopened tasks)
  const handleVerifyTask = async () => {
    if (!selectedTask) return;
    
    // Use backend permission check
    if (!selectedTask.canAdminVerify && !(selectedTask.status === "completed" || selectedTask.status === "reopened")) {
      alert("❌ Cannot verify task in current state");
      return;
    }
    
    if (selectedTask.status === "completed" && !hasWorkSubmission(selectedTask)) {
      alert("❌ Cannot verify: Employee has not submitted work yet!");
      return;
    }
    
    if (!reviewNote.trim() || reviewNote.length < 5) {
      alert("Please provide a review note (minimum 5 characters)");
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({ note: reviewNote }),
      });
      
      const data = await res.json();
      if (data.success) {
        alert("✅ Work verified successfully!");
        setReviewNote("");
        fetchAllData();
        const updatedTask = await fetchSingleTask(selectedTask._id);
        setSelectedTask(updatedTask);
      } else {
        alert(data.error || "Failed to verify task");
      }
    } catch (err) {
      console.error("Error verifying work:", err);
      alert("Error verifying work: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ ENHANCED: Handle fail task (supports all scenarios)
  const handleFailTask = async () => {
    if (!selectedTask) return;
    
    // Use backend permission check
    if (!selectedTask.canAdminFail && !(
      selectedTask.status === "completed" || 
      selectedTask.status === "reopened" || 
      (selectedTask.status === "in_progress" && isOverdue(selectedTask))
    )) {
      alert("❌ Cannot fail task in current state");
      return;
    }
    
    if (!failureReason.trim() || failureReason.length < 5) {
      alert("Please provide a failure reason (minimum 5 characters)");
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/fail`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          reason: failureReason,
          failureType: "other"
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        alert("❌ Work marked as failed!");
        setFailureReason("");
        fetchAllData();
        const updatedTask = await fetchSingleTask(selectedTask._id);
        setSelectedTask(updatedTask);
      } else {
        alert(data.error || "Failed to mark task as failed");
      }
    } catch (err) {
      console.error("Error marking work as failed:", err);
      alert("Error marking work as failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ NEW: Handle accept reopen decline
  const handleAcceptReopenDecline = async () => {
    if (!selectedTask) return;
    
    const hasReopenDeclined = selectedTask.activityTimeline?.some(e => e.action === "TASK_REOPEN_DECLINED");
    if (!hasReopenDeclined || selectedTask.status !== "declined_by_employee") {
      alert("❌ This task was not declined after reopen");
      return;
    }
    
    if (!reviewNote.trim() || reviewNote.length < 5) {
      alert("Please provide an acceptance note (minimum 5 characters)");
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/accept-reopen-decline`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({ note: reviewNote }),
      });
      
      const data = await res.json();
      if (data.success) {
        alert("✅ Reopen decline accepted. Original work verified!");
        setReviewNote("");
        fetchAllData();
        const updatedTask = await fetchSingleTask(selectedTask._id);
        setSelectedTask(updatedTask);
      } else {
        alert(data.error || "Failed to accept reopen decline");
      }
    } catch (err) {
      console.error("Error accepting reopen decline:", err);
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenTask = async () => {
    if (!selectedTask || selectedTask.status !== "verified") {
      alert("❌ Only verified tasks can be reopened");
      return;
    }
    
    if (!reopenReason.trim() || reopenReason.length < 5) {
      alert("Please provide a reopen reason (minimum 5 characters)");
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${selectedTask._id}/reopen`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({ reason: reopenReason }),
      });
      
      const data = await res.json();
      if (data.success) {
        alert("🔄 Work reopened for revisions!");
        setReopenReason("");
        fetchAllData();
        const updatedTask = await fetchSingleTask(selectedTask._id);
        setSelectedTask(updatedTask);
      } else {
        alert(data.error || "Failed to reopen task");
      }
    } catch (err) {
      console.error("Error reopening work:", err);
      alert("Error reopening work: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== UI HELPER FUNCTIONS ====================
  
  const formatDate = (date, includeTime = true) => {
    if (!date) return "—";
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) return "—";
    
    const options = {
      day: "2-digit",
      month: "short",
      year: "numeric"
    };
    
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }
    
    return dateObj.toLocaleDateString("en-GB", options);
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: "bg-purple-500 text-white",
      verified: "bg-green-500 text-white",
      reopened: "bg-orange-500 text-white",
      failed: "bg-red-500 text-white",
      in_progress: "bg-yellow-500 text-white",
      accepted: "bg-blue-500 text-white",
      assigned: "bg-gray-500 text-white",
      declined_by_employee: "bg-gray-700 text-white"
    };
    return colors[status] || "bg-gray-500 text-white";
  };

  const getStatusLabel = (status) => {
    const labels = {
      completed: "Awaiting Review",
      verified: "Verified",
      reopened: "Reopened",
      failed: "Failed",
      in_progress: "In Progress",
      accepted: "Accepted",
      assigned: "Assigned",
      declined_by_employee: "Declined"
    };
    return labels[status] || status;
  };

  const getFilterLabel = (filter) => {
    switch(filter) {
      case "all": return "All Tasks";
      case "awaiting-review": return "Awaiting Review";
      case "reopened": return "Reopened";
      case "failed": return "Failed";
      case "verified": return "Verified";
      case "no-submission": return "No Submission";
      case "declined-assignment": return "Declined (Assignment)";
      case "declined-reopen": return "Declined (Reopen)";
      default: return "All";
    }
  };

  const getFilterIcon = (filter) => {
    switch(filter) {
      case "all": return "📋";
      case "awaiting-review": return "🟣";
      case "reopened": return "🟠";
      case "failed": return "🔴";
      case "verified": return "🟢";
      case "no-submission": return "🟡";
      case "declined-assignment": return "🚫";
      case "declined-reopen": return "🚫";
      default: return "📋";
    }
  };

  const getResolutionSeverityColor = (severity) => {
    switch(severity) {
      case "positive": return "text-green-400";
      case "critical": return "text-red-400";
      case "warning": return "text-yellow-400";
      case "info": return "text-blue-400";
      case "neutral": return "text-gray-400";
      default: return "text-gray-400";
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

  // ==================== RENDER REVIEW ACTIONS (ENHANCED) ====================
  
  const renderReviewActions = () => {
    if (!selectedTask) return null;
    
    const task = selectedTask;
    const isReopenDeclined = task.activityTimeline?.some(e => e.action === "TASK_REOPEN_DECLINED");
    const isReopenDeclinedPending = isReopenDeclined && task.status === "declined_by_employee";
    const pendingAdminModRequests = (task.modificationRequests || []).filter(r => r.status === "pending");
    const pendingEmployeeModRequests = (task.employeeModificationRequests || []).filter(r => r.status === "pending");
    
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div 
          className="p-4 border-b border-gray-700 cursor-pointer flex justify-between items-center"
          onClick={() => setExpandedReviewActions(!expandedReviewActions)}
        >
          <h4 className="font-semibold text-lg text-white flex items-center gap-2">
            <span>✅</span>
            Review Actions
            {task.resolution && (
              <span className={`text-xs px-2 py-1 rounded ${getResolutionSeverityColor(task.resolution.severity)} bg-gray-700`}>
                {task.resolution.label}
              </span>
            )}
          </h4>
          <span className="text-gray-400">{expandedReviewActions ? "▼" : "▶"}</span>
        </div>
        
        {expandedReviewActions && (
          <div className="p-5">
            <div className="space-y-4">
              {/* Special Case: Reopen Decline Pending */}
              {isReopenDeclinedPending && (
                <div className="border rounded p-4 border-orange-500 bg-orange-900/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                      ⚠️
                    </div>
                    <div>
                      <h5 className="font-medium text-orange-400">Reopen Declined - Requires Decision</h5>
                      <p className="text-sm text-gray-300 mt-1">
                        Employee declined reopen. You can accept original work or mark as failed.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Acceptance note for original work (minimum 5 characters)..."
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
                      rows="3"
                    />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleAcceptReopenDecline}
                        disabled={actionLoading || !reviewNote.trim() || reviewNote.length < 5}
                        className="py-3 rounded font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ✅ Accept & Verify
                      </button>
                      <button
                        onClick={handleFailTask}
                        disabled={actionLoading}
                        className="py-3 rounded font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ❌ Mark as Failed
                      </button>
                    </div>
                    
                    {task.declineReason && (
                      <div className="mt-3 p-3 bg-gray-900 rounded">
                        <div className="text-sm text-gray-400 mb-1">Employee's Reason:</div>
                        <div className="text-gray-300">{task.declineReason}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(pendingAdminModRequests.length > 0 || pendingEmployeeModRequests.length > 0) && (
                <div className="border rounded p-4 border-slate-600 bg-slate-900/30">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-slate-200">Modification Requests</h5>
                    <span className="text-xs text-gray-400">
                      Admin: {pendingAdminModRequests.length} • Employee: {pendingEmployeeModRequests.length}
                    </span>
                  </div>

                  {pendingAdminModRequests.map((req) => (
                    <div key={req._id} className="mb-3 p-3 rounded border border-slate-700 bg-slate-800/50">
                      <div className="text-sm text-gray-300">
                        Admin Request - {req.requestType === "edit" ? "Edit" : "Delete"}
                      </div>
                      <div className={`text-xs mt-1 ${getSlaLevelClasses(getModSlaMeta(req)?.level)}`}>
                        {getModSlaMeta(req)?.label || "-"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {req.employeeViewedAt
                          ? `Employee viewed: ${new Date(req.employeeViewedAt).toLocaleString()}`
                          : "Employee has not viewed yet"}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Reason: {req.reason}
                      </div>
                    </div>
                  ))}

                  {pendingEmployeeModRequests.map((req) => (
                    <div key={req._id} className="mb-3 p-3 rounded border border-slate-700 bg-slate-800/50">
                      <div className="text-sm text-gray-300">
                        Employee Request - {req.requestType === "edit" ? "Edit" : "Delete"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        No SLA - admin decision required
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Reason: {req.reason}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <textarea
                          value={modApprovalNote}
                          onChange={(e) => setModApprovalNote(e.target.value)}
                          placeholder="Admin note (required to approve)"
                          className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                          rows="2"
                        />
                        <textarea
                          value={modRejectReason}
                          onChange={(e) => setModRejectReason(e.target.value)}
                          placeholder="Rejection reason (required to decline)"
                          className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                          rows="2"
                        />
                        <textarea
                          value={modAltSolution}
                          onChange={(e) => setModAltSolution(e.target.value)}
                          placeholder="Alternative solution (optional)"
                          className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                          rows="2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleApproveEmployeeModRequest(task._id, req._id)}
                            disabled={actionLoading || !modApprovalNote.trim()}
                            className="py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded"
                          >
                            Approve & Apply
                          </button>
                          <button
                            onClick={() => handleRejectEmployeeModRequest(task._id, req._id)}
                            disabled={actionLoading || !modRejectReason.trim()}
                            className="py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded"
                          >
                            Reject Request
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Verify Action */}
              {!isReopenDeclinedPending && (
                <div className={`border rounded p-4 ${task.status === "verified" ? "border-green-500 bg-green-900/20" : "border-gray-700"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      task.status === "verified" ? "bg-green-500 text-white" : 
                      (task.canAdminVerify || task.status === "completed" || task.status === "reopened") ? 
                      "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-500"
                    }`}>
                      {task.status === "verified" ? "✓" : "✅"}
                    </div>
                    <div>
                      <h5 className={`font-medium ${
                        task.status === "verified" ? "text-green-400" : 
                        (task.canAdminVerify || task.status === "completed" || task.status === "reopened") ? 
                        "text-white" : "text-gray-500"
                      }`}>
                        {task.status === "verified" ? "✓ Verified Task" : "Verify Work"}
                        {task.status === "reopened" && !task.status === "verified" && " (Original or Rework)"}
                      </h5>
                    </div>
                  </div>
                  
                  {task.status !== "verified" && (
                    <>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder={
                          (task.canAdminVerify || task.status === "completed" || task.status === "reopened") ? 
                          "Review note (minimum 5 characters)..." : 
                          "Task not ready for verification"
                        }
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none mb-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        rows="3"
                        disabled={!(task.canAdminVerify || task.status === "completed" || task.status === "reopened")}
                      />
                      <button
                        onClick={handleVerifyTask}
                        disabled={actionLoading || !(task.canAdminVerify || task.status === "completed" || task.status === "reopened") || !reviewNote.trim() || reviewNote.length < 5}
                        className={`w-full py-3 rounded font-medium ${
                          (task.canAdminVerify || task.status === "completed" || task.status === "reopened") ? 
                          "bg-green-600 hover:bg-green-700 text-white" : 
                          "bg-gray-700 text-gray-400 cursor-not-allowed"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {(task.canAdminVerify || task.status === "completed" || task.status === "reopened") ? 
                          "✅ Verify Work" : 
                          "⏳ Not Ready"}
                      </button>
                    </>
                  )}
                  
                  {task.status === "verified" && task.adminNote && (
                    <div className="mt-3 p-3 bg-gray-900 rounded">
                      <div className="text-sm text-gray-400 mb-1">Verification Note:</div>
                      <div className="text-gray-300">{task.adminNote}</div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Fail Action */}
              {!isReopenDeclinedPending && (
                <div className={`border rounded p-4 ${task.status === "failed" ? "border-red-500 bg-red-900/20" : "border-gray-700"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      task.status === "failed" ? "bg-red-500 text-white" : 
                      (task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task))) ? 
                      "bg-red-900/30 text-red-400" : "bg-gray-700 text-gray-500"
                    }`}>
                      {task.status === "failed" ? "✗" : "❌"}
                    </div>
                    <div>
                      <h5 className={`font-medium ${
                        task.status === "failed" ? "text-red-400" : 
                        (task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task))) ? 
                        "text-white" : "text-gray-500"
                      }`}>
                        {task.status === "failed" ? "✗ Marked as Failed" : "Mark as Failed"}
                      </h5>
                    </div>
                  </div>
                  
                  {task.status !== "failed" && (
                    <>
                      <input
                        type="text"
                        value={failureReason}
                        onChange={(e) => setFailureReason(e.target.value)}
                        placeholder={
                          (task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task))) ? 
                          "Failure reason (minimum 5 characters)..." : 
                          "Cannot fail this task"
                        }
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none mb-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!(task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task)))}
                      />
                      <button
                        onClick={handleFailTask}
                        disabled={actionLoading || !(task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task))) || !failureReason.trim() || failureReason.length < 5}
                        className={`w-full py-3 rounded font-medium ${
                          (task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task))) ? 
                          "bg-red-600 hover:bg-red-700 text-white" : 
                          "bg-gray-700 text-gray-400 cursor-not-allowed"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {(task.canAdminFail || task.status === "completed" || task.status === "reopened" || (task.status === "in_progress" && isOverdue(task))) ? 
                          "❌ Mark as Failed" : 
                          "⏳ Not Applicable"}
                      </button>
                    </>
                  )}
                  
                  {task.status === "failed" && task.failureReason && (
                    <div className="mt-3 p-3 bg-gray-900 rounded">
                      <div className="text-sm text-gray-400 mb-1">Failure Reason:</div>
                      <div className="text-gray-300">{task.failureReason}</div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Reopen Action */}
              {!isReopenDeclinedPending && (
                <div className={`border rounded p-4 ${task.status === "reopened" ? "border-orange-500 bg-orange-900/20" : "border-gray-700"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      task.status === "reopened" ? "bg-orange-500 text-white" : 
                      (task.canAdminReopen || task.status === "verified") ? 
                      "bg-orange-900/30 text-orange-400" : "bg-gray-700 text-gray-500"
                    }`}>
                      {task.status === "reopened" ? "↻" : "🔄"}
                    </div>
                    <div>
                      <h5 className={`font-medium ${
                        task.status === "reopened" ? "text-orange-400" : 
                        (task.canAdminReopen || task.status === "verified") ? 
                        "text-white" : "text-gray-500"
                      }`}>
                        {task.status === "reopened" ? "↻ Reopened Task" : "Reopen Task"}
                      </h5>
                    </div>
                  </div>
                  
                  {task.status !== "reopened" && (
                    <>
                      <textarea
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder={
                          (task.canAdminReopen || task.status === "verified") ? 
                          "Why are you reopening this work? (minimum 5 characters)..." : 
                          "Task not verified yet"
                        }
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none mb-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        rows="3"
                        disabled={!(task.canAdminReopen || task.status === "verified")}
                      />
                      <button
                        onClick={handleReopenTask}
                        disabled={actionLoading || !(task.canAdminReopen || task.status === "verified") || !reopenReason.trim() || reopenReason.length < 5}
                        className={`w-full py-3 rounded font-medium ${
                          (task.canAdminReopen || task.status === "verified") ? 
                          "bg-orange-600 hover:bg-orange-700 text-white" : 
                          "bg-gray-700 text-gray-400 cursor-not-allowed"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {(task.canAdminReopen || task.status === "verified") ? 
                          "🔄 Reopen for Revisions" : 
                          "Task Not Verified"}
                      </button>
                    </>
                  )}
                  
                  {task.status === "reopened" && task.reopenReason && (
                    <div className="mt-3 p-3 bg-gray-900 rounded">
                      <div className="text-sm text-gray-400 mb-1">Reopen Reason:</div>
                      <div className="text-gray-300">{task.reopenReason}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleApproveEmployeeModRequest = async (taskId, requestId) => {
    if (!modApprovalNote.trim()) {
      alert("Admin note is required");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${taskId}/approve-employee-modification/${requestId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            adminNote: modApprovalNote.trim(),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        await fetchAllData();
        setModApprovalNote("");
        setModRejectReason("");
        setModAltSolution("");
      } else {
        alert(data.error || "Failed to approve request");
      }
    } catch (err) {
      console.error("Approve employee mod error:", err);
      alert("Error approving employee request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectEmployeeModRequest = async (taskId, requestId) => {
    if (!modRejectReason.trim()) {
      alert("Rejection reason is required");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${taskId}/reject-employee-modification/${requestId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            reason: modRejectReason.trim(),
            alternativeSolution: modAltSolution.trim()
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        await fetchAllData();
        setModApprovalNote("");
        setModRejectReason("");
        setModAltSolution("");
      } else {
        alert(data.error || "Failed to reject request");
      }
    } catch (err) {
      console.error("Reject employee mod error:", err);
      alert("Error rejecting employee request");
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== RENDER WORK TIMELINE ====================
  
  const renderWorkTimeline = () => {
    if (!selectedTask) return null;
    
    const submissionTimeline = getWorkSubmissionTimeline(selectedTask);
    
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div 
          className="p-4 border-b border-gray-700 cursor-pointer flex justify-between items-center"
          onClick={() => setExpandedWorkTimeline(!expandedWorkTimeline)}
        >
          <h4 className="font-semibold text-lg text-white flex items-center gap-2">
            <span>📋</span>
            Work Timeline ({submissionTimeline.length} events)
          </h4>
          <span className="text-gray-400">{expandedWorkTimeline ? "▼" : "▶"}</span>
        </div>
        
        {expandedWorkTimeline && (
          <div className="p-5">
            <div className="space-y-4">
              {submissionTimeline.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No timeline events yet
                </div>
              ) : (
                submissionTimeline.map((event, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      {event.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium text-white">{event.description}</div>
                        <div className="text-sm text-gray-400">{formatDate(event.timestamp)}</div>
                      </div>
                      {event.details && (
                        <div className="text-sm text-gray-300 mt-1 bg-gray-900 p-2 rounded">
                          {event.details}
                        </div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">
                        👤 {event.actor} • {event.role}
                        {event.targetName && (
                          <span className="ml-2">🎯 {event.targetName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getRequestCenterData = (task) => {
    if (!task) {
      return {
        all: [],
        modification: [],
        extension: [],
        reopen: [],
        timeline: { all: [], modification: [], extension: [], reopen: [] },
      };
    }

    const modification = [];
    const extension = [];
    const reopen = [];

    (task.modificationRequests || []).forEach((req) => {
      modification.push({
        id: `admin_mod_${req._id}`,
        kind: "Modification",
        source: "Admin",
        type: req.requestType || "edit",
        status: req.status || "pending",
        reason: req.reason || "-",
        createdAt: req.requestedAt || req.createdAt || req.updatedAt,
        updatedAt: req.reviewedAt || req.respondedAt || req.updatedAt,
        discussion: req.discussion || [],
      });
    });

    (task.employeeModificationRequests || []).forEach((req) => {
      modification.push({
        id: `emp_mod_${req._id}`,
        kind: "Modification",
        source: "Employee",
        type: req.requestType || "edit",
        status: req.status || "pending",
        reason: req.reason || "-",
        createdAt: req.requestedAt || req.createdAt || req.updatedAt,
        updatedAt: req.reviewedAt || req.respondedAt || req.updatedAt,
        discussion: req.discussion || [],
      });
    });

    (task.extensionRequests || []).forEach((req) => {
      const source = req.requestedBy?.role === "admin" ? "Admin" : "Employee";
      extension.push({
        id: `ext_${req._id}`,
        kind: "Extension",
        source,
        type: "extension",
        status: req.status || "pending",
        reason: req.reason || "-",
        createdAt: req.requestedAt || req.createdAt || req.updatedAt,
        updatedAt: req.reviewedAt || req.updatedAt,
        discussion: [],
      });
    });

    const hasReopenEvidence =
      task.status === "reopened" ||
      !!task.reopenReason ||
      !!task.reopenDueAt ||
      !!task.reopenAcceptedAt ||
      !!task.reopenViewedAt ||
      (task.activityTimeline || []).some((evt) =>
        ["TASK_REOPENED", "TASK_REOPEN_DECLINED", "TASK_REOPEN_DECLINE_ACCEPTED"].includes(evt.action)
      );

    if (hasReopenEvidence) {
      reopen.push({
        id: `reopen_${task._id}`,
        kind: "Reopen",
        source: "Admin",
        type: "reopen",
        status: task.reopenSlaStatus || "pending",
        reason: task.reopenReason || "-",
        createdAt: task.updatedAt,
        updatedAt: task.reopenAcceptedAt || task.reopenViewedAt || task.updatedAt,
        discussion: [],
      });
    }

    const actionGroups = {
      modification: new Set([
        "MODIFICATION_REQUESTED",
        "EMPLOYEE_MODIFICATION_REQUESTED",
        "MODIFICATION_APPROVED",
        "MODIFICATION_REJECTED",
        "MODIFICATION_COUNTER_PROPOSAL",
        "MODIFICATION_EXPIRED",
        "MODIFICATION_VIEWED",
        "MODIFICATION_MESSAGE",
        "EMPLOYEE_MODIFICATION_MESSAGE",
      ]),
      extension: new Set([
        "EXTENSION_REQUESTED",
        "EXTENSION_APPROVED",
        "EXTENSION_REJECTED",
      ]),
      reopen: new Set([
        "TASK_REOPENED",
        "TASK_REOPEN_ACCEPTED",
        "TASK_REOPEN_DECLINED",
        "TASK_REOPEN_TIMEOUT",
        "REOPEN_VIEWED",
      ]),
    };

    const allTimeline = (task.activityTimeline || [])
      .filter((e) => actionGroups.modification.has(e.action) || actionGroups.extension.has(e.action) || actionGroups.reopen.has(e.action))
      .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));

    const timeline = {
      all: allTimeline,
      modification: allTimeline.filter((e) => actionGroups.modification.has(e.action)),
      extension: allTimeline.filter((e) => actionGroups.extension.has(e.action)),
      reopen: allTimeline.filter((e) => actionGroups.reopen.has(e.action)),
    };

    const sortByCreatedDesc = (arr) => arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    sortByCreatedDesc(modification);
    sortByCreatedDesc(extension);
    sortByCreatedDesc(reopen);

    const all = [...modification, ...extension, ...reopen].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return { all, modification, extension, reopen, timeline };
  };

  const renderRequestCenter = () => {
    if (!selectedTask) return null;
    const { all, modification, extension, reopen, timeline } = getRequestCenterData(selectedTask);
    const matchesRequestFilter = (statusValue, filterValue) => {
      if (filterValue === "all") return true;
      const s = String(statusValue || "").toLowerCase();
      if (filterValue === "pending") {
        return ["pending", "counter_proposed"].includes(s);
      }
      if (filterValue === "approved") {
        return ["approved", "executed", "responded", "accepted", "verified"].includes(s);
      }
      if (filterValue === "rejected") {
        return ["rejected", "declined", "expired", "timed_out", "failed"].includes(s);
      }
      return true;
    };
    const filteredModification = modification.filter((req) => matchesRequestFilter(req.status, modRequestFilter));
    const filteredExtension = extension.filter((req) => matchesRequestFilter(req.status, extRequestFilter));
    const filteredReopen = reopen.filter((req) => matchesRequestFilter(req.status, reopenRequestFilter));

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div
          className="p-4 border-b border-gray-700 cursor-pointer flex justify-between items-center"
          onClick={() => setExpandedRequestCenter(!expandedRequestCenter)}
        >
          <h4 className="font-semibold text-lg text-white flex items-center gap-2">
            <span>📋</span>
            Request Center ({all.length})
          </h4>
          <span className="text-gray-400">{expandedRequestCenter ? "▼" : "▶"}</span>
        </div>

        {expandedRequestCenter && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border border-gray-700 rounded p-3 bg-gray-900/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h5 className="text-sm font-semibold text-blue-300">Modification ({filteredModification.length})</h5>
                <select
                  value={modRequestFilter}
                  onChange={(e) => setModRequestFilter(e.target.value)}
                  className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {filteredModification.length === 0 ? (
                <div className="text-xs text-gray-500">No modification requests.</div>
              ) : (
                <div className="space-y-2">
                  {filteredModification.map((req) => (
                    <div key={req.id} className="border border-gray-700 rounded p-2 bg-gray-900/50">
                      <div className="flex justify-between items-center gap-2">
                        <div className="text-xs text-white truncate">{req.source} · {req.type}</div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-gray-700">{req.status}</span>
                      </div>
                      <div className="text-[11px] text-gray-300 mt-1">Reason: {req.reason}</div>
                      {req.discussion?.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {req.discussion.slice(-2).map((msg, idx) => (
                            <div key={idx} className="text-[11px] text-gray-300 bg-gray-800 rounded px-2 py-1">
                              {(msg.senderRole || "user")} · {msg.text || "-"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-1">
                {timeline.modification.slice(0, 6).map((evt, idx) => (
                  <div key={`mod_t_${idx}`} className="text-[11px] text-gray-400">
                    {(evt.action || "").replace(/_/g, " ").toLowerCase()} · {formatDate(evt.createdAt || evt.timestamp)}
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-700 rounded p-3 bg-gray-900/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h5 className="text-sm font-semibold text-cyan-300">Extension ({filteredExtension.length})</h5>
                <select
                  value={extRequestFilter}
                  onChange={(e) => setExtRequestFilter(e.target.value)}
                  className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {filteredExtension.length === 0 ? (
                <div className="text-xs text-gray-500">No extension requests.</div>
              ) : (
                <div className="space-y-2">
                  {filteredExtension.map((req) => (
                    <div key={req.id} className="border border-gray-700 rounded p-2 bg-gray-900/50">
                      <div className="flex justify-between items-center gap-2">
                        <div className="text-xs text-white truncate">{req.source} · extension</div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-gray-700">{req.status}</span>
                      </div>
                      <div className="text-[11px] text-gray-300 mt-1">Reason: {req.reason}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-1">
                {timeline.extension.slice(0, 6).map((evt, idx) => (
                  <div key={`ext_t_${idx}`} className="text-[11px] text-gray-400">
                    {(evt.action || "").replace(/_/g, " ").toLowerCase()} · {formatDate(evt.createdAt || evt.timestamp)}
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-700 rounded p-3 bg-gray-900/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h5 className="text-sm font-semibold text-orange-300">Reopen ({filteredReopen.length})</h5>
                <select
                  value={reopenRequestFilter}
                  onChange={(e) => setReopenRequestFilter(e.target.value)}
                  className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {filteredReopen.length === 0 ? (
                <div className="text-xs text-gray-500">No reopen requests.</div>
              ) : (
                <div className="space-y-2">
                  {filteredReopen.map((req) => (
                    <div key={req.id} className="border border-gray-700 rounded p-2 bg-gray-900/50">
                      <div className="flex justify-between items-center gap-2">
                        <div className="text-xs text-white truncate">{req.source} · reopen</div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-gray-700">{req.status}</span>
                      </div>
                      <div className="text-[11px] text-gray-300 mt-1">Reason: {req.reason}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-1">
                {timeline.reopen.slice(0, 8).map((evt, idx) => (
                  <div key={`rep_t_${idx}`} className="text-[11px] text-gray-400">
                    {(evt.action || "").replace(/_/g, " ").toLowerCase()} · {evt.actorName || evt.role || "system"} · {formatDate(evt.createdAt || evt.timestamp)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER DISCUSSION ====================
  
  const renderDiscussion = () => {
    if (!selectedTask) return null;
    
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div 
          className="p-4 border-b border-gray-700 cursor-pointer flex justify-between items-center"
          onClick={() => setExpandedDiscussion(!expandedDiscussion)}
        >
          <h4 className="font-semibold text-lg text-white flex items-center gap-2">
            <span>💬</span>
            Discussion ({taskDiscussion.length} messages)
          </h4>
          <span className="text-gray-400">{expandedDiscussion ? "▼" : "▶"}</span>
        </div>
        
        {expandedDiscussion && (
          <div className="p-5">
            <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto">
              {taskDiscussion.map((msg, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded ${
                    msg.senderRole === "admin" 
                      ? "bg-blue-900/20 border-l-4 border-blue-500" 
                      : "bg-gray-700 border-l-4 border-gray-600"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-white">
                      {msg.sender?.name || (msg.senderRole === "admin" ? "Admin" : "Employee")}
                      <span className="text-xs text-gray-400 ml-2">({msg.senderRole})</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(msg.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))}
              
              {taskDiscussion.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No discussion yet. Start a conversation!
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={discussionMessage}
                onChange={(e) => setDiscussionMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-3 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none text-white"
                onKeyPress={(e) => e.key === 'Enter' && !actionLoading && sendDiscussionMessage()}
                disabled={actionLoading}
              />
              <button
                onClick={sendDiscussionMessage}
                disabled={actionLoading || !discussionMessage.trim()}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER TASK LIFECYCLE ====================
  
  const renderTaskLifecycle = () => {
    if (!selectedTask) return null;
    
    const lifecycleTimeline = getWorkSubmissionTimeline(selectedTask);
    
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div 
          className="p-4 border-b border-gray-700 cursor-pointer flex justify-between items-center"
          onClick={() => setExpandedLifecycle(!expandedLifecycle)}
        >
          <h4 className="font-semibold text-lg text-white flex items-center gap-2">
            <span>🕓</span>
            Task Lifecycle ({lifecycleTimeline.length} events)
          </h4>
          <span className="text-gray-400">{expandedLifecycle ? "▼" : "▶"}</span>
        </div>
        
        {expandedLifecycle && (
          <div className="p-5">
            <div className="space-y-4">
              {lifecycleTimeline.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No lifecycle events yet
                </div>
              ) : (
                lifecycleTimeline.map((event, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      {event.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium text-white">{event.description}</div>
                        <div className="text-sm text-gray-400">{formatDate(event.timestamp)}</div>
                      </div>
                      {event.details && (
                        <div className="text-sm text-gray-300 mt-1 bg-gray-900 p-2 rounded">
                          {event.details}
                        </div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">
                        👤 {event.actor} • {event.role}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER FULLSCREEN TASK MODAL ====================
  
  const renderFullscreenTaskModal = () => {
    if (!selectedTask || !showFullscreen) return null;
    
    const task = selectedTask;
    const overdue = isOverdue(task);
    const isReopenTask = task.status === "reopened";
    const hasReopenDeclined = task.activityTimeline?.some(e => e.action === "TASK_REOPEN_DECLINED");
    
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-white">{task.title}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-3 py-1 rounded font-medium ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
                {task.resolution && (
                  <span className={`px-2 py-1 text-xs rounded ${getResolutionSeverityColor(task.resolution.severity)} bg-gray-700`}>
                    {task.resolution.label}
                  </span>
                )}
                <span className="text-gray-400">👤 {task.assignedTo?.name || "Unassigned"}</span>
                {overdue && (
                  <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded">
                    ⏰ Overdue by {getOverdueDays(task)}d
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowFullscreen(false)}
              className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800"
            >
              ✕ Close
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Task Context Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="text-sm text-gray-400">Category</div>
                <div className="font-medium text-white">{task.category || "General"}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="text-sm text-gray-400">Priority</div>
                <div className="font-medium text-white">{task.priority || "Medium"}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="text-sm text-gray-400">Assigned On</div>
                <div className="font-medium text-white">{formatDate(task.createdAt)}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="text-sm text-gray-400">Due Date</div>
                <div className={`font-medium ${overdue ? 'text-red-400' : 'text-white'}`}>
                  {formatDate(task.dueDate)}
                  {overdue && " (Overdue)"}
                </div>
              </div>
            </div>
            
            {/* Resolution Info */}
            {task.resolution && task.resolution.code !== "ACTIVE" && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-lg mb-3 text-white">🎯 Resolution</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400">Status</div>
                    <div className={`font-medium ${getResolutionSeverityColor(task.resolution.severity)}`}>
                      {task.resolution.label}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Phase</div>
                    <div className="font-medium text-white capitalize">{task.resolution.phase?.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Code</div>
                    <div className="font-medium text-gray-300">{task.resolution.code}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Final</div>
                    <div className="font-medium text-white">{task.resolution.isFinal ? "Yes" : "No"}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Work Submission */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
              <h4 className="font-semibold text-lg mb-4 text-white">📤 Work Submission</h4>
              
              {task.status === "completed" || task.workSubmission ? (
                <div className={`p-4 rounded ${task.workSubmission?.link || task.workSubmission?.files?.length > 0 ? 'bg-gray-800 border border-gray-600' : 'bg-yellow-900/20 border border-yellow-800'}`}>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-400">Submitted On</div>
                      <div className="font-medium text-white">{formatDate(task.completedAt)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Submitted By</div>
                      <div className="font-medium text-white">{task.assignedTo?.name || "Employee"}</div>
                    </div>
                  </div>
                  
                  {task.workSubmission?.version && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-400">Version</div>
                      <div className="font-medium text-white">v{task.workSubmission.version}</div>
                    </div>
                  )}
                  
                  {overdue && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-400">Overdue</div>
                      <div className="text-red-400 font-medium">⏰ Yes ({getOverdueDays(task)} days)</div>
                    </div>
                  )}
                  
                  {task.workSubmission?.link && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-1">🔗 Work Link</div>
                      <a 
                        href={task.workSubmission.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline break-all"
                      >
                        {task.workSubmission.link}
                      </a>
                    </div>
                  )}
                  
                  {task.workSubmission?.files?.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-1">📎 Attached Files</div>
                      <div className="text-gray-300">
                        {task.workSubmission.files.length} file(s) submitted
                      </div>
                    </div>
                  )}

                  {task.workSubmission?.employeeNote && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-sm text-gray-400 mb-1">📝 Employee Note:</div>
                      <div className="text-gray-300 bg-gray-900 p-2 rounded">
                        {task.workSubmission.employeeNote}
                      </div>
                    </div>
                  )}
                </div>
              ) : ["assigned", "accepted", "in_progress"].includes(task.status) ? (
                <div className="p-4 bg-yellow-900/20 rounded border border-yellow-800">
                  <div className="text-yellow-400 font-medium mb-2">⚠️ No Work Submitted Yet</div>
                  <p className="text-gray-300">
                    Employee has not submitted work for this task.
                  </p>
                  <div className="mt-2 text-sm text-gray-400">
                    Current status: {getStatusLabel(task.status)}
                  </div>
                  {overdue && task.status === "in_progress" && (
                    <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded">
                      <div className="text-red-400 text-sm">⏰ This task is overdue and can be marked as failed</div>
                    </div>
                  )}
                </div>
              ) : task.status === "reopened" ? (
                <div className="p-4 bg-orange-900/20 rounded border border-orange-800">
                  <div className="text-orange-400 font-medium mb-2">🔄 Task Reopened</div>
                  {task.reopenReason && (
                    <p className="text-gray-300 mb-2">Reason: {task.reopenReason}</p>
                  )}
                  {hasReopenDeclined ? (
                    <p className="text-gray-400">
                      Employee declined reopen. Requires admin decision.
                    </p>
                  ) : (
                    <p className="text-gray-400">
                      Awaiting employee to accept or decline revisions.
                    </p>
                  )}
                </div>
              ) : task.status === "failed" ? (
                <div className="p-4 bg-red-900/20 rounded border border-red-800">
                  <div className="text-red-400 font-medium mb-2">❌ Task Failed</div>
                  {task.failureReason && (
                    <p className="text-gray-300">Reason: {task.failureReason}</p>
                  )}
                </div>
              ) : task.status === "declined_by_employee" ? (
                <div className="p-4 bg-gray-800 rounded border border-gray-700">
                  <div className="text-red-400 font-medium mb-2">🚫 Task Declined</div>
                  {task.declineReason && (
                    <p className="text-gray-400">Reason: {task.declineReason}</p>
                  )}
                </div>
              ) : null}
            </div>
            
            {/* Collapsible Sections */}
            {renderReviewActions()}
            {renderRequestCenter()}
            {renderDiscussion()}
            {renderTaskLifecycle()}
          </div>
        </div>
      </div>
    );
  };

  // ==================== RENDER COMPONENTS ====================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-gray-400 animate-pulse">Loading Task Oversight Panel...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-white">Task Oversight Panel</h2>
          <p className="text-sm text-gray-400">Professional Work Review System</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAllData}
            disabled={actionLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={() => console.log("📊 Current tasks:", tasks)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium text-sm"
          >
            Debug
          </button>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Total Tasks</div>
          <div className="text-2xl font-bold text-white">{stats.totalTasks}</div>
          <div className="text-xs text-gray-500 mt-1">{employees.length} employees</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-purple-500">
          <div className="text-sm text-gray-400">Awaiting Review</div>
          <div className="text-2xl font-bold text-purple-400">{stats.awaitingReview}</div>
          {stats.overdue > 0 && (
            <div className="text-xs text-red-400 mt-1">⏰ {stats.overdue} overdue</div>
          )}
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-orange-500">
          <div className="text-sm text-gray-400">Reopened</div>
          <div className="text-2xl font-bold text-orange-400">{stats.reopened}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-red-500">
          <div className="text-sm text-gray-400">Failed</div>
          <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-green-500">
          <div className="text-sm text-gray-400">Verified</div>
          <div className="text-2xl font-bold text-green-400">{stats.verified}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-400">No Submission</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.noSubmission}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-gray-500">
          <div className="text-sm text-gray-400">Declined</div>
          <div className="text-2xl font-bold text-gray-400">{stats.declinedAssignment + stats.declinedReopen}</div>
        </div>
      </div>
      
      {/* Filters Bar */}
      <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Filter Tasks</label>
          <div className="flex flex-wrap gap-2">
            {["all", "awaiting-review", "reopened", "failed", "verified", "no-submission", "declined-assignment", "declined-reopen"].map((filter) => (
              <button
                key={filter}
                onClick={() => setGlobalFilter(filter)}
                className={`px-4 py-2 rounded font-medium flex items-center gap-2 transition-all ${
                  globalFilter === filter
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                <span>{getFilterIcon(filter)}</span>
                <span>{getFilterLabel(filter)}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              🔍 Search Tasks & Employees
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, description, employee, or resolution..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">📅 Date Filter</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 focus:outline-none text-white"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {selectedEmployee ? "Selected Employee" : "All Employees"}
            </label>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 bg-gray-700 border border-gray-600 rounded flex-1">
                <span className="font-medium text-white">
                  {selectedEmployee ? selectedEmployee.employee.name : `All Employees (${employees.length})`}
                </span>
                {selectedEmployee && (
                  <span className="text-gray-400 ml-2">({selectedEmployee.totalTasks} tasks)</span>
                )}
              </div>
              {selectedEmployee && (
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setSelectedTask(null);
                  }}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium text-sm"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Employee Queue */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">👥 Employee Work Queue</h3>
              <p className="text-sm text-gray-400">
                Sorted by urgency score (overdue &gt; reopened &gt; review) • {queueEmployees.length} in queue
              </p>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              {queueEmployees.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No employee workload in queue
                  <button 
                    onClick={fetchEmployees}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    Retry Fetch
                  </button>
                </div>
              ) : (
                queueEmployees.map((item) => {
                  const isSelected = selectedEmployee?.employee._id === item.employee._id;
                  
                  return (
                    <div
                      key={item.employee._id}
                      className={`p-4 cursor-pointer transition-all border-b border-gray-700 last:border-b-0 ${
                        isSelected 
                          ? "bg-blue-900/20 border-l-4 border-blue-500" 
                          : "border-l-4 border-transparent hover:bg-gray-700/50"
                      }`}
                      onClick={() => handleSelectEmployee(item)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">{item.employee.name}</h4>
                            {item.overdue > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-900 text-red-300 rounded">
                                ⏰ {item.overdue}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 truncate">{item.employee.email || "No email"}</p>
                          
                          {/* Task count badges */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.awaitingReview > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-900 text-purple-300 rounded">
                                👀 {item.awaitingReview}
                              </span>
                            )}
                            {item.reopened > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-900 text-orange-300 rounded">
                                🔄 {item.reopened}
                              </span>
                            )}
                            {item.failed > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-900 text-red-300 rounded">
                                ❌ {item.failed}
                              </span>
                            )}
                            {item.verified > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded">
                                ✅ {item.verified}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">{item.totalTasks}</div>
                          <div className="text-xs text-gray-400">tasks</div>
                          <div className="text-[10px] text-amber-300 mt-1">U:{item.urgencyScore}</div>
                        </div>
                      </div>
                      
                      {item.latestSubmission && (
                        <div className="text-xs text-gray-500 mt-2">
                          Latest: {formatDate(item.latestSubmission.completedAt)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Middle Column: Tasks List */}
        <div>
          <div className="bg-gray-800 rounded-lg border border-gray-700 h-full">
            <div className="p-4 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-white">
                    {selectedEmployee 
                      ? `📂 ${selectedEmployee.employee.name}'s Work (${getFilteredTasks.length})`
                      : `📂 ${getFilterLabel(globalFilter)} (${getFilteredTasks.length})`}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedEmployee ? `${selectedEmployee.totalTasks} total tasks` : `${stats.totalTasks} total tasks`}
                  </p>
                </div>
                {selectedTask && (
                  <button
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium"
                  >
                    ✕ Clear Selection
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-4 max-h-[600px] overflow-y-auto">
              {getFilteredTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {selectedEmployee 
                    ? `${selectedEmployee.employee.name} has no ${getFilterLabel(globalFilter).toLowerCase()} tasks`
                    : `No ${getFilterLabel(globalFilter).toLowerCase()} tasks found`}
                </div>
              ) : (
                getFilteredTasks.map((task) => {
                  const isSelected = selectedTask?._id === task._id;
                  const overdue = isOverdue(task);
                  const overdueDays = getOverdueDays(task);
                  const turnaround = getTurnaroundTime(task);
                  const isOverdueInProgress = task.status === "in_progress" && overdue;
                  const isReopenTask = task.status === "reopened";
                  
                  return (
                    <div
                      key={task._id}
                      className={`border rounded-lg mb-3 cursor-pointer transition-all border-l-4 ${getStatusColor(task.status).split(' ')[0]} ${
                        isSelected 
                          ? "bg-blue-900/20 border-blue-400" 
                          : "border-gray-700 hover:border-gray-600 hover:bg-gray-700/50"
                      }`}
                      onClick={() => {
                        handleSelectTask(task);
                        setShowFullscreen(true);
                      }}
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-white truncate">{task.title}</h4>
                              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(task.status)}`}>
                                {isOverdueInProgress ? "⚠️ Overdue" : getStatusLabel(task.status)}
                              </span>
                              {task.resolution && task.resolution.code !== "ACTIVE" && (
                                <span className={`px-2 py-1 text-xs rounded ${getResolutionSeverityColor(task.resolution.severity)} bg-gray-700`}>
                                  {task.resolution.label}
                                </span>
                              )}
                              {overdue && !isOverdueInProgress && (
                                <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded">
                                  ⏰ Overdue by {overdueDays}d
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-400 mb-2">
                              <span className="mr-4">👤 {task.assignedTo?.name || "Unassigned"}</span>
                              <span>📅 Due: {formatDate(task.dueDate, false)}</span>
                              {isReopenTask && (
                                <span className="ml-4 text-orange-400">🔄 Reopened</span>
                              )}
                            </div>
                            
                            {/* Work submission preview */}
                            {(task.workSubmission?.link || task.workSubmission?.files?.length > 0 || task.workSubmission?.employeeNote) && task.status !== "declined_by_employee" && (
                              <div className="mt-2 p-2 bg-gray-700 rounded">
                                <div className="text-xs text-gray-400 mb-1">📤 Work Submitted</div>
                                {task.workSubmission?.link && (
                                  <div className="text-sm text-blue-400 truncate">
                                    🔗 Link submitted
                                  </div>
                                )}
                                {(task.workSubmission?.files?.length || 0) > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Files: {task.workSubmission.files.length}
                                  </div>
                                )}
                                {task.workSubmission?.version && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Version: v{task.workSubmission.version}
                                  </div>
                                )}
                                {task.workSubmission?.employeeNote && (
                                  <div className="text-xs text-gray-300 mt-2 break-words">
                                    📝 {task.workSubmission.employeeNote}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Overdue in-progress warning */}
                            {isOverdueInProgress && (
                              <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded">
                                <div className="text-xs text-red-300">
                                  ⚠️ Overdue task - Can be marked as failed
                                </div>
                              </div>
                            )}

                            {/* Reopen info */}
                            {isReopenTask && task.status === "reopened" && (
                              <div className="mt-2 p-2 bg-orange-900/20 border border-orange-800 rounded">
                                <div className="text-xs text-orange-300">
                                  🔄 Reopened - Awaiting employee response
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right">
                            {turnaround && (
                              <div className="text-sm text-gray-400 mb-1">
                                ⏱️ {turnaround}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">Click to review</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Right Column: Task Details Panel */}
        <div className="space-y-4">
          {selectedTask ? (
            <>
              {/* Task Header */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedTask.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-3 py-1 rounded font-medium ${getStatusColor(selectedTask.status)}`}>
                        {getStatusLabel(selectedTask.status)}
                      </span>
                      {selectedTask.resolution && selectedTask.resolution.code !== "ACTIVE" && (
                        <span className={`px-2 py-1 text-xs rounded ${getResolutionSeverityColor(selectedTask.resolution.severity)} bg-gray-700`}>
                          {selectedTask.resolution.label}
                        </span>
                      )}
                      <span className="text-gray-400">👤 {selectedTask.assignedTo?.name || "Unassigned"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFullscreen(true)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                    >
                      📋 Full View
                    </button>
                    <button
                      onClick={handleClearSelection}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium"
                    >
                      ✕ Clear
                    </button>
                  </div>
                </div>
                
                {/* Task Info */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="text-sm text-gray-400">Assigned On</div>
                    <div className="font-medium text-white">{formatDate(selectedTask.createdAt)}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="text-sm text-gray-400">Due Date</div>
                    <div className={`font-medium ${isOverdue(selectedTask) ? 'text-red-400' : 'text-white'}`}>
                      {formatDate(selectedTask.dueDate)}
                      {isOverdue(selectedTask) && " (Overdue)"}
                    </div>
                  </div>
                </div>
                
                {/* Work Submission Status */}
                <div>
                  <h4 className="font-semibold text-white mb-3">📤 Work Submission Status</h4>
                  {selectedTask.status === "completed" || selectedTask.workSubmission ? (
                    <div className="p-4 bg-gray-700 rounded border border-gray-600">
                      <div className="text-sm text-gray-400 mb-3">Submitted on: {formatDate(selectedTask.completedAt)}</div>
                      {selectedTask.workSubmission?.version && (
                        <div className="text-sm text-gray-400 mb-2">Version: v{selectedTask.workSubmission.version}</div>
                      )}
                      {selectedTask.workSubmission?.link ? (
                        <a 
                          href={selectedTask.workSubmission.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline break-all"
                        >
                          🔗 View Submitted Work
                        </a>
                      ) : (
                        <div className="text-yellow-400">⚠️ No work link submitted</div>
                      )}
                      {(selectedTask.workSubmission?.files?.length || 0) > 0 && (
                        <div className="text-sm text-gray-400 mt-2">
                          Files: {selectedTask.workSubmission.files.length}
                        </div>
                      )}
                      {selectedTask.workSubmission?.employeeNote && (
                        <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
                          <div className="text-xs text-gray-400 mb-1">Employee Note</div>
                          <div className="text-gray-200 break-words">{selectedTask.workSubmission.employeeNote}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-900/20 rounded border border-yellow-800">
                      <div className="text-yellow-400">⏳ Work not submitted yet</div>
                      <p className="text-sm text-gray-300 mt-1">Current status: {getStatusLabel(selectedTask.status)}</p>
                      {isOverdue(selectedTask) && selectedTask.status === "in_progress" && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded">
                          <div className="text-red-300 text-sm">⚠️ This overdue task can be marked as failed</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Collapsible Sections */}
              {renderReviewActions()}
              {renderRequestCenter()}
              {renderDiscussion()}
              {renderTaskLifecycle()}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
              <div className="text-gray-500 text-4xl mb-3">
                {selectedEmployee ? "👇" : "👈"}
              </div>
              <h3 className="font-semibold text-white mb-2">
                {selectedEmployee 
                  ? `Select ${selectedEmployee.employee.name}'s work to review`
                  : "Select work to review"}
              </h3>
              <p className="text-gray-400 text-sm">
                Click on any task to view details and take action
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Fullscreen Task Modal */}
      {renderFullscreenTaskModal()}
    </div>
  );
};

export default TaskOversightPanel;
