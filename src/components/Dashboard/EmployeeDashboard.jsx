import { API_BASE_URL } from "../../config/api";
﻿import { useEffect, useState, useContext, useRef, useMemo } from "react";
import { AuthContext } from "../../context/AuthProvider";
import TaskDiscussion from "../Shared/TaskDiscussion";
import CommunityFeed from "../Community/CommunityFeed";
import ChatbotWidget from "../Shared/ChatbotWidget";
import SmartNotifications from "../Shared/SmartNotifications";
import { fetchWithRetry } from "../../api/httpClient";

/* ================= SCREEN CONSTANTS ================= */
const SCREENS = {
  OVERVIEW: "overview",
  TASKS: "tasks",
  DETAILS: "details",
  SUMMARY: "summary",
  NOTICES: "notices",
  MEETINGS: "meetings",
  COMMUNITY: "community",
  REQUESTS: "requests",
  NOTIFICATIONS: "notifications",
  PERFORMANCE: "performance",
};

const STATUS_TABS = ["assigned", "active", "overdue", "completed", "verified", "failed"];

const EmployeeDashboard = () => {
  const { user, logout, token } = useContext(AuthContext);
  const authToken = token || user?.token || localStorage.getItem("token");

  const [screen, setScreen] = useState(SCREENS.OVERVIEW);
  const [activeTab, setActiveTab] = useState("active");
  const [detailTab, setDetailTab] = useState("summary");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingModRequests, setPendingModRequests] = useState([]);
  const [pendingModLoading, setPendingModLoading] = useState(false);
  const [pendingModPage, setPendingModPage] = useState(1);
  const [pendingModTotalPages, setPendingModTotalPages] = useState(1);
  const [pendingModSummary, setPendingModSummary] = useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0
  });

  const [showDiscussion, setShowDiscussion] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionDate, setExtensionDate] = useState("");

  const [workLink, setWorkLink] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [workFiles, setWorkFiles] = useState([]);
  const [workStatusMsg, setWorkStatusMsg] = useState("");
  const [employeeModRequest, setEmployeeModRequest] = useState({
    type: "extension",
    reason: "",
    requestedExtension: "",
    reassignTo: "",
    scopeChange: ""
  });
  const [modResponses, setModResponses] = useState({});
  const [modActionLoading, setModActionLoading] = useState({});
  const [modViewedIds, setModViewedIds] = useState({});
  const [modDiscussionOpen, setModDiscussionOpen] = useState({});
  const [modMessagesById, setModMessagesById] = useState({});
  const [modNewMessageById, setModNewMessageById] = useState({});
  const [modSendLoadingById, setModSendLoadingById] = useState({});
  const [requestTab, setRequestTab] = useState("pending_mods");
  const [myModStatusFilter, setMyModStatusFilter] = useState("pending");
  const [extensionDiscussionOpen, setExtensionDiscussionOpen] = useState({});
  const [reopenAcceptNotes, setReopenAcceptNotes] = useState({});
  const [reopenDeclineReasons, setReopenDeclineReasons] = useState({});
  const [reopenActionLoading, setReopenActionLoading] = useState({});

  const [meetingsUpcoming, setMeetingsUpcoming] = useState([]);
  const [meetingsPast, setMeetingsPast] = useState([]);
  const [performanceReview, setPerformanceReview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [reviewCommentDraft, setReviewCommentDraft] = useState("");
  const [reviewActionLoading, setReviewActionLoading] = useState({
    acknowledge: false,
    comment: false,
    hide: false
  });
  const [reviewDiscussionOpen, setReviewDiscussionOpen] = useState(false);
  const [reviewHistoryOpenMap, setReviewHistoryOpenMap] = useState({});
  const [reviewActionError, setReviewActionError] = useState("");
  const [showHiddenReview, setShowHiddenReview] = useState(false);
  const [selfPerformance, setSelfPerformance] = useState(null);
  const [selfPerfLoading, setSelfPerfLoading] = useState(false);
  const [selfPerfTimeframe, setSelfPerfTimeframe] = useState("all");
  const [meetingDiscussionOpen, setMeetingDiscussionOpen] = useState({});
  const [meetingMessagesById, setMeetingMessagesById] = useState({});
  const [meetingNewMessageById, setMeetingNewMessageById] = useState({});
  const [meetingSendLoadingById, setMeetingSendLoadingById] = useState({});
  const [meetingActionSubmissionById, setMeetingActionSubmissionById] = useState({});
  const [meetingActionSubmittingById, setMeetingActionSubmittingById] = useState({});
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticeMessages, setNoticeMessages] = useState({});
  const [noticeExpand, setNoticeExpand] = useState({});
  const [meetingTab, setMeetingTab] = useState("upcoming");
  const [noticeFilter, setNoticeFilter] = useState("all");
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSort, setTaskSort] = useState("recent");
  const [notificationOnlyNew, setNotificationOnlyNew] = useState(true);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationSearch, setNotificationSearch] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [requestSearch, setRequestSearch] = useState("");
  const [extensionStatusFilter, setExtensionStatusFilter] = useState("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState("pending");
  const [noticeStatusView, setNoticeStatusView] = useState("current");
  const [seenNotificationMap, setSeenNotificationMap] = useState({});
  const [employeeLiveCounters, setEmployeeLiveCounters] = useState(null);
  const [employeeLiveState, setEmployeeLiveState] = useState("idle");

  const discussionRef = useRef(null);
  const overviewLoadedRef = useRef(false);

  /* ================= FETCH TASKS ================= */
  const fetchTasks = async () => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/tasks/my`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    setTasks(data.tasks || []);
    setLoading(false);
  };

  const fetchEmployeeLiveCounters = async () => {
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/api/tasks/employee/live-counters`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || "Failed to load live counters");
      setEmployeeLiveCounters(data.data || data);
      setEmployeeLiveState("live");
    } catch (err) {
      console.error("Failed to fetch employee live counters:", err);
      setEmployeeLiveState("delayed");
    }
  };

  const fetchPendingModRequests = async (page = pendingModPage) => {
    try {
      setPendingModLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        sort: "recent",
        status: "all",
        origin: "all"
      });
      if (requestSearch.trim()) params.set("search", requestSearch.trim());
      const res = await fetchWithRetry(`${API_BASE_URL}/api/tasks/modification-requests/pending?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPendingModRequests(data.pendingRequests || []);
        setPendingModTotalPages(data.pagination?.totalPages || 1);
        setPendingModSummary(data.summary || {
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          totalCount: 0
        });
      } else {
        setPendingModRequests([]);
        setPendingModTotalPages(1);
        setPendingModSummary({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch pending modification requests:", err);
      setPendingModRequests([]);
      setPendingModTotalPages(1);
      setPendingModSummary({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 });
    } finally {
      setPendingModLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) return;
    fetchTasks();
    fetchPendingModRequests();
    fetchInAppNotifications();
    fetchEmployeeLiveCounters();
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    if (screen !== SCREENS.REQUESTS) return;
    fetchPendingModRequests(pendingModPage);
  }, [authToken, screen, pendingModPage, requestSearch]);

  useEffect(() => {
    if (!authToken) return;
    const intervalId = setInterval(() => {
      fetchInAppNotifications();
      fetchMeetings();
      fetchEmployeeLiveCounters();
      if (screen === SCREENS.OVERVIEW) {
        fetchNotices();
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, [authToken, screen]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== SCREENS.REQUESTS) return;
    setPendingModPage(1);
  }, [requestSearch, requestStatusFilter, screen]);

  useEffect(() => {
    if (discussionRef.current) {
      discussionRef.current.scrollTop =
        discussionRef.current.scrollHeight;
    }
  }, [showDiscussion]);

  useEffect(() => {
    if (screen !== SCREENS.OVERVIEW || overviewLoadedRef.current) return;
    overviewLoadedRef.current = true;
    fetchMeetings();
    fetchNotices();
  }, [screen]);

  /* ================= HELPERS ================= */
  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString('en-GB') : "â€”";

  const getMeetingAttendee = (meeting) => {
    return meeting?.attendees?.find(
      a => a.employee?._id === user?.id || a.employee === user?.id
    );
  };

  const getMeetingRsvpStatus = (meeting) => {
    const attendee = getMeetingAttendee(meeting);
    return attendee?.rsvpStatus || "pending";
  };

  const getMeetingAttended = (meeting) => {
    const attendee = getMeetingAttendee(meeting);
    return attendee?.attended || false;
  };

  const isNoticeExpired = (notice) => {
    if (!notice?.expiresAt) return false;
    return new Date(notice.expiresAt) < new Date();
  };

  const getNoticeRecipient = (notice) => {
    if (!notice) return null;
    if (notice.recipients) {
      return notice.recipients.find(
        r => r.user?._id === user?.id || r.user === user?.id
      );
    }
    if (typeof notice.read === "boolean" || typeof notice.acknowledged === "boolean") {
      return {
        read: notice.read,
        acknowledged: notice.acknowledged,
        respondedAt: notice.respondedAt
      };
    }
    return null;
  };

  const getNoticeReadStatus = (notice) => {
    const recipient = getNoticeRecipient(notice);
    if (!recipient) return "Unknown";
    return recipient.read ? "Read" : "Unread";
  };

  const getNoticePriorityBadge = (priority) => {
    switch (priority) {
      case "urgent":
      case "critical":
        return "bg-red-900/40 text-red-300";
      case "high":
        return "bg-orange-900/40 text-orange-300";
      case "medium":
        return "bg-blue-900/40 text-blue-300";
      case "low":
        return "bg-gray-800 text-gray-300";
      default:
        return "bg-gray-800 text-gray-300";
    }
  };
  const getRsvpBadge = (status) => {
    switch (status) {
      case "accepted":
        return "bg-green-900/40 text-green-300";
      case "declined":
        return "bg-red-900/40 text-red-300";
      case "tentative":
        return "bg-yellow-900/40 text-yellow-300";
      default:
        return "bg-gray-800 text-gray-300";
    }
  };

  const getMeetingStatusBadge = (status) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-900/40 text-blue-300";
      case "in_progress":
        return "bg-yellow-900/40 text-yellow-300";
      case "completed":
        return "bg-green-900/40 text-green-300";
      case "cancelled":
        return "bg-red-900/40 text-red-300";
      default:
        return "bg-gray-800 text-gray-300";
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

  const isRequestExpired = (request) => {
    if (!request) return false;
    const status = String(request.status || request.reopenSlaStatus || "").toLowerCase();
    if (["expired", "timed_out"].includes(status)) return true;
    if (request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now()) return true;
    if (request.reopenDueAt && new Date(request.reopenDueAt).getTime() <= Date.now()) return true;
    return false;
  };

  const getRequestLifecycleStatus = (request) => {
    if (!request) return "pending";
    if (isRequestExpired(request)) return "expired";
    const raw = String(request.status || request.reopenSlaStatus || "pending").toLowerCase();
    if (["approved", "accepted"].includes(raw)) return "approved";
    if (["rejected", "declined"].includes(raw)) return "rejected";
    if (["executed", "completed"].includes(raw)) return "executed";
    if (["pending", "counter_proposed", "new"].includes(raw)) return "pending";
    return raw;
  };

  const matchesRequestLifecycleFilter = (request) => {
    if (requestStatusFilter === "all") return true;
    return getRequestLifecycleStatus(request) === requestStatusFilter;
  };
  const getSLAStatus = (dueDate) => {
    if (!dueDate) return "â€”";
    const diff = Math.ceil(
      (new Date(dueDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
    if (diff < 0) return `Overdue by ${Math.abs(diff)} day(s)`;
    if (diff === 0) return "Due today";
    return `Due in ${diff} day(s)`;
  };

  const getLastActivity = (task) => {
    const timeline = task?.activityTimeline || [];
    if (timeline.length === 0) return "No activity";
    const last = timeline[timeline.length - 1];
    return `${last.action?.replace(/_/g, " ")} Â· ${formatDateTime(last.createdAt || last.timestamp)}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "assigned":
        return "bg-gray-700 text-gray-300";
      case "accepted":
        return "bg-blue-900/30 text-blue-400";
      case "in_progress":
        return "bg-yellow-900/30 text-yellow-400";
      case "completed":
        return "bg-purple-900/30 text-purple-400";
      case "verified":
        return "bg-green-900/30 text-green-400";
      case "reopened":
        return "bg-orange-900/30 text-orange-400";
      case "failed":
      case "declined_by_employee":
        return "bg-red-900/30 text-red-400";
      default:
        return "bg-gray-800 text-gray-400";
    }
  };

  const formatActionLabel = (action) => {
    if (!action) return "Activity";
    const map = {
      TASK_ASSIGNED: "Task Assigned",
      TASK_ACCEPTED: "Task Accepted",
      TASK_STARTED: "Task Started",
      TASK_COMPLETED: "Task Completed",
      TASK_VERIFIED: "Task Verified",
      TASK_REOPENED: "Task Reopened",
      TASK_DECLINED: "Task Declined",
      TASK_WITHDRAWN: "Task Withdrawn",
      NOTICE_SENT: "Notice Sent",
      NOTICE_COMMENT: "Notice Comment",
      MEETING_UPCOMING: "Upcoming Meeting",
      MODIFICATION_PENDING: "Modification Pending",
      EXTENSION_PENDING: "Extension Pending",
    };
    if (map[action]) return map[action];
    return action
      .toLowerCase()
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getNotificationMeta = (item) => {
    if (item.source === "meeting") {
      return { icon: "ðŸ“…", badge: "bg-purple-900/30 text-purple-300" };
    }
    if (item.source === "notice") {
      return { icon: "ðŸ“¢", badge: "bg-amber-900/30 text-amber-300" };
    }
    if (item.source === "request") {
      return { icon: "ðŸ“‹", badge: "bg-orange-900/30 text-orange-300" };
    }
    if (item.source === "community") {
      return { icon: "COMM", badge: "bg-blue-900/30 text-blue-300" };
    }
    return { icon: "âœ…", badge: "bg-blue-900/30 text-blue-300" };
  };

  const getScreenLabel = (value) => {
    switch (value) {
      case SCREENS.OVERVIEW: return "Overview";
      case SCREENS.TASKS: return "My Tasks";
      case SCREENS.DETAILS: return "Task Details";
      case SCREENS.REQUESTS: return "Requests";
      case SCREENS.MEETINGS: return "Meetings";
      case SCREENS.NOTICES: return "Notices";
      case SCREENS.COMMUNITY: return "Community";
      case SCREENS.PERFORMANCE: return "Performance";
      default: return "Dashboard";
    }
  };

  const buildRecordingPlayerUrl = (recording) => {
    if (!recording?.url) return "#";
    const params = new URLSearchParams({
      src: recording.url,
      name: recording.fileName || "meeting-recording.mp4",
      mime: recording.mimeType || "video/mp4"
    });
    return `/meeting-recording?${params.toString()}`;
  };

  const filteredTasksBase = tasks.filter((t) => {
    if (activeTab === "assigned") return t.status === "assigned";
    if (activeTab === "active")
      return ["accepted", "in_progress"].includes(t.status);
    if (activeTab === "overdue")
      return ["accepted", "in_progress"].includes(t.status) && t.isOverdue;
    if (activeTab === "completed") return t.status === "completed";
    if (activeTab === "verified") return t.status === "verified";
    if (activeTab === "failed")
      return ["failed", "declined_by_employee"].includes(t.status);
    return false;
  });

  const filteredTasks = useMemo(() => {
    let list = filteredTasksBase;
    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase();
      list = list.filter(t =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    }
    if (taskSort === "due") {
      list = list.slice().sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
    } else if (taskSort === "priority") {
      const weight = { high: 3, medium: 2, low: 1 };
      list = list.slice().sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0));
    } else {
      list = list.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    }
    return list;
  }, [filteredTasksBase, taskSearch, taskSort]);

  const myExtensionRequests = useMemo(() => {
    return tasks.flatMap(t => (t.extensionRequests || []).map(r => ({
      ...r,
      taskId: t._id,
      taskTitle: t.title
    }))).filter(r => r.requestedBy?.toString?.() === user?.id || r.requestedBy === user?.id);
  }, [tasks, user]);

  const reopenRequests = useMemo(() => {
    return tasks
      .filter(t => t.status === "reopened")
      .map(t => ({
        taskId: t._id,
        taskTitle: t.title,
        assignedTo: t.assignedTo,
        reopenReason: t.reopenReason,
        reopenDueAt: t.reopenDueAt,
        reopenSlaStatus: t.reopenSlaStatus || "pending",
        reopenViewedAt: t.reopenViewedAt
      }));
  }, [tasks]);

  const filteredReopenRequests = useMemo(() => {
    if (!requestSearch.trim()) return reopenRequests;
    const q = requestSearch.trim().toLowerCase();
    return reopenRequests.filter(item =>
      (item.taskTitle || "").toLowerCase().includes(q) ||
      (item.reopenReason || "").toLowerCase().includes(q) ||
      (item.assignedTo?.name || "").toLowerCase().includes(q)
    );
  }, [reopenRequests, requestSearch]);

  const adminInitiatedRequests = useMemo(() => {
    return pendingModRequests.filter(r => {
      if (r.origin !== "admin_initiated") return false;
      if (r.status !== "pending") return false;
      return true;
    });
  }, [pendingModRequests]);

  const adminInitiatedCurrentPending = useMemo(() => {
    return adminInitiatedRequests.filter((r) => !isRequestExpired(r));
  }, [adminInitiatedRequests]);

  const myModificationRequests = useMemo(() => {
    const fromPending = pendingModRequests.filter(r => r.origin === "employee_initiated");
    const fromTasks = tasks.flatMap(t =>
      (t.employeeModificationRequests || [])
        .filter((r) => {
          const requestedById = r?.requestedBy?._id || r?.requestedBy;
          return requestedById ? String(requestedById) === String(user?.id) : true;
        })
        .map(r => ({
          ...r,
          requestId: r._id,
          origin: "employee_initiated",
          taskId: t._id,
          taskTitle: t.title,
          assignedTo: t.assignedTo
        }))
    );
    const merged = [...fromPending, ...fromTasks];
    const seen = new Set();
    return merged.filter(r => {
      const key = `${r.taskId}-${r.requestId || r._id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pendingModRequests, tasks]);

  const requestOutcomeStats = useMemo(() => {
    const normalize = (value) => String(value || "").toLowerCase();

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let expired = 0;
    let executed = 0;

    myModificationRequests.forEach((r) => {
      const status = normalize(r.status);
      if (status === "approved") approved += 1;
      else if (status === "rejected") rejected += 1;
      else if (status === "expired") expired += 1;
      else if (status === "executed") executed += 1;
      else pending += 1;
    });

    myExtensionRequests.forEach((r) => {
      const status = normalize(r.status);
      if (status === "approved") approved += 1;
      else if (status === "rejected") rejected += 1;
      else if (status === "pending") pending += 1;
      else if (r.requestedDueDate && new Date(r.requestedDueDate).getTime() < Date.now()) expired += 1;
      else pending += 1;
    });

    reopenRequests.forEach((r) => {
      const status = normalize(r.reopenSlaStatus || r.status);
      if (status === "accepted" || status === "approved") approved += 1;
      else if (status === "declined" || status === "rejected") rejected += 1;
      else if (status === "expired") expired += 1;
      else pending += 1;
    });

    return {
      pending,
      approved,
      rejected,
      expired,
      executed,
      total: pending + approved + rejected + expired + executed
    };
  }, [myModificationRequests, myExtensionRequests, reopenRequests]);

  const pendingModByTaskId = useMemo(() => {
    const map = {};
    adminInitiatedCurrentPending.forEach(req => {
      if (!req.taskId) return;
      map[req.taskId] = (map[req.taskId] || 0) + 1;
    });
    return map;
  }, [adminInitiatedCurrentPending]);

  const filteredPendingModRequests = useMemo(() => {
    if (!requestSearch.trim()) return adminInitiatedRequests;
    const q = requestSearch.trim().toLowerCase();
    return adminInitiatedRequests.filter(item =>
      (item.taskTitle || "").toLowerCase().includes(q) ||
      (item.reason || "").toLowerCase().includes(q) ||
      (item.assignedTo?.name || "").toLowerCase().includes(q)
    );
  }, [adminInitiatedRequests, requestSearch]);

  const filteredMyModRequests = useMemo(() => {
    if (!requestSearch.trim()) return myModificationRequests;
    const q = requestSearch.trim().toLowerCase();
    return myModificationRequests.filter(item =>
      (item.taskTitle || "").toLowerCase().includes(q) ||
      (item.reason || "").toLowerCase().includes(q) ||
      (item.assignedTo?.name || "").toLowerCase().includes(q)
    );
  }, [myModificationRequests, requestSearch]);

  const statusFilteredMyModRequests = useMemo(() => {
    if (myModStatusFilter === "all") return filteredMyModRequests;
    return filteredMyModRequests.filter((item) => getRequestLifecycleStatus(item) === myModStatusFilter);
  }, [filteredMyModRequests, myModStatusFilter]);

  const filteredExtensionRequests = useMemo(() => {
    let list = myExtensionRequests;
    if (extensionStatusFilter !== "all") {
      list = list.filter(r => r.status === extensionStatusFilter);
    }
    if (requestSearch.trim()) {
      const q = requestSearch.trim().toLowerCase();
      list = list.filter(r =>
        (r.taskTitle || "").toLowerCase().includes(q) ||
        (r.reason || r.extensionReason || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [myExtensionRequests, extensionStatusFilter, requestSearch]);

  const statusFilteredPendingMods = useMemo(() => {
    return filteredPendingModRequests.filter(matchesRequestLifecycleFilter);
  }, [filteredPendingModRequests, requestStatusFilter]);

  const statusFilteredReopenRequests = useMemo(() => {
    return filteredReopenRequests.filter(matchesRequestLifecycleFilter);
  }, [filteredReopenRequests, requestStatusFilter]);

  const statusFilteredExtensionRequests = useMemo(() => {
    return filteredExtensionRequests.filter(matchesRequestLifecycleFilter);
  }, [filteredExtensionRequests, requestStatusFilter]);


  const recentActivity = useMemo(() => {
    const events = [];
    tasks.forEach(t => {
      (t.activityTimeline || []).forEach(evt => {
        const timestamp = evt.createdAt || evt.timestamp;
        if (!timestamp) return;
        events.push({
          taskId: t._id,
          title: t.title,
          action: evt.action,
          role: evt.role,
          details: evt.details,
          timestamp
        });
      });
    });
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return events.slice(0, 8);
  }, [tasks]);

  const notifications = useMemo(() => {
    const items = [];
    tasks.forEach(t => {
      (t.activityTimeline || []).forEach(evt => {
        const timestamp = evt.createdAt || evt.timestamp;
        if (!timestamp) return;
        items.push({
          source: "task",
          title: t.title,
          taskId: t._id,
          action: evt.action,
          details: evt.details,
          timestamp
        });
      });
    });
    notices.forEach(n => {
      if (n.createdAt || n.sendAt) {
        items.push({
          source: "notice",
          title: n.title,
          action: "NOTICE_SENT",
          details: n.content,
          timestamp: n.sendAt || n.createdAt
        });
      }
      (n.discussion || []).forEach(msg => {
        if (!msg.createdAt) return;
        items.push({
          source: "notice",
          title: n.title,
          action: "NOTICE_COMMENT",
          details: msg.text,
          timestamp: msg.createdAt
        });
      });
    });
    inAppNotifications.forEach(n => {
      items.push({
        source: "community",
        title: n.title || "Community",
        action: (n.type || "MENTION").toUpperCase(),
        details: n.message,
        timestamp: n.createdAt,
        data: n.data
      });
    });
    meetingsUpcoming.forEach(m => {
      items.push({
        source: "meeting",
        title: m.title,
        action: "MEETING_UPCOMING",
        details: `${new Date(m.meetingDateTime).toLocaleString('en-GB')} Â· ${m.meetingPlatform || "Meeting"}`,
        timestamp: m.meetingDateTime
      });
    });
    pendingModRequests.forEach(req => {
      items.push({
        source: "request",
        title: req.taskTitle,
        taskId: req.taskId,
        requestId: req.requestId,
        action: "MODIFICATION_PENDING",
        details: req.reason,
        timestamp: req.requestedAt || req.createdAt || req.updatedAt || new Date().toISOString()
      });
    });
    myExtensionRequests.forEach(req => {
      if (req.status !== "pending") return;
      items.push({
        source: "request",
        title: req.taskTitle,
        taskId: req.taskId,
        action: "EXTENSION_PENDING",
        details: req.reason || req.extensionReason,
        timestamp: req.requestedAt || req.createdAt || new Date().toISOString()
      });
    });
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return items;
  }, [tasks, notices, inAppNotifications, meetingsUpcoming, pendingModRequests, myExtensionRequests]);

  const notificationStorageKey = useMemo(
    () => `ems_seen_notifications_${user?.id || "employee"}`,
    [user?.id]
  );

  const buildNotificationKey = (n) =>
    `${n.source || "x"}|${n.action || "x"}|${n.taskId || "x"}|${n.requestId || "x"}|${n.title || "x"}|${n.timestamp || "x"}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notificationStorageKey);
      setSeenNotificationMap(raw ? JSON.parse(raw) : {});
    } catch (_err) {
      setSeenNotificationMap({});
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(notificationStorageKey, JSON.stringify(seenNotificationMap));
    } catch (_err) {
      // ignore storage write errors
    }
  }, [notificationStorageKey, seenNotificationMap]);

  const markNotificationSeen = (n) => {
    const key = buildNotificationKey(n);
    setSeenNotificationMap((prev) => (prev[key] ? prev : { ...prev, [key]: Date.now() }));
  };
  const noticeStats = useMemo(() => {
    const total = notices.length;
    const expired = notices.filter(n => isNoticeExpired(n)).length;
    const active = total - expired;
    const unread = notices.filter(n => {
      if (typeof n.read === "boolean") return !n.read;
      const recipient = getNoticeRecipient(n);
      return recipient ? !recipient.read : false;
    }).length;
    const urgent = notices.filter(n => ["urgent", "critical", "high"].includes(n.priority)).length;
    return { total, active, expired, unread, urgent };
  }, [notices]);

  const filteredNotices = useMemo(() => {
    let list = notices;
    if (noticeStatusView === "current") {
      list = list.filter((n) => !isNoticeExpired(n));
    } else {
      list = list.filter((n) => isNoticeExpired(n));
    }
    if (noticeFilter === "unread") {
      list = list.filter(n => {
        const recipient = getNoticeRecipient(n);
        return recipient ? !recipient.read : false;
      });
    }
    if (noticeFilter === "urgent") {
      list = list.filter(n => ["urgent", "critical", "high"].includes(n.priority));
    }
    return list;
  }, [notices, noticeFilter, noticeStatusView]);

  const notificationStats = useMemo(() => {
    const stats = { all: notifications.length, task: 0, request: 0, meeting: 0, notice: 0, community: 0 };
    notifications.forEach(n => {
      if (stats[n.source] !== undefined) stats[n.source] += 1;
    });
    return stats;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    let list = notifications;
    if (notificationFilter !== "all") {
      list = list.filter(n => n.source === notificationFilter);
    }
    if (notificationSearch.trim()) {
      const q = notificationSearch.trim().toLowerCase();
      list = list.filter(n =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.details || "").toLowerCase().includes(q) ||
        (n.action || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [notifications, notificationFilter, notificationSearch]);

  const unseenFilteredCount = useMemo(() => {
    return filteredNotifications.filter((n) => !seenNotificationMap[buildNotificationKey(n)]).length;
  }, [filteredNotifications, seenNotificationMap]);

  const visibleNotifications = useMemo(() => {
    if (!notificationOnlyNew) return filteredNotifications.slice(0, 30);
    return filteredNotifications
      .filter((n) => !seenNotificationMap[buildNotificationKey(n)])
      .slice(0, 30);
  }, [filteredNotifications, notificationOnlyNew, seenNotificationMap]);

  const markVisibleNotificationsSeen = () => {
    if (visibleNotifications.length === 0) return;
    const updates = {};
    visibleNotifications.forEach((n) => {
      updates[buildNotificationKey(n)] = Date.now();
    });
    setSeenNotificationMap((prev) => ({ ...prev, ...updates }));
  };

  const openTaskDetailsById = (taskId) => {
    const taskFromList = tasks.find(t => t._id === taskId);
    if (taskFromList) {
      setSelectedTask(taskFromList);
      setScreen(SCREENS.DETAILS);
    }
  };

  const openTaskRequestsById = (taskId) => {
    const taskFromList = tasks.find(t => t._id === taskId);
    if (taskFromList) {
      setSelectedTask(taskFromList);
    }
    setScreen(SCREENS.REQUESTS);
  };

  const smartNotifications = useMemo(() => {
    const items = [];
    const now = Date.now();

    const overdueTasks = tasks.filter(t =>
      t.isOverdue && ["accepted", "in_progress"].includes(t.status)
    );
    if (overdueTasks.length > 0) {
      const mostOverdue = overdueTasks.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
      const maxOverdueHours = Math.max(0, (now - new Date(mostOverdue.dueDate).getTime()) / (1000 * 60 * 60));
      const priority = maxOverdueHours >= 48 ? "CRITICAL" : "IMPORTANT";
      items.push({
        id: `emp_overdue_${priority}_${overdueTasks.length}`,
        priority,
        title: priority === "CRITICAL" ? "Overdue task needs attention" : "Overdue task requires review",
        message: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}. Please review immediately.`,
        softMessage: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}. When you can, please take a look.`,
        actionLabel: "Open Task",
        autoDismissMs: priority === "IMPORTANT" ? 10000 : undefined,
        onClick: () => openTaskDetailsById(mostOverdue._id),
        blocking: true
      });
    }

    const reopenBreached = tasks.filter(t =>
      t.status === "reopened" && t.reopenDueAt && new Date(t.reopenDueAt).getTime() <= now
    );
    if (reopenBreached.length > 0) {
      const mostUrgent = reopenBreached.slice().sort((a, b) => new Date(a.reopenDueAt) - new Date(b.reopenDueAt))[0];
      const reopenHours = Math.max(0, (now - new Date(mostUrgent.reopenDueAt).getTime()) / (1000 * 60 * 60));
      const priority = reopenHours >= 48 ? "CRITICAL" : "IMPORTANT";
      items.push({
        id: `emp_reopen_breached_${priority}_${reopenBreached.length}`,
        priority,
        title: "Reopened task response overdue",
        message: `You have ${reopenBreached.length} reopened task${reopenBreached.length > 1 ? "s" : ""} waiting for response beyond SLA.`,
        softMessage: `A reopened task response is past the SLA. Please review when you're ready.`,
        actionLabel: "Open Task",
        autoDismissMs: priority === "IMPORTANT" ? 10000 : undefined,
        onClick: () => openTaskDetailsById(mostUrgent._id),
        blocking: true
      });
    }

    const assignedTasks = tasks.filter(t => t.status === "assigned");
    if (assignedTasks.length > 0) {
      const newest = assignedTasks.slice().sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt))[0];
      items.push({
        id: `emp_assigned_${assignedTasks.length}`,
        priority: "IMPORTANT",
        title: "New task assigned",
        message: `You have ${assignedTasks.length} task${assignedTasks.length > 1 ? "s" : ""} awaiting acceptance.`,
        softMessage: `There ${assignedTasks.length > 1 ? "are" : "is"} ${assignedTasks.length} task${assignedTasks.length > 1 ? "s" : ""} ready for acceptance.`,
        actionLabel: "Open Task",
        autoDismissMs: 10000,
        onClick: () => openTaskDetailsById(newest._id)
      });
    }

    const dueSoonTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      if (!["accepted", "in_progress"].includes(t.status)) return false;
      const diff = new Date(t.dueDate).getTime() - now;
      return diff > 0 && diff <= 24 * 60 * 60 * 1000;
    });
    if (dueSoonTasks.length > 0) {
      const nextDue = dueSoonTasks.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
      items.push({
        id: `emp_due_soon_${dueSoonTasks.length}`,
        priority: "IMPORTANT",
        title: "Task nearly due",
        message: `This task is almost due. You have ${dueSoonTasks.length} task${dueSoonTasks.length > 1 ? "s" : ""} close to deadline.`,
        softMessage: `A task is coming up soon. You have ${dueSoonTasks.length} nearing the deadline.`,
        actionLabel: "Open Task",
        autoDismissMs: 10000,
        onClick: () => openTaskDetailsById(nextDue._id)
      });
    }

    const inProgressNoSubmit = tasks.filter(t =>
      t.status === "in_progress" && t.workSubmission?.submissionStatus !== "submitted"
    );
    if (inProgressNoSubmit.length > 0) {
      const oldest = inProgressNoSubmit.slice().sort((a, b) => new Date(a.startedAt || a.createdAt) - new Date(b.startedAt || b.createdAt))[0];
      items.push({
        id: `emp_submit_reminder_${inProgressNoSubmit.length}`,
        priority: "IMPORTANT",
        title: "Work submission reminder",
        message: `You have ${inProgressNoSubmit.length} task${inProgressNoSubmit.length > 1 ? "s" : ""} in progress with no submission yet.`,
        softMessage: `Reminder: there are ${inProgressNoSubmit.length} in-progress task${inProgressNoSubmit.length > 1 ? "s" : ""} without a submission yet.`,
        actionLabel: "Open Task",
        autoDismissMs: 10000,
        onClick: () => openTaskDetailsById(oldest._id)
      });
    }

    if (adminInitiatedCurrentPending.length > 0) {
      const firstReq = adminInitiatedCurrentPending[0];
      items.push({
        id: `emp_mod_pending_${adminInitiatedCurrentPending.length}`,
        priority: "IMPORTANT",
        title: "Modification request pending",
        message: `You have ${adminInitiatedCurrentPending.length} modification request${adminInitiatedCurrentPending.length > 1 ? "s" : ""} awaiting your response.`,
        softMessage: `There ${adminInitiatedCurrentPending.length > 1 ? "are" : "is"} ${adminInitiatedCurrentPending.length} modification request${adminInitiatedCurrentPending.length > 1 ? "s" : ""} to review.`,
        actionLabel: "Open Request",
        onClick: () => openTaskRequestsById(firstReq.taskId),
        dismissible: true
      });
    }

    const reopenedPending = tasks.filter(t =>
      t.status === "reopened" && (!t.reopenDueAt || new Date(t.reopenDueAt).getTime() > now)
    );
    if (reopenedPending.length > 0) {
      const first = reopenedPending[0];
      items.push({
        id: `emp_reopen_pending_${reopenedPending.length}`,
        priority: "IMPORTANT",
        title: "Reopened task needs response",
        message: `You have ${reopenedPending.length} reopened task${reopenedPending.length > 1 ? "s" : ""} awaiting response.`,
        softMessage: `A reopened task needs your response when you have a moment.`,
        actionLabel: "Open Task",
        onClick: () => openTaskDetailsById(first._id),
        dismissible: true
      });
    }


    const getNotifTaskId = (notification) => {
      if (!notification) return null;
      return (
        notification?.data?.taskId ||
        notification?.data?.entityId ||
        notification?.data?.targetTaskId ||
        notification?.taskId ||
        null
      );
    };

    const reopenResponseNotifications = inAppNotifications.filter(n => {
      if (!n || n.isRead) return false;
      const text = `${n.type || ""} ${n.title || ""} ${n.message || ""}`.toLowerCase();
      const isReopen = text.includes("reopen");
      const isResponse = (
        text.includes("approved") ||
        text.includes("rejected") ||
        text.includes("declined") ||
        text.includes("accepted") ||
        text.includes("response") ||
        text.includes("updated")
      );
      return isReopen && isResponse;
    });

    if (reopenResponseNotifications.length > 0) {
      const firstTaskId = getNotifTaskId(reopenResponseNotifications[0]);
      items.push({
        id: `emp_reopen_response_${reopenResponseNotifications.length}`,
        priority: "IMPORTANT",
        title: "Reopen response update",
        message: `You have ${reopenResponseNotifications.length} reopen response update${reopenResponseNotifications.length > 1 ? "s" : ""}.`,
        softMessage: "A reopen response has been updated. Please review it in Requests.",
        actionLabel: "Open Request",
        onClick: () => {
          if (firstTaskId) openTaskRequestsById(firstTaskId);
          else setScreen(SCREENS.REQUESTS);
        },
        dismissible: true
      });
    }

    const requestResponseNotifications = inAppNotifications.filter(n => {
      if (!n || n.isRead) return false;
      const text = `${n.type || ""} ${n.title || ""} ${n.message || ""}`.toLowerCase();
      const isRequest = text.includes("request") || text.includes("modification") || text.includes("extension");
      const isResolved = (
        text.includes("approved") ||
        text.includes("rejected") ||
        text.includes("declined") ||
        text.includes("executed") ||
        text.includes("accepted") ||
        text.includes("response")
      );
      return isRequest && isResolved && !text.includes("reopen");
    });

    if (requestResponseNotifications.length > 0) {
      const firstTaskId = getNotifTaskId(requestResponseNotifications[0]);
      items.push({
        id: `emp_request_response_${requestResponseNotifications.length}`,
        priority: "IMPORTANT",
        title: "Request response update",
        message: `You have ${requestResponseNotifications.length} request response update${requestResponseNotifications.length > 1 ? "s" : ""}.`,
        softMessage: "A request response has been updated. Please review it in Requests.",
        actionLabel: "Open Request",
        onClick: () => {
          if (firstTaskId) openTaskRequestsById(firstTaskId);
          else setScreen(SCREENS.REQUESTS);
        },
        dismissible: true
      });
    }
    const todaysMeetings = meetingsUpcoming.filter(m => {
      const d = new Date(m.meetingDateTime);
      const nowDate = new Date();
      const status = String(m.status || "").toLowerCase();
                const isSchedulable = status === "scheduled" || status === "in_progress";
                return isSchedulable && d.getFullYear() === nowDate.getFullYear() && d.getMonth() === nowDate.getMonth() && d.getDate() === nowDate.getDate();
    });
    if (todaysMeetings.length > 0) {
      items.push({
        id: `emp_meeting_today_${todaysMeetings.length}`,
        priority: "IMPORTANT",
        title: "Meeting scheduled for today",
        message: `You have ${todaysMeetings.length} meeting${todaysMeetings.length > 1 ? "s" : ""} scheduled today.`,
        softMessage: `Today has ${todaysMeetings.length} scheduled meeting${todaysMeetings.length > 1 ? "s" : ""}.`,
        actionLabel: "Open Meetings",
        onClick: () => setScreen(SCREENS.MEETINGS),
        dismissible: true
      });
    }

    const unreadInApp = inAppNotifications.filter(n => !n.isRead).length;
    if (unreadInApp > 0) {
      items.push({
        id: `emp_unread_notif_${unreadInApp}`,
        priority: "IMPORTANT",
        title: "New notifications",
        message: `You have ${unreadInApp} unread notification${unreadInApp > 1 ? "s" : ""}.`,
        actionLabel: "Open Notifications",
        onClick: () => setScreen(SCREENS.NOTIFICATIONS),
        dismissible: true,
        autoDismissMs: 10000
      });
    }

    return items;
  }, [tasks, adminInitiatedCurrentPending, meetingsUpcoming, inAppNotifications, nowTick]);

  /* ================= BACKEND ACTIONS ================= */
  const acceptTask = async () => {
    await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTask._id}/accept`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    await fetchTasks();
    setScreen(SCREENS.TASKS);
    setSelectedTask(null);
  };

  const rejectTask = async () => {
    if (!rejectReason.trim()) {
      alert("Reason is required");
      return;
    }

    await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTask._id}/decline`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReason }),
      }
    );

    setRejectReason("");
    await fetchTasks();
    setScreen(SCREENS.TASKS);
    setSelectedTask(null);
  };

  const startWork = async () => {
    if (!selectedTask?._id) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tasks/${selectedTask._id}/start`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to start work");
        return;
      }

      const refreshRes = await fetch(`${API_BASE_URL}/api/tasks/${selectedTask._id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const refreshData = await refreshRes.json();

      await fetchTasks();

      if (refreshRes.ok && refreshData?.success && refreshData?.task) {
        setSelectedTask(refreshData.task);
      }
      setDetailTab("summary");
      setScreen(SCREENS.DETAILS);
    } catch (_err) {
      alert("Failed to start work");
    }
  };

  const submitWork = async () => {
    if (!workLink.trim() && workFiles.length === 0) {
      setWorkStatusMsg("Please add a work link or at least one file.");
      return;
    }

    try {
      const formData = new FormData();
      if (workLink.trim()) formData.append("workLink", workLink.trim());
      if (workNote.trim()) formData.append("employeeNote", workNote.trim());
      workFiles.forEach((file) => formData.append("workFiles", file));

      const res = await fetch(
        `${API_BASE_URL}/api/tasks/${selectedTask._id}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setWorkStatusMsg(data?.error || "Failed to submit work.");
        return;
      }

      setWorkLink("");
      setWorkNote("");
      setWorkFiles([]);
      setWorkStatusMsg("Work submitted successfully.");
      await fetchTasks();
      setScreen(SCREENS.TASKS);
      setSelectedTask(null);
    } catch (_err) {
      setWorkStatusMsg("Failed to submit work.");
    }
  };

  const withdrawTask = async () => {
    if (!withdrawReason.trim() || withdrawReason.trim().length < 10) {
      alert("Withdrawal reason must be at least 10 characters");
      return;
    }

    await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTask._id}/withdraw`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: withdrawReason.trim(), confirmed: true }),
      }
    );

    setWithdrawReason("");
    await fetchTasks();
    setScreen(SCREENS.TASKS);
    setSelectedTask(null);
  };

  const requestExtension = async () => {
    if (!extensionReason.trim() || extensionReason.trim().length < 5) {
      alert("Reason must be at least 5 characters");
      return;
    }
    if (!extensionDate) {
      alert("New due date required");
      return;
    }

    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTask._id}/request-extension`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: extensionReason.trim(), newDueDate: extensionDate }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || "Failed to request extension");
      return;
    }

    setExtensionReason("");
    setExtensionDate("");
    await fetchTasks();
  };

  const requestEmployeeModification = async () => {
    if (!employeeModRequest.reason.trim() || employeeModRequest.reason.trim().length < 10) {
      alert("Reason must be at least 10 characters");
      return;
    }

    try {
      const payload = {
        requestType: employeeModRequest.type,
        reason: employeeModRequest.reason.trim(),
      };

      if (employeeModRequest.type === "extension") {
        if (!employeeModRequest.requestedExtension) {
          alert("Requested new due date required");
          return;
        }
        payload.requestedExtension = employeeModRequest.requestedExtension;
        payload.extensionReason = employeeModRequest.reason.trim();
      }

      if (employeeModRequest.type === "reassign" && employeeModRequest.reassignTo) {
        payload.suggestedReassign = employeeModRequest.reassignTo;
        payload.reassignReason = employeeModRequest.reason.trim();
      }

      if (employeeModRequest.type === "scope_change" && employeeModRequest.scopeChange.trim()) {
        payload.scopeChanges = { description: employeeModRequest.scopeChange.trim() };
        payload.impactAssessment = employeeModRequest.reason.trim();
      }

      const res = await fetch(
        `${API_BASE_URL}/api/tasks/${selectedTask._id}/employee-request-modification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to submit modification request");
      }

      setEmployeeModRequest({
        type: "extension",
        reason: "",
        requestedExtension: "",
        reassignTo: "",
        scopeChange: ""
      });
      await fetchTasks();
      await fetchPendingModRequests();
      alert("Modification request sent to admin.");
    } catch (err) {
      alert(err.message || "Failed to submit modification request");
    }
  };

  const markModRequestViewed = async (taskId, requestId) => {
    if (modViewedIds[requestId]) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/modification-request/${requestId}/viewed`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      if (data.success) {
        setModViewedIds(prev => ({ ...prev, [requestId]: data.request?.employeeViewedAt || true }));
        await fetchTasks();
        await fetchPendingModRequests();
      }
    } catch (err) {
      console.error("Failed to mark modification request viewed:", err);
    }
  };

  const respondToModRequest = async (taskId, requestId, decision) => {
    const note = (modResponses[requestId] || "").trim();
    if (decision === "rejected" && note.length < 5) {
      alert("Decline reason must be at least 5 characters");
      return;
    }

    setModActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/modification-request/${requestId}/respond`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            note: note || (decision === "approved" ? "Approved" : ""),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setModResponses(prev => ({ ...prev, [requestId]: "" }));
        await fetchTasks();
        await fetchPendingModRequests();
      } else {
        alert(data.error || "Failed to respond");
      }
    } catch (err) {
      console.error("Respond to modification request error:", err);
      alert("Failed to respond");
    } finally {
      setModActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const toggleModDiscussion = (requestId, initialMessages = []) => {
    setModDiscussionOpen(prev => ({ ...prev, [requestId]: !prev[requestId] }));
    if (!modMessagesById[requestId]) {
      setModMessagesById(prev => ({ ...prev, [requestId]: initialMessages }));
    }
  };

  const sendModMessage = async (taskId, requestId) => {
    const text = (modNewMessageById[requestId] || "").trim();
    if (!text) return;

    setModSendLoadingById(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/modification-request/${requestId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ message: text }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setModMessagesById(prev => ({
          ...prev,
          [requestId]: [...(prev[requestId] || []), data.message]
        }));
        setModNewMessageById(prev => ({ ...prev, [requestId]: "" }));
        await fetchPendingModRequests();
      } else {
        alert(data.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send modification message:", err);
      alert("Failed to send message");
    } finally {
      setModSendLoadingById(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const markReopenViewed = async (taskId) => {
    try {
      await fetch(`${API_BASE_URL}/api/tasks/${taskId}/reopen/viewed`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        }
      });
      await fetchTasks();
    } catch (err) {
      console.error("Failed to mark reopen viewed:", err);
    }
  };

  const acceptReopenRequest = async (taskId) => {
    const note = (reopenAcceptNotes[taskId] || "").trim();
    setReopenActionLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/accept-reopen`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acceptanceNote: note })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to accept reopen request");
      } else {
        setReopenAcceptNotes(prev => ({ ...prev, [taskId]: "" }));
        await fetchTasks();
      }
    } catch (err) {
      console.error("Accept reopen error:", err);
      alert("Failed to accept reopen request");
    } finally {
      setReopenActionLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const declineReopenRequest = async (taskId) => {
    const reason = (reopenDeclineReasons[taskId] || "").trim();
    if (reason.length < 5) {
      alert("Decline reason must be at least 5 characters");
      return;
    }
    setReopenActionLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/decline-reopen`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to decline reopen request");
      } else {
        setReopenDeclineReasons(prev => ({ ...prev, [taskId]: "" }));
        await fetchTasks();
      }
    } catch (err) {
      console.error("Decline reopen error:", err);
      alert("Failed to decline reopen request");
    } finally {
      setReopenActionLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const fetchMeetings = async () => {
    try {
      const ts = Date.now();
      const [upcomingRes, pastRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/meetings/upcoming?ts=${ts}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        }),
        fetch(`${API_BASE_URL}/api/meetings/past?ts=${ts}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        })
      ]);

      const parsePayload = async (res) => {
        if (res.status === 304) {
          return { notModified: true, meetings: [] };
        }
        const raw = await res.text();
        if (!raw) return { meetings: [] };
        try {
          return JSON.parse(raw);
        } catch (_err) {
          return { meetings: [] };
        }
      };

      const [upcomingData, pastData] = await Promise.all([
        parsePayload(upcomingRes),
        parsePayload(pastRes)
      ]);

      // If both are not modified, keep current state as-is.
      if (upcomingData?.notModified && pastData?.notModified) {
        return;
      }

      const dedupeById = (list = []) => {
        const map = new Map();
        list.forEach((m) => {
          if (m?._id) map.set(m._id, m);
        });
        return Array.from(map.values());
      };

      // Trust backend scopes first, then remove overlap by preferring upcoming.
      const incomingUpcoming = dedupeById(upcomingData.meetings || []).map((m) => ({
        ...m,
        isExpired: false
      }));
      const incomingPastRaw = dedupeById(pastData.meetings || []);

      const upcomingMeetings = upcomingData?.notModified ? meetingsUpcoming : incomingUpcoming;
      const upcomingIds = new Set(upcomingMeetings.map((m) => m._id));

      const basePast = pastData?.notModified ? meetingsPast : incomingPastRaw;
      const pastMeetings = basePast
        .filter((m) => !upcomingIds.has(m._id))
        .map((m) => {
          const ts = new Date(m.meetingDateTime).getTime();
          const status = m.status || "scheduled";
          return {
            ...m,
            isExpired: status === "scheduled" && Number.isFinite(ts) ? ts < Date.now() : !!m.isExpired
          };
        });

      upcomingMeetings.sort((a, b) => new Date(a.meetingDateTime) - new Date(b.meetingDateTime));
      pastMeetings.sort((a, b) => new Date(b.meetingDateTime) - new Date(a.meetingDateTime));

      setMeetingsUpcoming(upcomingMeetings);
      setMeetingsPast(pastMeetings);
    } catch (err) {
      console.error("Failed to fetch employee meetings:", err);
      // Keep existing data on transient error instead of blanking the meeting view.
    }
  };

  const updateRsvp = async (meetingId, status) => {
    await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/rsvp`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    fetchMeetings();
  };

  const fetchMeetingDiscussion = async (meetingId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/discussion`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setMeetingMessagesById(prev => ({ ...prev, [meetingId]: data.discussion || [] }));
      }
    } catch (err) {
      console.error("Failed to fetch meeting discussion:", err);
    }
  };

  const toggleMeetingDiscussion = async (meetingId) => {
    const next = !meetingDiscussionOpen[meetingId];
    setMeetingDiscussionOpen(prev => ({ ...prev, [meetingId]: next }));
    if (next) {
      await fetchMeetingDiscussion(meetingId);
    }
  };

  const sendMeetingMessage = async (meetingId) => {
    const text = (meetingNewMessageById[meetingId] || "").trim();
    if (!text) return;
    setMeetingSendLoadingById(prev => ({ ...prev, [meetingId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.success) {
        setMeetingNewMessageById(prev => ({ ...prev, [meetingId]: "" }));
        await fetchMeetingDiscussion(meetingId);
      } else {
        alert(data.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Send meeting message error:", err);
      alert("Failed to send message");
    } finally {
      setMeetingSendLoadingById(prev => ({ ...prev, [meetingId]: false }));
    }
  };

  const submitMeetingActionItem = async (meetingId, actionItemId) => {
    const payload = meetingActionSubmissionById[actionItemId] || { text: "", url: "", file: null };
    const note = (payload.text || "").trim();
    const link = (payload.url || "").trim();
    if (!note && !link && !payload.file) {
      alert("Provide text or URL before submitting");
      return;
    }

    setMeetingActionSubmittingById(prev => ({ ...prev, [actionItemId]: true }));
    try {
      const formData = new FormData();
      formData.append("text", note);
      formData.append("url", link);
      if (payload.file) {
        formData.append("submissionFile", payload.file);
      }

      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/action-items/${actionItemId}/submit`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to submit action item");
        return;
      }
      setMeetingActionSubmissionById(prev => ({ ...prev, [actionItemId]: { text: "", url: "", file: null } }));
      await fetchMeetings();
    } catch (err) {
      console.error("Submit meeting action item error:", err);
      alert("Failed to submit action item");
    } finally {
      setMeetingActionSubmittingById(prev => ({ ...prev, [actionItemId]: false }));
    }
  };

  const toggleNotice = async (id) => {
    const nextOpen = !noticeExpand[id];
    setNoticeExpand(prev => ({ ...prev, [id]: nextOpen }));
    if (nextOpen) {
      try {
        await fetch(`${API_BASE_URL}/api/notices/${id}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        fetchNotices();
      } catch (_err) {
        // ignore read update failures
      }
    }
  };

  const sendNoticeMessage = async (noticeId) => {
    const text = noticeMessages[noticeId];
    if (!text || !text.trim()) return;

    await fetch(`${API_BASE_URL}/api/notices/${noticeId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ text: text.trim() }),
    });

    setNoticeMessages(prev => ({ ...prev, [noticeId]: "" }));
    fetchNotices();
  };
  const fetchNotices = async () => {
    setNoticesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notices/my`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotices(data.notices || []);
      } else {
        setNotices([]);
      }
    } finally {
      setNoticesLoading(false);
    }
  };

  const fetchInAppNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setInAppNotifications(data.notifications || []);
      }
    } catch (_err) {
      setInAppNotifications([]);
    }
  };

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        const review = data.user?.performanceReview || null;
        setPerformanceReview(review);
        if (!review?.hiddenByEmployee) {
          setShowHiddenReview(false);
        }
      }
    } catch (_err) {
      setPerformanceReview(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAcknowledgeReview = async () => {
    if (!authToken) return;
    setReviewActionError("");
    setReviewActionLoading((prev) => ({ ...prev, acknowledge: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/performance-review/acknowledge`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to acknowledge review");
      }
      setPerformanceReview(data.performanceReview || null);
      await fetchSelfPerformance(selfPerfTimeframe);
    } catch (err) {
      setReviewActionError(err.message || "Failed to acknowledge review");
    } finally {
      setReviewActionLoading((prev) => ({ ...prev, acknowledge: false }));
    }
  };

  const handleCommentOnReview = async () => {
    if (!authToken) return;
    const text = reviewCommentDraft.trim();
    if (!text) return;

    setReviewActionError("");
    setReviewActionLoading((prev) => ({ ...prev, comment: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/performance-review/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to add review comment");
      }
      setReviewCommentDraft("");
      setPerformanceReview(data.performanceReview || null);
      await fetchSelfPerformance(selfPerfTimeframe);
    } catch (err) {
      setReviewActionError(err.message || "Failed to add review comment");
    } finally {
      setReviewActionLoading((prev) => ({ ...prev, comment: false }));
    }
  };

  const handleHideReview = async () => {
    if (!authToken) return;
    setReviewActionError("");
    setReviewActionLoading((prev) => ({ ...prev, hide: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/performance-review/hide`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to hide review");
      }
      setPerformanceReview(data.performanceReview || null);
      setShowHiddenReview(false);
      await fetchSelfPerformance(selfPerfTimeframe);
    } catch (err) {
      setReviewActionError(err.message || "Failed to hide review");
    } finally {
      setReviewActionLoading((prev) => ({ ...prev, hide: false }));
    }
  };

  const fetchSelfPerformance = async (timeframe = selfPerfTimeframe) => {
    if (!authToken) return;
    setSelfPerfLoading(true);
    try {
      const fetchByWindow = async (windowKey) => {
        const res = await fetch(`${API_BASE_URL}/api/tasks/performance/self?timeframe=${windowKey}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        return { res, data };
      };

      let { res, data } = await fetchByWindow(timeframe);

      // If selected window has no records, transparently fall back to all-time so KPI cards stay populated.
      if (
        res.ok &&
        data?.success &&
        timeframe !== "all" &&
        Number(data?.performanceMetrics?.totalTasks || 0) === 0
      ) {
        const fallback = await fetchByWindow("all");
        if (fallback.res.ok && fallback.data?.success) {
          data = {
            ...fallback.data,
            requestedTimeframe: timeframe,
            fallbackTimeframe: "all"
          };
        }
      }

      // Capability-gated environments: local analytics fallback from loaded task data.
      if (res.status === 403) {
        const totalTasks = tasks.length;
        const verified = tasks.filter(t => t.status === "verified").length;
        const failed = tasks.filter(t => t.status === "failed").length;
        const onTime = tasks.filter(t => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)).length;
        const reopened = tasks.filter(t => t.status === "reopened").length;
        const extended = tasks.filter(t => (t.extensionRequests || []).some(e => e.status === "approved")).length;
        const lateSubmissions = tasks.filter(t => t.completedAt && t.dueDate && new Date(t.completedAt) > new Date(t.dueDate)).length;
        setSelfPerformance({
          success: true,
          requestedTimeframe: timeframe,
          fallbackTimeframe: "local",
          performanceMetrics: {
            totalTasks,
            verified,
            failed,
            onTime,
            onTimeRate: totalTasks > 0 ? ((onTime / totalTasks) * 100).toFixed(1) : 0,
            verificationRate: totalTasks > 0 ? ((verified / totalTasks) * 100).toFixed(1) : 0,
            avgAcceptanceTime: 0,
            avgCompletionTime: 0,
            avgQualityScore: 0,
            reopenRate: totalTasks > 0 ? ((reopened / totalTasks) * 100).toFixed(1) : 0,
            reopenedCount: reopened,
            extended,
            performanceRating: "Data Limited"
          },
          failureBreakdown: {
            lateSubmissions,
            noResponse: tasks.filter(t => t.status === "assigned").length,
            reopens: reopened,
            declines: tasks.filter(t => t.status === "declined_by_employee").length,
            slaBreaches: tasks.filter(t => t.isOverdue).length
          }
        });
        return;
      }

      if (data.success) setSelfPerformance(data);
      else setSelfPerformance(null);
    } catch (_err) {
      setSelfPerformance(null);
    } finally {
      setSelfPerfLoading(false);
    }
  };



  useEffect(() => {
    if (authToken) {
      fetchProfile();
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchSelfPerformance(selfPerfTimeframe);
    }
  }, [authToken, selfPerfTimeframe]);

  useEffect(() => {
    if (!authToken) return;
    if (screen === SCREENS.NOTIFICATIONS) {
      fetchInAppNotifications();
    }
    if (screen === SCREENS.NOTICES) {
      fetchNotices();
    }
    if (screen === SCREENS.MEETINGS) {
      fetchMeetings();
    }
  }, [screen, authToken]);

  useEffect(() => {
    if (!authToken) return;
    if (screen === SCREENS.OVERVIEW || screen === SCREENS.PERFORMANCE) {
      fetchProfile();
    }
  }, [screen, authToken, inAppNotifications.length]);

  const dashboardStats = useMemo(() => {
    const activeTasks = tasks.filter(t => ["accepted", "in_progress"].includes(t.status));
    const assignedTasks = tasks.filter(t => t.status === "assigned");
    const overdueTasks = tasks.filter(t => t.isOverdue);
    const completedTasks = tasks.filter(t => t.status === "completed");
    const pendingExtensions = myExtensionRequests.filter(r => r.status === "pending").length;
    const pendingModifications = adminInitiatedCurrentPending.length;
    const pendingReopens = reopenRequests.filter(r => (r.reopenSlaStatus || "pending") === "pending").length;
    return {
      activeTasks,
      assignedTasks,
      overdueTasks,
      completedTasks,
      pendingExtensions,
      pendingModifications,
      pendingReopens
    };
  }, [tasks, myExtensionRequests, adminInitiatedCurrentPending, reopenRequests]);
  const employeeDisplayName =
    user?.name || user?.fullName || user?.fullname || user?.user?.name || user?.user?.fullName || user?.user?.fullname || "Employee";
  const employeeDisplayEmail = user?.email || user?.user?.email || "";

  /* ================= UI ================= */
  return (
    <>
    <div className="flex min-h-screen bg-gradient-to-br from-[#0f172a] to-black text-white">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#020617] border-r border-gray-800 p-4 space-y-2">
        <div className="mb-4 rounded-lg border border-gray-800 bg-[#0b1220] p-3"><h2 className="text-lg font-bold">Employee Console</h2><div className="mt-2 text-sm text-gray-300 truncate">{employeeDisplayName}</div>{employeeDisplayEmail ? <div className="text-xs text-gray-500 truncate">{employeeDisplayEmail}</div> : null}</div>
        <Nav active={screen === SCREENS.OVERVIEW} onClick={() => setScreen(SCREENS.OVERVIEW)}>
          Overview
        </Nav>
        <Nav active={screen === SCREENS.TASKS} onClick={() => setScreen(SCREENS.TASKS)}>
          My Tasks
        </Nav>
        <Nav active={screen === SCREENS.DETAILS} disabled={!selectedTask} onClick={() => setScreen(SCREENS.DETAILS)}>
          Task Details
        </Nav>
        <Nav active={screen === SCREENS.REQUESTS} onClick={() => setScreen(SCREENS.REQUESTS)}>
          Requests {dashboardStats.pendingModifications + dashboardStats.pendingExtensions > 0 ? `(${dashboardStats.pendingModifications + dashboardStats.pendingExtensions})` : ""}
        </Nav>
        <Nav active={screen === SCREENS.NOTIFICATIONS} onClick={() => setScreen(SCREENS.NOTIFICATIONS)}>
          Notifications {notifications.length > 0 ? `(${notifications.length})` : ""}
        </Nav>
        <Nav active={screen === SCREENS.MEETINGS} onClick={() => { setScreen(SCREENS.MEETINGS); fetchMeetings(); }}>
          Meetings
        </Nav>
        <Nav active={screen === SCREENS.NOTICES} onClick={() => { setScreen(SCREENS.NOTICES); fetchNotices(); }}>
          Notices
        </Nav>
        <Nav active={screen === SCREENS.COMMUNITY} onClick={() => setScreen(SCREENS.COMMUNITY)}>
          Community
        </Nav>
        <Nav active={screen === SCREENS.PERFORMANCE} onClick={() => setScreen(SCREENS.PERFORMANCE)}>
          Performance
        </Nav>
      </aside>

      {/* MAIN */}
      <div className="flex-1">
        <header className="flex justify-between items-center px-6 py-4 bg-[#020617] border-b border-gray-800">
          <div>
            <h1 className="text-xl font-bold">EMS Employee Console</h1>
            <p className="text-sm text-gray-400">
              {getScreenLabel(screen)} - {employeeDisplayName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-xs px-2 py-1 rounded border ${
              employeeLiveState === "live"
                ? "border-green-700 text-green-300 bg-green-900/20"
                : employeeLiveState === "delayed"
                ? "border-yellow-700 text-yellow-300 bg-yellow-900/20"
                : "border-gray-700 text-gray-300 bg-gray-900/30"
            }`}>
              {employeeLiveState}
            </div>
            <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
              Overdue: {dashboardStats.overdueTasks.length}
            </div>
            <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
              Pending: {dashboardStats.pendingModifications + dashboardStats.pendingExtensions}
            </div>
            <button onClick={logout} className="bg-red-600 px-4 py-2 rounded">
              Logout
            </button>
          </div>
        </header>

        <main className="p-8 max-w-7xl mx-auto">
          {loading && <p className="text-gray-400">Loading...</p>}

          {/* OVERVIEW */}
          {screen === SCREENS.OVERVIEW && (
            <div className="space-y-6">
              {(() => {
                const todayMeetings = meetingsUpcoming.filter((m) => {
                  const d = new Date(m.meetingDateTime);
                  const nowDate = new Date();
                  const status = String(m.status || "").toLowerCase();
                  const isSchedulable = status === "scheduled" || status === "in_progress";
                  return (
                    isSchedulable &&
                    d.getFullYear() === nowDate.getFullYear() &&
                    d.getMonth() === nowDate.getMonth() &&
                    d.getDate() === nowDate.getDate()
                  );
                });

                return (
                  <>
                    <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <h2 className="text-2xl font-semibold">Employee Overview</h2>
                          <p className="text-sm text-gray-400 mt-1">
                            Track tasks, requests, meetings, notices, and SLA visibility from one workspace.
                          </p>
                          <div className="mt-3 text-xs text-gray-500">
                            Signed in as <span className="text-white font-medium">{employeeDisplayName}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setScreen(SCREENS.TASKS)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            Open Tasks
                          </button>
                          <button
                            onClick={() => setScreen(SCREENS.REQUESTS)}
                            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-xs"
                          >
                            Open Requests
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-lg font-semibold">Live Operations Feed</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {employeeLiveCounters?.updatedAt
                              ? `Updated ${formatDateTime(employeeLiveCounters.updatedAt)}`
                              : "Waiting for first snapshot"}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">Parity counters aligned with admin operations</div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Active Tasks</div>
                          <div className="text-2xl font-semibold">{employeeLiveCounters?.activeTasks ?? dashboardStats.activeTasks.length}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Assigned Tasks</div>
                          <div className="text-2xl font-semibold">{employeeLiveCounters?.assignedTasks ?? dashboardStats.assignedTasks.length}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Overdue Tasks</div>
                          <div className="text-2xl font-semibold text-red-300">{employeeLiveCounters?.overdueTasks ?? dashboardStats.overdueTasks.length}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Completed Tasks</div>
                          <div className="text-2xl font-semibold">{employeeLiveCounters?.completedTasks ?? dashboardStats.completedTasks.length}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Pending Requests</div>
                          <div className="text-2xl font-semibold">{employeeLiveCounters?.totalPendingRequests ?? (dashboardStats.pendingExtensions + dashboardStats.pendingModifications + dashboardStats.pendingReopens)}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Meetings Today</div>
                          <div className="text-2xl font-semibold">{employeeLiveCounters?.todayMeetings ?? 0}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Unread Notices</div>
                          <div className="text-2xl font-semibold">{employeeLiveCounters?.unreadNotices ?? 0}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                          <div className="text-xs text-gray-500">Next Meeting</div>
                          <div className="text-2xl font-semibold">
                            {employeeLiveCounters?.nextMeetingAt
                              ? new Date(employeeLiveCounters.nextMeetingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {todayMeetings.length > 0 && (
                      <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="text-lg font-semibold">Meetings Today</h3>
                            <p className="text-xs text-gray-500 mt-1">Upcoming meetings scheduled by admin for today.</p>
                          </div>
                          <button
                            onClick={() => setScreen(SCREENS.MEETINGS)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            Open Meetings
                          </button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {todayMeetings.slice(0, 3).map((m) => (
                            <div key={m._id} className="bg-[#0b1220] border border-gray-800 rounded p-3">
                              <div className="text-sm font-semibold text-white">{m.title}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {formatDateTime(m.meetingDateTime)} - {(m.status || "scheduled").replace(/_/g, " ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {todayMeetings.length === 0 && meetingsUpcoming.length > 0 && (
                      <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="text-lg font-semibold">Upcoming Meetings</h3>
                            <p className="text-xs text-gray-500 mt-1">Your next scheduled meetings.</p>
                          </div>
                          <button
                            onClick={() => setScreen(SCREENS.MEETINGS)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            Open Meetings
                          </button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {meetingsUpcoming.slice(0, 3).map((m) => (
                            <div key={m._id} className="bg-[#0b1220] border border-gray-800 rounded p-3">
                              <div className="text-sm font-semibold text-white">{m.title}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {formatDateTime(m.meetingDateTime)} - {(m.status || "scheduled").replace(/_/g, " ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#1f2933] p-4 rounded-lg border border-blue-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="text-xs uppercase tracking-wide text-blue-300">Active Tasks</div>
                  <div className="text-2xl font-bold text-white mt-1">{dashboardStats.activeTasks.length}</div>
                  <div className="text-xs text-gray-500 mt-1">accepted · in progress</div>
                </div>
                <div className="bg-[#1f2933] p-4 rounded-lg border border-yellow-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="text-xs uppercase tracking-wide text-yellow-300">Assigned</div>
                  <div className="text-2xl font-bold text-white mt-1">{dashboardStats.assignedTasks.length}</div>
                  <div className="text-xs text-gray-500 mt-1">awaiting acceptance</div>
                </div>
                <div className="bg-[#1f2933] p-4 rounded-lg border border-red-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="text-xs uppercase tracking-wide text-red-300">Overdue</div>
                  <div className="text-2xl font-bold text-white mt-1">{dashboardStats.overdueTasks.length}</div>
                  <div className="text-xs text-gray-500 mt-1">requires attention</div>
                </div>
                <div className="bg-[#1f2933] p-4 rounded-lg border border-green-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="text-xs uppercase tracking-wide text-green-300">Completed</div>
                  <div className="text-2xl font-bold text-white mt-1">{dashboardStats.completedTasks.length}</div>
                  <div className="text-xs text-gray-500 mt-1">awaiting review</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Recent Activity</h3>
                    <button
                      onClick={() => setScreen(SCREENS.TASKS)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      View Tasks
                    </button>
                  </div>
                  {recentActivity.length === 0 ? (
                    <div className="text-sm text-gray-500">No activity yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentActivity.map((evt, idx) => (
                        <div key={`${evt.taskId}-${idx}`} className="text-sm text-gray-300 bg-[#0f172a] border border-gray-700 rounded px-3 py-2">
                          <div className="font-medium text-gray-200 truncate">{evt.title}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {evt.action?.replace(/_/g, " ")} · {formatDateTime(evt.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <h3 className="font-semibold mb-3">Requests & SLA</h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div>
                      Pending modification requests:{" "}
                      <span className="text-white font-semibold">{dashboardStats.pendingModifications}</span>
                    </div>
                    <div>
                      Pending extension requests:{" "}
                      <span className="text-white font-semibold">{dashboardStats.pendingExtensions}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Open Requests to review, respond, or follow up.
                    </div>
                    <button
                      onClick={() => setScreen(SCREENS.REQUESTS)}
                      className="mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                    >
                      Go to Requests
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TASK LIST */}
          {screen === SCREENS.TASKS && (
            <>
              <div className="bg-[#1f2933] p-4 rounded border border-gray-700 mb-6">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    className="flex-1 p-3 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500"
                    placeholder="Search tasks by title or description..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />
                  <select
                    className="p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={taskSort}
                    onChange={(e) => setTaskSort(e.target.value)}
                  >
                    <option value="recent">Most Recent</option>
                    <option value="due">Due Date</option>
                    <option value="priority">Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded capitalize ${
                      activeTab === tab
                        ? "bg-blue-600"
                        : "bg-gray-800 hover:bg-gray-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  className="bg-[#1f2933] p-4 rounded border border-gray-700 mb-3 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(task.status)}`}>
                        {task.status?.replace(/_/g, " ")}
                      </span>
                      {pendingModByTaskId[task._id] && (
                        <span className="text-xs px-2 py-1 rounded bg-orange-900/30 text-orange-300 border border-orange-800/40">
                          Modification Pending
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      SLA: <span className="text-yellow-400">{getSLAStatus(task.dueDate)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Last activity: {getLastActivity(task)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setScreen(SCREENS.DETAILS);
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                    >
                      Open Details
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* TASK DETAILS */}
          {screen === SCREENS.DETAILS && selectedTask && (
            <>
              <button
                onClick={() => setScreen(SCREENS.TASKS)}
                className="mb-4 text-sm text-blue-400 hover:underline"
              >
                {"<- Back to My Tasks"}
              </button>

              <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-[#020617] p-3 border border-gray-700 rounded">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm font-semibold uppercase">{selectedTask.status}</div>
                </div>
                <div className="bg-[#020617] p-3 border border-gray-700 rounded">
                  <div className="text-xs text-gray-500">Priority</div>
                  <div className="text-sm font-semibold uppercase">{selectedTask.priority || "medium"}</div>
                </div>
                <div className="bg-[#020617] p-3 border border-gray-700 rounded">
                  <div className="text-xs text-gray-500">Due Date</div>
                  <div className="text-sm font-semibold">{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('en-GB') : "-"}</div>
                </div>
                <div className="bg-[#020617] p-3 border border-gray-700 rounded">
                  <div className="text-xs text-gray-500">SLA</div>
                  <div className="text-sm font-semibold text-yellow-300">{getSLAStatus(selectedTask.dueDate)}</div>
                </div>
              </div>
              <div className="flex gap-3 mb-4 mt-3 flex-wrap">
                {["summary", "timeline", "discussion", "requests"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2 rounded text-sm ${
                      detailTab === tab
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* META */}
              {detailTab === "summary" && (
                <div className="bg-[#020617] p-4 border border-gray-700 rounded my-4">
                  <p>Assigned on: {formatDateTime(selectedTask.createdAt)}</p>
                  <p className="text-yellow-400">
                    SLA: {getSLAStatus(selectedTask.dueDate)}
                  </p>
                  <p>Status: {selectedTask.status}</p>
                </div>
              )}

              {/* STATUS ACTIONS */}
              {detailTab === "summary" && selectedTask.status === "assigned" && (
                <div className="bg-[#020617] p-4 border border-gray-700 rounded mb-4">
                  <textarea
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    placeholder="Reason for declining task (required)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={acceptTask}
                      className="bg-green-600 px-4 py-2 rounded"
                    >
                      Accept Task
                    </button>
                    <button
                      onClick={rejectTask}
                      className="bg-red-600 px-4 py-2 rounded"
                    >
                      Decline Task
                    </button>
                  </div>
                </div>
              )}

              {detailTab === "summary" && selectedTask.status === "accepted" && (
                <div className="space-y-3 mb-4">
                  <button
                    onClick={startWork}
                    className="bg-blue-600 px-4 py-2 rounded"
                  >
                    Start Work
                  </button>
                </div>
              )}

              {detailTab === "summary" && selectedTask.status === "in_progress" && (
                <div className="bg-[#020617] p-4 rounded border border-gray-700 mb-6">
                  <h3 className="font-semibold mb-2">Submit Deliverables</h3>
                  <p className="text-xs text-gray-400 mb-2">Accepted formats: PDF, DOC, DOCX (up to 25MB each)</p>
                  <input
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    placeholder="Work link (GitHub / Drive / Jira / Figma)"
                    value={workLink}
                    onChange={(e) => setWorkLink(e.target.value)}
                  />
                  <textarea
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    rows={3}
                    placeholder="Submission note (what is completed, blockers, assumptions)"
                    value={workNote}
                    onChange={(e) => setWorkNote(e.target.value)}
                  />
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setWorkFiles(Array.from(e.target.files || []))}
                  />
                  {workFiles.length > 0 && (
                    <div className="mt-2 text-xs text-gray-300">
                      {workFiles.length} file(s) selected
                    </div>
                  )}
                  <button
                    onClick={submitWork}
                    className="mt-3 bg-green-600 px-4 py-2 rounded"
                  >
                    Submit Work
                  </button>
                  {workStatusMsg && (
                    <div className="mt-2 text-sm text-blue-300">{workStatusMsg}</div>
                  )}
                </div>
              )}

              {detailTab === "summary" && (selectedTask.status === "in_progress" || selectedTask.status === "accepted") && (
                <div className="bg-[#020617] p-4 border border-gray-700 rounded mb-6">
                  <h3 className="font-semibold mb-2">Request Extension</h3>
                  <input
                    type="date"
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    value={extensionDate}
                    onChange={(e) => setExtensionDate(e.target.value)}
                  />
                  <textarea
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    placeholder="Reason (min 5 chars)"
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                  />
                  <button
                    onClick={requestExtension}
                    className="bg-green-600 px-4 py-2 rounded"
                  >
                    Request Extension
                  </button>
                </div>
              )}

              {detailTab === "summary" && (selectedTask.status === "in_progress" || selectedTask.status === "accepted") && (
                <div className="bg-[#020617] p-4 border border-gray-700 rounded mb-6">
                  <h3 className="font-semibold mb-2">Request Modification (Admin Approval)</h3>
                  <select
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    value={employeeModRequest.type}
                    onChange={(e) => setEmployeeModRequest(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="extension">Extension</option>
                    <option value="reassign">Reassign</option>
                    <option value="scope_change">Scope Change</option>
                    <option value="edit">Edit</option>
                    <option value="delete">Delete</option>
                  </select>

                  {employeeModRequest.type === "extension" && (
                    <input
                      type="date"
                      className="w-full p-2 bg-gray-900 rounded mb-2"
                      value={employeeModRequest.requestedExtension}
                      onChange={(e) =>
                        setEmployeeModRequest(prev => ({ ...prev, requestedExtension: e.target.value }))
                      }
                    />
                  )}

                  {employeeModRequest.type === "reassign" && (
                    <select
                      className="w-full p-2 bg-gray-900 rounded mb-2"
                      value={employeeModRequest.reassignTo}
                      onChange={(e) =>
                        setEmployeeModRequest(prev => ({ ...prev, reassignTo: e.target.value }))
                      }
                    >
                      <option value="">Suggest employee (optional)</option>
                      {tasks
                        .map(t => t.assignedTo)
                        .filter(Boolean)
                        .filter((v, i, a) => a.findIndex(x => x._id === v._id) === i)
                        .map(emp => (
                          <option key={emp._id} value={emp._id}>
                            {emp.name} ({emp.email})
                          </option>
                        ))}
                    </select>
                  )}

                  {employeeModRequest.type === "scope_change" && (
                    <textarea
                      className="w-full p-2 bg-gray-900 rounded mb-2"
                      placeholder="Describe scope change"
                      value={employeeModRequest.scopeChange}
                      onChange={(e) =>
                        setEmployeeModRequest(prev => ({ ...prev, scopeChange: e.target.value }))
                      }
                    />
                  )}

                  <textarea
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    placeholder="Reason (min 10 chars)"
                    value={employeeModRequest.reason}
                    onChange={(e) => setEmployeeModRequest(prev => ({ ...prev, reason: e.target.value }))}
                  />

                  <button
                    onClick={requestEmployeeModification}
                    className="bg-blue-600 px-4 py-2 rounded"
                  >
                    Submit Request
                  </button>
                </div>
              )}
              {detailTab === "summary" && (selectedTask.status === "in_progress" || selectedTask.status === "accepted") && (
                <div className="bg-[#020617] p-4 border border-gray-700 rounded mb-6">
                  <h3 className="font-semibold mb-2">Withdraw Task</h3>
                  <textarea
                    className="w-full p-2 bg-gray-900 rounded mb-2"
                    placeholder="Reason (min 10 chars)"
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                  />
                  <button
                    onClick={withdrawTask}
                    className="bg-red-600 px-4 py-2 rounded"
                  >
                    Withdraw
                  </button>
                </div>
              )}

              {/* ACTIVITY TIMELINE */}
              {detailTab === "timeline" && (
              <div className="bg-[#020617] p-4 border border-gray-700 rounded mb-4">
                <h3 className="font-semibold mb-2">Activity Timeline</h3>
                {selectedTask.activityTimeline?.length === 0 && (
                  <p className="text-gray-400">No activity yet</p>
                )}
                {selectedTask.activityTimeline
                  ?.slice()
                  .reverse()
                  .map((a, i) => (
                    <p key={i} className="text-sm">
                      â€¢ <b>{a.action}</b> â€” {a.role} â€”{" "}
                      {formatDateTime(a.createdAt)}
                      {a.details && ` â€” ${a.details}`}
                    </p>
                  ))}
              </div>
              )}

              {detailTab === "discussion" && (
                <div
                  ref={discussionRef}
                  className="max-h-[520px] overflow-y-auto border border-gray-700 rounded p-3 bg-[#020617]"
                >
                  <TaskDiscussion
                    taskId={selectedTask._id}
                    token={user.token}
                    role="employee"
                  />
                </div>
              )}

              {detailTab === "requests" && (
                <div className="bg-[#020617] p-4 border border-gray-700 rounded">
                  <h3 className="font-semibold mb-3">Task Requests</h3>
                  {(() => {
                    const taskId = String(selectedTask._id);
                    const taskMods = pendingModRequests.filter((r) => String(r.taskId) === taskId);
                    const taskExt = myExtensionRequests.filter((r) => String(r.taskId) === taskId);
                    const taskReopen = reopenRequests.filter((r) => String(r.taskId) === taskId);
                    const total = taskMods.length + taskExt.length + taskReopen.length;
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-500">Modification Requests</div>
                            <div className="text-lg font-semibold">{taskMods.length}</div>
                          </div>
                          <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-500">Extension Requests</div>
                            <div className="text-lg font-semibold">{taskExt.length}</div>
                          </div>
                          <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-500">Reopen Requests</div>
                            <div className="text-lg font-semibold">{taskReopen.length}</div>
                          </div>
                        </div>
                        {total === 0 ? (
                          <p className="text-sm text-gray-400">No requests are linked to this task yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {taskMods.slice(0, 5).map((r, idx) => (
                              <div key={`mod-${idx}`} className="bg-[#0b1220] border border-gray-700 rounded p-3 text-sm">
                                <div className="font-medium text-white">Modification Â· {r.type || "edit"}</div>
                                <div className="text-xs text-gray-400 mt-1">Status: {r.status || "pending"}</div>
                                <div className="text-xs text-gray-400 mt-1">Reason: {r.reason || "-"}</div>
                              </div>
                            ))}
                            {taskExt.slice(0, 5).map((r, idx) => (
                              <div key={`ext-${idx}`} className="bg-[#0b1220] border border-gray-700 rounded p-3 text-sm">
                                <div className="font-medium text-white">Extension Request</div>
                                <div className="text-xs text-gray-400 mt-1">Status: {r.status || "pending"}</div>
                                <div className="text-xs text-gray-400 mt-1">Requested Due: {r.requestedDueDate ? new Date(r.requestedDueDate).toLocaleDateString('en-GB') : "-"}</div>
                                <div className="text-xs text-gray-400 mt-1">Reason: {r.reason || r.extensionReason || "-"}</div>
                              </div>
                            ))}
                            {taskReopen.slice(0, 5).map((r, idx) => (
                              <div key={`reopen-${idx}`} className="bg-[#0b1220] border border-gray-700 rounded p-3 text-sm">
                                <div className="font-medium text-white">Reopen Request</div>
                                <div className="text-xs text-gray-400 mt-1">Status: {r.reopenSlaStatus || "pending"}</div>
                                <div className="text-xs text-gray-400 mt-1">Reason: {r.reopenReason || "-"}</div>
                                <div className="text-xs text-gray-400 mt-1">Due: {r.reopenDueAt ? new Date(r.reopenDueAt).toLocaleString('en-GB') : "-"}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setScreen(SCREENS.REQUESTS)}
                          className="mt-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                        >
                          Open Full Requests Center
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* REQUESTS */}
          {screen === SCREENS.REQUESTS && (
            <div className="space-y-6">
              <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Requests Center</h2>
                    <p className="text-sm text-gray-400">Track modification approvals, SLA windows, and extension requests in one place.</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className="px-3 py-2 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                      Pending Modifications: <span className="text-orange-300 font-semibold">{dashboardStats.pendingModifications}</span>
                    </div>
                    <div className="px-3 py-2 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                      Pending Extensions: <span className="text-yellow-300 font-semibold">{dashboardStats.pendingExtensions}</span>
                    </div>
                    <div className="px-3 py-2 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                      Pending Reopens: <span className="text-red-300 font-semibold">{dashboardStats.pendingReopens}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                    <div className="text-xs text-gray-500">Requests In Queue</div>
                    <div className="text-2xl font-semibold text-white">
                      {dashboardStats.pendingModifications + dashboardStats.pendingExtensions + dashboardStats.pendingReopens}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Pending responses or approvals</div>
                  </div>
                  <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                    <div className="text-xs text-gray-500">SLA Critical</div>
                    <div className="text-2xl font-semibold text-white">
                      {filteredPendingModRequests.filter(r => {
                        const meta = getModSlaMeta(r);
                        return meta?.level === "danger";
                      }).length}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Expiring or overdue approvals</div>
                  </div>
                  <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                    <div className="text-xs text-gray-500">Your Extension Requests</div>
                    <div className="text-2xl font-semibold text-white">{myExtensionRequests.length}</div>
                    <div className="text-xs text-gray-400 mt-1">Submitted by you</div>
                  </div>
                  <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                    <div className="text-xs text-gray-500">Reopen Requests</div>
                    <div className="text-2xl font-semibold text-white">{dashboardStats.pendingReopens}</div>
                    <div className="text-xs text-gray-400 mt-1">Waiting for your response</div>
                  </div>
                  <div className="bg-[#0b1220] border border-green-800/50 rounded p-4">
                    <div className="text-xs text-gray-500">Approved Requests</div>
                    <div className="text-2xl font-semibold text-green-300">{requestOutcomeStats.approved}</div>
                    <div className="text-xs text-gray-400 mt-1">Real approved outcomes</div>
                  </div>
                  <div className="bg-[#0b1220] border border-cyan-800/50 rounded p-4">
                    <div className="text-xs text-gray-500">Executed Requests</div>
                    <div className="text-2xl font-semibold text-cyan-300">{requestOutcomeStats.executed}</div>
                    <div className="text-xs text-gray-400 mt-1">Applied by admin</div>
                  </div>
                  <div className="bg-[#0b1220] border border-red-800/50 rounded p-4">
                    <div className="text-xs text-gray-500">Rejected Requests</div>
                    <div className="text-2xl font-semibold text-red-300">{requestOutcomeStats.rejected}</div>
                    <div className="text-xs text-gray-400 mt-1">Real rejected outcomes</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    className="flex-1 min-w-[220px] p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                    placeholder="Search by task, reason, or assignee..."
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                  />
                  <select
                    value={requestStatusFilter}
                    onChange={(e) => setRequestStatusFilter(e.target.value)}
                    className="p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="executed">Executed</option>
                    <option value="expired">Expired</option>
                    <option value="all">All Status</option>
                  </select>
                  <select
                    value={extensionStatusFilter}
                    onChange={(e) => setExtensionStatusFilter(e.target.value)}
                    className="p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                  >
                    <option value="all">All Extension Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "pending_mods", label: `Pending Modifications (${pendingModSummary.pendingCount || statusFilteredPendingMods.length})` },
                  { id: "my_mods", label: `My Requests (${statusFilteredMyModRequests.length})` },
                  { id: "reopen", label: `Reopen Requests (${statusFilteredReopenRequests.length})` },
                  { id: "extensions", label: `Extensions (${statusFilteredExtensionRequests.length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRequestTab(tab.id)}
                    className={`px-3 py-2 rounded text-sm ${
                      requestTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 bg-[#0f172a] border border-gray-700 rounded px-3 py-2">
                <div>
                  Request dataset page {pendingModPage} of {pendingModTotalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingModPage((p) => Math.max(1, p - 1))}
                    disabled={pendingModPage <= 1 || pendingModLoading}
                    className="px-2 py-1 rounded bg-gray-800 border border-gray-700 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPendingModPage((p) => Math.min(pendingModTotalPages, p + 1))}
                    disabled={pendingModPage >= pendingModTotalPages || pendingModLoading}
                    className="px-2 py-1 rounded bg-gray-800 border border-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {requestTab === "pending_mods" && (
                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Pending Modification Requests</h3>
                    <span className="text-xs text-gray-400">{statusFilteredPendingMods.length} items</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Approve or decline admin-initiated changes and keep SLA on track.</p>
                  <div className="mt-4 space-y-3">
                    {pendingModLoading && (
                      <p className="text-gray-400">Loading modification requests...</p>
                    )}
                    {!pendingModLoading && statusFilteredPendingMods.length === 0 && (
                      <p className="text-gray-400">No pending modification requests.</p>
                    )}
                    {statusFilteredPendingMods.map((item) => {
                      const slaMeta = getModSlaMeta(item);
                      const isExpired = slaMeta?.remainingMs <= 0;
                      const label = item.requestType === "edit" ? "Edit" : item.requestType === "delete" ? "Delete" : (item.requestType || "Request");
                      return (
                        <div key={`${item.taskId}-${item.requestId}`} className="bg-[#0f172a] p-4 rounded border border-gray-800">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold text-white">{item.taskTitle}</div>
                                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                                  {label}
                                </span>
                                {isExpired && (
                                  <span className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-300">SLA expired</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">Assigned to: {item.assignedTo?.name || "-"}</div>
                              <div className="text-xs text-gray-400 mt-1">Reason: {item.reason}</div>
                              <div className={`text-xs mt-1 ${getSlaLevelClasses(slaMeta?.level)}`}>
                                {slaMeta?.label || "-"}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {(item.employeeViewedAt || modViewedIds[item.requestId])
                                  ? `Seen: ${new Date(item.employeeViewedAt || modViewedIds[item.requestId]).toLocaleString('en-GB')}`
                                  : "New - not viewed"}
                              </div>
                            </div>
                          </div>

                          {isExpired && (
                            <div className="mt-2 text-xs text-red-300">
                              Action locked - SLA expired
                            </div>
                          )}

                          <textarea
                            className="w-full mt-3 p-2 bg-gray-900 rounded text-sm"
                            placeholder="Response note (required for decline)"
                            value={modResponses[item.requestId] || ""}
                            onChange={(e) => setModResponses(prev => ({ ...prev, [item.requestId]: e.target.value }))}
                          />

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                markModRequestViewed(item.taskId, item.requestId);
                                respondToModRequest(item.taskId, item.requestId, "approved");
                              }}
                              disabled={isExpired || modActionLoading[item.requestId]}
                              className="text-xs bg-green-700 hover:bg-green-600 px-3 py-1 rounded disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                markModRequestViewed(item.taskId, item.requestId);
                                respondToModRequest(item.taskId, item.requestId, "rejected");
                              }}
                              disabled={isExpired || modActionLoading[item.requestId]}
                              className="text-xs bg-red-700 hover:bg-red-600 px-3 py-1 rounded disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => {
                                markModRequestViewed(item.taskId, item.requestId);
                                const taskFromList = tasks.find(t => t._id === item.taskId);
                                if (taskFromList) {
                                  setSelectedTask(taskFromList);
                                  setScreen(SCREENS.DETAILS);
                                }
                              }}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              Open Task Details
                            </button>
                            <button
                              onClick={() => {
                                markModRequestViewed(item.taskId, item.requestId);
                                toggleModDiscussion(item.requestId, item.discussion || []);
                              }}
                              className="text-xs text-indigo-300 hover:underline"
                            >
                              {modDiscussionOpen[item.requestId] ? "Hide Discussion" : "Open Discussion"}
                            </button>
                          </div>

                          {modDiscussionOpen[item.requestId] && (
                            <div className="mt-3 bg-[#0f172a] border border-gray-700 rounded p-3">
                              <div className="text-xs text-gray-400 mb-2">
                                Discussion
                              </div>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {(modMessagesById[item.requestId] || []).length === 0 && (
                                  <div className="text-xs text-gray-500">No messages yet. Ask a question.</div>
                                )}
                                {(modMessagesById[item.requestId] || []).map((msg, idx) => (
                                  <div
                                    key={`${item.requestId}-${idx}`}
                                    className={`text-xs p-2 rounded border-l-2 ${
                                      msg.senderRole === "admin"
                                        ? "bg-blue-900/30 border-blue-500"
                                        : "bg-green-900/30 border-green-500"
                                    }`}
                                  >
                                    <div className="text-gray-400">
                                      {msg.senderRole === "admin" ? "Admin" : "You"}
                                    </div>
                                    <div className="text-gray-200">{msg.text}</div>
                                    <div className="text-gray-500 mt-1">
                                      {new Date(msg.createdAt).toLocaleString('en-GB')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex gap-2">
                                <input
                                  className="flex-1 p-2 bg-gray-900 rounded text-sm"
                                  placeholder="Reply or ask a question..."
                                  value={modNewMessageById[item.requestId] || ""}
                                  onChange={(e) =>
                                    setModNewMessageById(prev => ({ ...prev, [item.requestId]: e.target.value }))
                                  }
                                />
                                <button
                                  onClick={() => sendModMessage(item.taskId, item.requestId)}
                                  disabled={modSendLoadingById[item.requestId]}
                                  className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs"
                                >
                                  {modSendLoadingById[item.requestId] ? "Sending..." : "Send"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
                {requestTab === "my_mods" && (
                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">My Modification Requests</h3>
                    <span className="text-xs text-gray-400">{statusFilteredMyModRequests.length} items</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Requests you submitted to admin, with status and discussion.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { id: "pending", label: "Pending" },
                      { id: "approved", label: "Approved" },
                      { id: "rejected", label: "Rejected" },
                      { id: "executed", label: "Executed" },
                      { id: "expired", label: "Expired" },
                      { id: "all", label: "All" }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setMyModStatusFilter(opt.id)}
                        className={`px-3 py-1 rounded text-xs border ${
                          myModStatusFilter === opt.id
                            ? "bg-blue-600 text-white border-blue-500"
                            : "bg-[#0f172a] text-gray-300 border-gray-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    {!pendingModLoading && statusFilteredMyModRequests.length === 0 && (
                      <p className="text-gray-400">No modification requests submitted yet.</p>
                    )}
                    {statusFilteredMyModRequests.map((item) => (
                      <div key={`${item.taskId}-${item.requestId}`} className="bg-[#0f172a] p-4 rounded border border-gray-800">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold text-white">{item.taskTitle}</div>
                              <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                                {item.requestType || "request"}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                item.status === "approved"
                                  ? "bg-green-900/30 text-green-300"
                                  : item.status === "executed"
                                  ? "bg-cyan-900/30 text-cyan-300"
                                  : item.status === "rejected"
                                  ? "bg-red-900/30 text-red-300"
                                  : isRequestExpired(item)
                                  ? "bg-red-900/30 text-red-300"
                                  : "bg-yellow-900/30 text-yellow-300"
                              }`}>
                                {isRequestExpired(item) ? "expired" : (item.status || "pending")}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">Assigned to: {item.assignedTo?.name || "-"}</div>
                            <div className="text-xs text-gray-400 mt-1">Reason: {item.reason}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Submitted: {item.requestedAt ? new Date(item.requestedAt).toLocaleString('en-GB') : "-"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              const taskFromList = tasks.find(t => t._id === item.taskId);
                              if (taskFromList) {
                                setSelectedTask(taskFromList);
                                setScreen(SCREENS.DETAILS);
                              }
                            }}
                            className="text-xs text-blue-400 hover:underline"
                          >
                            Open Task Details
                          </button>
                          <button
                            onClick={() => toggleModDiscussion(item.requestId, item.discussion || [])}
                            className="text-xs text-indigo-300 hover:underline"
                          >
                            {modDiscussionOpen[item.requestId] ? "Hide Discussion" : "Open Discussion"}
                          </button>
                        </div>

                        {modDiscussionOpen[item.requestId] && (
                          <div className="mt-3 bg-[#0f172a] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-400 mb-2">
                              Discussion
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {(modMessagesById[item.requestId] || []).length === 0 && (
                                <div className="text-xs text-gray-500">No messages yet. Start a discussion.</div>
                              )}
                              {(modMessagesById[item.requestId] || []).map((msg, idx) => (
                                <div
                                  key={`${item.requestId}-${idx}`}
                                  className={`text-xs p-2 rounded border-l-2 ${
                                    msg.senderRole === "admin"
                                      ? "bg-blue-900/30 border-blue-500"
                                      : "bg-green-900/30 border-green-500"
                                  }`}
                                >
                                  <div className="text-gray-400">
                                    {msg.senderRole === "admin" ? "Admin" : "You"}
                                  </div>
                                  <div className="text-gray-200">{msg.text}</div>
                                  <div className="text-gray-500 mt-1">
                                    {new Date(msg.createdAt).toLocaleString('en-GB')}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <input
                                className="flex-1 p-2 bg-gray-900 rounded text-sm"
                                placeholder="Reply or ask a question..."
                                value={modNewMessageById[item.requestId] || ""}
                                onChange={(e) =>
                                  setModNewMessageById(prev => ({ ...prev, [item.requestId]: e.target.value }))
                                }
                              />
                              <button
                                onClick={() => sendModMessage(item.taskId, item.requestId)}
                                disabled={modSendLoadingById[item.requestId]}
                                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs"
                              >
                                {modSendLoadingById[item.requestId] ? "Sending..." : "Send"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )}
                {requestTab === "reopen" && (
                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Reopen Requests</h3>
                    <span className="text-xs text-gray-400">{statusFilteredReopenRequests.length} items</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Admin reopened tasks awaiting your response within SLA.</p>
                  <div className="mt-4 space-y-3">
                    {statusFilteredReopenRequests.length === 0 && (
                      <p className="text-gray-400">No reopen requests right now.</p>
                    )}
                    {statusFilteredReopenRequests.map((item) => {
                      const reopenMeta = getReopenSlaMeta(item);
                      const isExpired = reopenMeta?.remainingMs <= 0;
                      return (
                        <div key={item.taskId} className="bg-[#0f172a] p-4 rounded border border-gray-800">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-semibold text-white">{item.taskTitle}</div>
                              <div className="text-xs text-gray-400 mt-1">Reason: {item.reopenReason || "-"}</div>
                              <div className={`text-xs mt-1 ${getSlaLevelClasses(reopenMeta?.level)}`}>
                                {reopenMeta?.label || "-"}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {item.reopenViewedAt ? `Seen: ${new Date(item.reopenViewedAt).toLocaleString('en-GB')}` : "New - not viewed"}
                              </div>
                            </div>
                          </div>

                          {isExpired && (
                            <div className="mt-2 text-xs text-red-300">Action locked - SLA expired</div>
                          )}

                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <input
                              className="w-full p-2 bg-gray-900 rounded text-sm"
                              placeholder="Acceptance note (optional)"
                              value={reopenAcceptNotes[item.taskId] || ""}
                              onChange={(e) => setReopenAcceptNotes(prev => ({ ...prev, [item.taskId]: e.target.value }))}
                            />
                            <input
                              className="w-full p-2 bg-gray-900 rounded text-sm"
                              placeholder="Decline reason (required if declining)"
                              value={reopenDeclineReasons[item.taskId] || ""}
                              onChange={(e) => setReopenDeclineReasons(prev => ({ ...prev, [item.taskId]: e.target.value }))}
                            />
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                markReopenViewed(item.taskId);
                                acceptReopenRequest(item.taskId);
                              }}
                              disabled={isExpired || reopenActionLoading[item.taskId]}
                              className="text-xs bg-green-700 hover:bg-green-600 px-3 py-1 rounded disabled:opacity-50"
                            >
                              Accept Reopen
                            </button>
                            <button
                              onClick={() => {
                                markReopenViewed(item.taskId);
                                declineReopenRequest(item.taskId);
                              }}
                              disabled={isExpired || reopenActionLoading[item.taskId]}
                              className="text-xs bg-red-700 hover:bg-red-600 px-3 py-1 rounded disabled:opacity-50"
                            >
                              Decline Reopen
                            </button>
                            <button
                              onClick={() => {
                                markReopenViewed(item.taskId);
                                const taskFromList = tasks.find(t => t._id === item.taskId);
                                if (taskFromList) {
                                  setSelectedTask(taskFromList);
                                  setScreen(SCREENS.DETAILS);
                                }
                              }}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              Open Task Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
                {requestTab === "extensions" && (
                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">My Extension Requests</h3>
                    <span className="text-xs text-gray-400">{statusFilteredExtensionRequests.length} items</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Track approval status and discussion for your extensions.</p>
                  <div className="mt-4 space-y-3">
                    {statusFilteredExtensionRequests.length === 0 && (
                      <p className="text-gray-400">No extension requests found.</p>
                    )}
                    {statusFilteredExtensionRequests.map((r, idx) => (
                      <div key={`${r.taskId}-${idx}`} className="bg-[#0f172a] p-4 rounded border border-gray-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{r.taskTitle}</div>
                            <p className="text-xs text-gray-400">Requested: {new Date(r.requestedAt || r.createdAt).toLocaleString('en-GB')}</p>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            r.status === "approved"
                              ? "bg-green-900/30 text-green-300"
                              : r.status === "rejected"
                              ? "bg-red-900/30 text-red-300"
                              : "bg-yellow-900/30 text-yellow-300"
                          }`}>
                            {r.status}
                          </div>
                        </div>
                        <button
                          onClick={() => setExtensionDiscussionOpen(prev => ({ ...prev, [r.taskId]: !prev[r.taskId] }))}
                          className="mt-2 text-xs text-blue-400 hover:underline"
                        >
                          {extensionDiscussionOpen[r.taskId] ? "Hide Discussion" : "Open Discussion"}
                        </button>
                        {extensionDiscussionOpen[r.taskId] && (
                          <div className="mt-3 bg-[#020617] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-400 mb-2">Discussion</div>
                            <TaskDiscussion taskId={r.taskId} token={user.token} role="employee" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {screen === SCREENS.NOTIFICATIONS && (
            <div className="space-y-6">
              <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Notifications</h2>
                    <p className="text-sm text-gray-400">Unified activity stream across tasks, requests, meetings, and notices.</p>
                  </div>
                  <label className="text-xs text-gray-400 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notificationOnlyNew}
                      onChange={(e) => setNotificationOnlyNew(e.target.checked)}
                      className="accent-blue-600"
                    />
                    Show only new
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                    Total: {filteredNotifications.length}
                  </span>
                  <span className="px-2 py-1 rounded bg-[#0f172a] border border-gray-700 text-blue-300">
                    New: {unseenFilteredCount}
                  </span>
                  <button
                    onClick={markVisibleNotificationsSeen}
                    className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"
                  >
                    Mark Visible as Seen
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ["all", `All (${notificationStats.all})`],
                    ["task", `Tasks (${notificationStats.task})`],
                    ["request", `Requests (${notificationStats.request})`],
                    ["meeting", `Meetings (${notificationStats.meeting})`],
                    ["notice", `Notices (${notificationStats.notice})`],
                    ["community", `Community (${notificationStats.community})`]
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNotificationFilter(key)}
                      className={`text-xs px-3 py-2 rounded border ${
                        notificationFilter === key
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-[#0f172a] text-gray-300 border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <input
                    className="flex-1 min-w-[220px] p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                    placeholder="Search notifications by title, details, or action..."
                    value={notificationSearch}
                    onChange={(e) => setNotificationSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-[#1f2933] p-4 rounded-lg border border-gray-700">
                {visibleNotifications.length === 0 ? (
                  <div className="text-gray-500 text-sm">No notifications yet.</div>
                ) : (
                  <div className="space-y-3">
                    {visibleNotifications.map((n, idx) => {
                      const meta = getNotificationMeta(n);
                      const sourceLabel = n.source ? n.source.charAt(0).toUpperCase() + n.source.slice(1) : "Update";
                      const notifKey = buildNotificationKey(n);
                      const isNew = !seenNotificationMap[notifKey];
                      return (
                        <div key={`${notifKey}-${idx}`} className="p-4 border border-gray-800 rounded bg-[#0f172a]">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-3">
                              <div className="text-2xl">{meta.icon}</div>
                              <div>
                                <div className="text-sm text-gray-200">
                                  <span className="font-semibold">{formatActionLabel(n.action)}</span>
                                  {n.title && <span className="text-gray-400"> Â· {n.title}</span>}
                                </div>
                                {n.details && <div className="text-xs text-gray-400 mt-1">{n.details}</div>}
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDateTime(n.timestamp)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isNew && (
                                <span className="text-[10px] px-2 py-1 rounded bg-blue-600/30 border border-blue-500 text-blue-200">
                                  NEW
                                </span>
                              )}
                              <div className={`text-xs px-2 py-1 rounded ${meta.badge}`}>{sourceLabel}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {n.source === "task" && n.taskId && (
                              <button
                                onClick={() => {
                                  markNotificationSeen(n);
                                  const taskFromList = tasks.find(t => t._id === n.taskId);
                                  if (taskFromList) {
                                    setSelectedTask(taskFromList);
                                    setScreen(SCREENS.DETAILS);
                                  }
                                }}
                                className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600"
                              >
                                Open Task
                              </button>
                            )}
                            {n.source === "request" && (
                              <button
                                onClick={() => {
                                  markNotificationSeen(n);
                                  setScreen(SCREENS.REQUESTS);
                                }}
                                className="px-3 py-1 rounded bg-orange-700 hover:bg-orange-600"
                              >
                                Open Requests
                              </button>
                            )}
                            {n.source === "meeting" && (
                              <button
                                onClick={() => {
                                  markNotificationSeen(n);
                                  setScreen(SCREENS.MEETINGS);
                                }}
                                className="px-3 py-1 rounded bg-purple-700 hover:bg-purple-600"
                              >
                                View Meetings
                              </button>
                            )}
                            {n.source === "notice" && (
                              <button
                                onClick={() => {
                                  markNotificationSeen(n);
                                  setScreen(SCREENS.NOTICES);
                                }}
                                className="px-3 py-1 rounded bg-amber-700 hover:bg-amber-600"
                              >
                                View Notices
                              </button>
                            )}
                            <button
                              onClick={() => markNotificationSeen(n)}
                              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
                            >
                              Mark Seen
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

                    {/* MEETINGS */}
          {screen === SCREENS.MEETINGS && (
            <div className="space-y-6">
              <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Meetings</h2>
                    <p className="text-sm text-gray-400">Upcoming and past meetings aligned with the admin experience.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="px-3 py-2 rounded bg-[#0b1220] border border-gray-700">
                      <div className="text-xs text-gray-400">Upcoming</div>
                      <div className="text-lg font-semibold">{meetingsUpcoming.length}</div>
                    </div>
                    <div className="px-3 py-2 rounded bg-[#0b1220] border border-gray-700">
                      <div className="text-xs text-gray-400">Past</div>
                      <div className="text-lg font-semibold">{meetingsPast.length}</div>
                    </div>
                    <div className="px-3 py-2 rounded bg-[#0b1220] border border-gray-700">
                      <div className="text-xs text-gray-400">Pending RSVP</div>
                      <div className="text-lg font-semibold">
                        {meetingsUpcoming.filter(m => getMeetingRsvpStatus(m) === "pending").length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMeetingTab("upcoming")}
                  className={`px-3 py-1 rounded ${meetingTab === "upcoming" ? "bg-blue-700" : "bg-gray-800 text-gray-300"}`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setMeetingTab("past")}
                  className={`px-3 py-1 rounded ${meetingTab === "past" ? "bg-blue-700" : "bg-gray-800 text-gray-300"}`}
                >
                  Past
                </button>
              </div>

              {meetingTab === "upcoming" && (
                <div className="space-y-3">
                  {meetingsUpcoming.length === 0 && (
                    <div className="text-gray-400">No upcoming meetings.</div>
                  )}
                  {meetingsUpcoming.map((m) => {
                    const meetingId = m._id;
                    const discussion = meetingMessagesById[meetingId] || [];
                    const rsvpStatus = getMeetingRsvpStatus(m);
                    return (
                      <div key={meetingId} className="bg-[#1f2933] p-4 rounded border border-gray-700">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{m.title}</h3>
                            <p className="text-sm text-gray-400">
                              {formatDateTime(m.meetingDateTime)} - {m.meetingPlatform || "Meeting"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Organizer: {m.organizer?.name || "Admin"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className={`px-2 py-1 rounded ${getMeetingStatusBadge(m.status)}`}>
                              {(m.status || "scheduled").replace(/_/g, " ")}
                            </span>
                            <span className={`px-2 py-1 rounded ${getRsvpBadge(rsvpStatus)}`}>
                              RSVP: {rsvpStatus}
                            </span>
                            <span className="px-2 py-1 rounded bg-gray-800 text-gray-300">
                              Duration: {m.duration || 60}m
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => updateRsvp(meetingId, "accepted")}
                            className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => updateRsvp(meetingId, "tentative")}
                            className="text-xs bg-yellow-700 hover:bg-yellow-600 px-2 py-1 rounded"
                          >
                            Tentative
                          </button>
                          <button
                            onClick={() => updateRsvp(meetingId, "declined")}
                            className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
                          >
                            Decline
                          </button>
                          {m.meetingLink && (
                            ["scheduled", "in_progress"].includes(m.status) && !m.isExpired ? (
                              <a
                                href={m.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded"
                              >
                                Join Meeting
                              </a>
                            ) : (
                              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                {m.isExpired ? "Meeting expired" : m.status === "cancelled" ? "Meeting cancelled" : "Meeting completed"}
                              </span>
                            )
                          )}
                        </div>

                        {m.recording?.url && (
                          <div className="mt-3 space-y-2">
                            <a
                              href={buildRecordingPlayerUrl(m.recording)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-teal-300 hover:underline"
                            >
                              {m.recording.fileName || "meeting-recording.mp4"}
                            </a>
                            <p className="text-[11px] text-gray-400">Opens in a full-screen player tab.</p>
                          </div>
                        )}

                        {Array.isArray(m.notes) && m.notes.length > 0 && (
                          <div className="mt-3 bg-[#0b1220] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-400 mb-2">Notes</div>
                            {m.notes.slice(-2).map((note, idx) => (
                              <div key={`${meetingId}-note-${idx}`} className="text-xs text-gray-300 mb-1 last:mb-0">
                                {note.content}
                              </div>
                            ))}
                          </div>
                        )}

                        {Array.isArray(m.actionItems) && m.actionItems.length > 0 && (
                          <div className="mt-3 bg-[#0b1220] border border-gray-700 rounded p-3 space-y-3">
                            <div className="text-xs text-gray-400">My Action Items</div>
                            {m.actionItems.map((item) => {
                              const actionId = item._id;
                              const formState = meetingActionSubmissionById[actionId] || { text: "", url: "", file: null };
                              return (
                                <div key={actionId} className="border border-gray-700 rounded p-3 space-y-2">
                                  <div className="text-sm text-gray-200">{item.description}</div>
                                  <div className="text-xs text-gray-400">
                                    Status: {item.status || "pending"}
                                    {item.dueDate ? ` | Due ${new Date(item.dueDate).toLocaleDateString('en-GB')}` : ""}
                                  </div>
                                  {item.resource?.type && item.resource.type !== "none" && (item.resource.url || item.resource.fileUrl) && (
                                    <a href={item.resource.url || item.resource.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-300 hover:underline">
                                      Open Resource: {item.resource.label || item.resource.fileName || item.resource.url || item.resource.fileUrl}
                                    </a>
                                  )}
                                  {item.submission?.status === "submitted" ? (
                                    <div className="text-xs text-green-300 space-y-1">
                                      <div>Submitted at {item.submission.submittedAt ? new Date(item.submission.submittedAt).toLocaleString('en-GB') : "-"}</div>
                                      {item.submission.fileUrl && (
                                        <a href={item.submission.fileUrl} target="_blank" rel="noreferrer" className="underline text-blue-300">
                                          Open submission file
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <textarea
                                        rows={2}
                                        className="w-full p-2 bg-gray-900 rounded text-xs"
                                        placeholder="Submission note"
                                        value={formState.text || ""}
                                        onChange={(e) =>
                                          setMeetingActionSubmissionById(prev => ({
                                            ...prev,
                                            [actionId]: { ...(prev[actionId] || {}), text: e.target.value }
                                          }))
                                        }
                                      />
                                      <input
                                        type="url"
                                        className="w-full p-2 bg-gray-900 rounded text-xs"
                                        placeholder="Submission URL (optional)"
                                        value={formState.url || ""}
                                        onChange={(e) =>
                                          setMeetingActionSubmissionById(prev => ({
                                            ...prev,
                                            [actionId]: { ...(prev[actionId] || {}), url: e.target.value }
                                          }))
                                        }
                                      />
                                      <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
                                        className="w-full p-2 bg-gray-900 rounded text-xs"
                                        onChange={(e) =>
                                          setMeetingActionSubmissionById(prev => ({
                                            ...prev,
                                            [actionId]: { ...(prev[actionId] || {}), file: e.target.files?.[0] || null }
                                          }))
                                        }
                                      />
                                      <button
                                        onClick={() => submitMeetingActionItem(meetingId, actionId)}
                                        disabled={meetingActionSubmittingById[actionId]}
                                        className="text-xs bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded"
                                      >
                                        {meetingActionSubmittingById[actionId] ? "Submitting..." : "Submit Action Item"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}



                        <div className="mt-3">
                          <button
                            onClick={() => toggleMeetingDiscussion(meetingId)}
                            className="text-xs text-blue-400 hover:underline"
                          >
                            {meetingDiscussionOpen[meetingId] ? "Hide Discussion" : "Open Discussion"}
                          </button>
                        </div>
                        {meetingDiscussionOpen[meetingId] && (
                          <div className="mt-3 bg-[#020617] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-400 mb-2">Discussion</div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {discussion.length === 0 && (
                                <div className="text-xs text-gray-500">No messages yet.</div>
                              )}
                              {discussion.map((msg, idx) => (
                                <div key={`${meetingId}-${idx}`} className="text-xs text-gray-300">
                                  <span className="text-gray-400">{msg.senderName || msg.senderRole}:</span> {msg.text}
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <input
                                className="flex-1 p-2 bg-gray-900 rounded text-sm"
                                placeholder="Write a message..."
                                value={meetingNewMessageById[meetingId] || ""}
                                onChange={(e) => setMeetingNewMessageById(prev => ({ ...prev, [meetingId]: e.target.value }))}
                              />
                              <button
                                onClick={() => sendMeetingMessage(meetingId)}
                                disabled={meetingSendLoadingById[meetingId]}
                                className="bg-blue-600 px-3 py-1 rounded text-sm"
                              >
                                {meetingSendLoadingById[meetingId] ? "Sending..." : "Send"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {meetingTab === "past" && (
                <div className="space-y-3">
                  {meetingsPast.length === 0 && (
                    <div className="text-gray-400">No past meetings.</div>
                  )}
                  {meetingsPast.map((m) => {
                    const meetingId = m._id;
                    const discussion = meetingMessagesById[meetingId] || [];
                    const attended = getMeetingAttended(m);
                    return (
                      <div key={meetingId} className="bg-[#1f2933] p-4 rounded border border-gray-700">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{m.title}</h3>
                            <p className="text-sm text-gray-400">
                              {formatDateTime(m.meetingDateTime)} - {m.meetingPlatform || "Meeting"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Organizer: {m.organizer?.name || "Admin"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className={`px-2 py-1 rounded ${getMeetingStatusBadge(m.status)}`}>
                              {(m.status || "completed").replace(/_/g, " ")}
                            </span>
                            <span className={`px-2 py-1 rounded ${attended ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
                              {attended ? "Attended" : "Absent"}
                            </span>
                          </div>
                        </div>

                        
                        {m.recording?.url && (
                          <div className="mb-3 space-y-2">
                            <a
                              href={buildRecordingPlayerUrl(m.recording)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-teal-300 hover:underline"
                            >
                              {m.recording.fileName || "meeting-recording.mp4"}
                            </a>
                            <p className="text-[11px] text-gray-400">Opens in a full-screen player tab.</p>
                          </div>
                        )}

                        {Array.isArray(m.actionItems) && m.actionItems.length > 0 && (
                          <div className="mb-3 bg-[#0b1220] border border-gray-700 rounded p-3 space-y-3">
                            <div className="text-xs text-gray-400">My Action Items</div>
                            {m.actionItems.map((item) => {
                              const actionId = item._id;
                              const formState = meetingActionSubmissionById[actionId] || { text: "", url: "", file: null };
                              return (
                                <div key={actionId} className="border border-gray-700 rounded p-3 space-y-2">
                                  <div className="text-sm text-gray-200">{item.description}</div>
                                  <div className="text-xs text-gray-400">
                                    Status: {item.status || "pending"}
                                    {item.dueDate ? ` | Due ${new Date(item.dueDate).toLocaleDateString('en-GB')}` : ""}
                                  </div>
                                  {item.resource?.type && item.resource.type !== "none" && (item.resource.url || item.resource.fileUrl) && (
                                    <a href={item.resource.url || item.resource.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-300 hover:underline">
                                      Open Resource: {item.resource.label || item.resource.fileName || item.resource.url || item.resource.fileUrl}
                                    </a>
                                  )}
                                  {item.submission?.status === "submitted" ? (
                                    <div className="text-xs text-green-300 space-y-1">
                                      <div>Submitted at {item.submission.submittedAt ? new Date(item.submission.submittedAt).toLocaleString('en-GB') : "-"}</div>
                                      {item.submission.fileUrl && (
                                        <a href={item.submission.fileUrl} target="_blank" rel="noreferrer" className="underline text-blue-300">
                                          Open submission file
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <textarea
                                        rows={2}
                                        className="w-full p-2 bg-gray-900 rounded text-xs"
                                        placeholder="Submission note"
                                        value={formState.text || ""}
                                        onChange={(e) =>
                                          setMeetingActionSubmissionById(prev => ({
                                            ...prev,
                                            [actionId]: { ...(prev[actionId] || {}), text: e.target.value }
                                          }))
                                        }
                                      />
                                      <input
                                        type="url"
                                        className="w-full p-2 bg-gray-900 rounded text-xs"
                                        placeholder="Submission URL (optional)"
                                        value={formState.url || ""}
                                        onChange={(e) =>
                                          setMeetingActionSubmissionById(prev => ({
                                            ...prev,
                                            [actionId]: { ...(prev[actionId] || {}), url: e.target.value }
                                          }))
                                        }
                                      />
                                      <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
                                        className="w-full p-2 bg-gray-900 rounded text-xs"
                                        onChange={(e) =>
                                          setMeetingActionSubmissionById(prev => ({
                                            ...prev,
                                            [actionId]: { ...(prev[actionId] || {}), file: e.target.files?.[0] || null }
                                          }))
                                        }
                                      />
                                      <button
                                        onClick={() => submitMeetingActionItem(meetingId, actionId)}
                                        disabled={meetingActionSubmittingById[actionId]}
                                        className="text-xs bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded"
                                      >
                                        {meetingActionSubmittingById[actionId] ? "Submitting..." : "Submit Action Item"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
<div className="mt-3">
                          <button
                            onClick={() => toggleMeetingDiscussion(meetingId)}
                            className="text-xs text-blue-400 hover:underline"
                          >
                            {meetingDiscussionOpen[meetingId] ? "Hide Discussion" : "Open Discussion"}
                          </button>
                        </div>
                        {meetingDiscussionOpen[meetingId] && (
                          <div className="mt-3 bg-[#020617] border border-gray-700 rounded p-3">
                            <div className="text-xs text-gray-400 mb-2">Discussion</div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {discussion.length === 0 && (
                                <div className="text-xs text-gray-500">No messages yet.</div>
                              )}
                              {discussion.map((msg, idx) => (
                                <div key={`${meetingId}-${idx}`} className="text-xs text-gray-300">
                                  <span className="text-gray-400">{msg.senderName || msg.senderRole}:</span> {msg.text}
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <input
                                className="flex-1 p-2 bg-gray-900 rounded text-sm"
                                placeholder="Write a message..."
                                value={meetingNewMessageById[meetingId] || ""}
                                onChange={(e) => setMeetingNewMessageById(prev => ({ ...prev, [meetingId]: e.target.value }))}
                              />
                              <button
                                onClick={() => sendMeetingMessage(meetingId)}
                                disabled={meetingSendLoadingById[meetingId]}
                                className="bg-blue-600 px-3 py-1 rounded text-sm"
                              >
                                {meetingSendLoadingById[meetingId] ? "Sending..." : "Send"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

                    {/* NOTICES */}
          {screen === SCREENS.NOTICES && (
            <div className="space-y-6">
              <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Notices</h2>
                    <p className="text-sm text-gray-400">Official announcements and employee discussions.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="px-3 py-2 rounded bg-[#0b1220] border border-gray-700">
                      <div className="text-xs text-gray-400">Active</div>
                      <div className="text-lg font-semibold">{noticeStats.active}</div>
                    </div>
                    <div className="px-3 py-2 rounded bg-[#0b1220] border border-gray-700">
                      <div className="text-xs text-gray-400">Unread</div>
                      <div className="text-lg font-semibold">{noticeStats.unread}</div>
                    </div>
                    <div className="px-3 py-2 rounded bg-[#0b1220] border border-gray-700">
                      <div className="text-xs text-gray-400">Urgent</div>
                      <div className="text-lg font-semibold">{noticeStats.urgent}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setNoticeFilter("all")}
                  className={`px-3 py-1 rounded ${noticeFilter === "all" ? "bg-blue-700" : "bg-gray-800 text-gray-300"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setNoticeFilter("unread")}
                  className={`px-3 py-1 rounded ${noticeFilter === "unread" ? "bg-blue-700" : "bg-gray-800 text-gray-300"}`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setNoticeFilter("urgent")}
                  className={`px-3 py-1 rounded ${noticeFilter === "urgent" ? "bg-blue-700" : "bg-gray-800 text-gray-300"}`}
                >
                  Urgent
                </button>                <button
                  onClick={() => setNoticeStatusView("current")}
                  className={`px-3 py-1 rounded ${noticeStatusView === "current" ? "bg-blue-700" : "bg-gray-800 text-gray-300"}`}
                >
                  Current ({noticeStats.active})
                </button>
                <button
                  onClick={() => setNoticeStatusView("expired")}
                  className={`px-3 py-1 rounded ${noticeStatusView === "expired" ? "bg-red-700" : "bg-gray-800 text-gray-300"}`}
                >
                  Expired ({noticeStats.expired})
                </button>
              </div>

              {noticesLoading && <p className="text-gray-400">Loading...</p>}
              {!noticesLoading && filteredNotices.length === 0 && (
                <p className="text-gray-400">No notices available.</p>
              )}

              {!noticesLoading && filteredNotices.map((n) => {
                const noticeId = n._id || n.id;
                const readStatus = getNoticeReadStatus(n);
                return (
                  <div key={noticeId} className="bg-[#1f2933] p-4 rounded border border-gray-700">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs ${getNoticePriorityBadge(n.priority)}`}>
                            {n.priority || "notice"}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-300">
                            {readStatus}
                          </span>
                          {isNoticeExpired(n) && (
                            <span className="px-2 py-1 rounded text-xs bg-red-900/40 text-red-300">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="font-semibold">{n.title}</div>
                        <div className="text-sm text-gray-400 whitespace-pre-wrap">{n.content}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Sent: {formatDateTime(n.sendAt || n.createdAt)}
                        {n.expiresAt && (
                          <div>Expires: {formatDateTime(n.expiresAt)}</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => toggleNotice(noticeId)}
                        className="text-sm text-blue-400 hover:underline"
                      >
                        {noticeExpand[noticeId] ? "Hide Discussion" : "Open Discussion"}
                      </button>
                    </div>

                    {noticeExpand[noticeId] && (
                      <div className="mt-3 bg-[#020617] border border-gray-700 rounded p-3">
                        <div className="text-xs text-gray-400 mb-2">Discussion</div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {(n.discussion || []).length === 0 && (
                            <div className="text-xs text-gray-500">No messages yet.</div>
                          )}
                          {(n.discussion || []).map((msg, idx) => (
                            <div key={idx} className="text-xs text-gray-300">
                              <span className="text-gray-400">{msg.senderName || msg.senderRole}:</span> {msg.text}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            className="flex-1 p-2 bg-gray-900 rounded text-sm"
                            placeholder="Write a comment..."
                            value={noticeMessages[noticeId] || ""}
                            onChange={(e) => setNoticeMessages(prev => ({ ...prev, [noticeId]: e.target.value }))}
                          />
                          <button
                            onClick={() => sendNoticeMessage(noticeId)}
                            className="bg-blue-600 px-3 py-1 rounded text-sm"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* COMMUNITY */}
          {screen === SCREENS.COMMUNITY && (
            <div className="space-y-5">
              <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                <h2 className="text-2xl font-semibold">Community Workspace</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Share updates, collaborate through polls, tag teammates, and engage with team announcements.
                </p>
              </div>
              <CommunityFeed />
            </div>
          )}
          {screen === SCREENS.PERFORMANCE && (
            <div className="space-y-6">
              {(() => {
                const metrics = selfPerformance?.performanceMetrics || {};
                const failures = selfPerformance?.failureBreakdown || {};
                const hasMetrics = Boolean(selfPerformance?.performanceMetrics);
                const performanceBand =
                  (metrics.verificationRate ?? 0) >= 85
                    ? { label: "High", cls: "text-green-300 bg-green-900/30 border-green-700/50" }
                    : (metrics.verificationRate ?? 0) >= 65
                    ? { label: "Stable", cls: "text-blue-300 bg-blue-900/30 border-blue-700/50" }
                    : { label: "Needs Attention", cls: "text-amber-300 bg-amber-900/30 border-amber-700/50" };

                const kpis = [
                  { label: "Verification Rate", value: `${metrics.verificationRate ?? 0}%`, tone: "text-green-300" },
                  { label: "On-Time Rate", value: `${metrics.onTimeRate ?? 0}%`, tone: "text-blue-300" },
                  { label: "Total Tasks", value: `${metrics.totalTasks ?? 0}`, tone: "text-white" },
                  { label: "Extensions Approved", value: `${metrics.extended ?? 0}`, tone: "text-yellow-300" },
                  { label: "Avg Acceptance", value: `${metrics.avgAcceptanceTime ?? 0}h`, tone: "text-white" },
                  { label: "Avg Completion", value: `${metrics.avgCompletionTime ?? 0}h`, tone: "text-white" },
                  { label: "Verified", value: `${metrics.verified ?? 0}`, tone: "text-green-300" },
                  { label: "Failed", value: `${metrics.failed ?? 0}`, tone: "text-red-300" },
                  { label: "Reopened", value: `${metrics.reopenedCount ?? 0}`, tone: "text-orange-300" },
                  { label: "Reopen Rate", value: `${metrics.reopenRate ?? 0}%`, tone: "text-orange-300" }
                ];

                return (
                  <>
                    <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold">Performance Console</h2>
                          <p className="text-sm text-gray-400 mt-1">Enterprise performance view aligned with admin evaluation criteria.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded border ${performanceBand.cls}`}>
                            Performance Band: {performanceBand.label}
                          </span>
                          <div className="flex gap-2">
                            {["all", "month", "quarter", "year"].map((tf) => (
                              <button
                                key={tf}
                                onClick={() => setSelfPerfTimeframe(tf)}
                                className={`px-3 py-1 rounded text-xs ${selfPerfTimeframe === tf ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                              >
                                {tf === "all" ? "All Time" : tf.charAt(0).toUpperCase() + tf.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                          <div className="text-gray-500">Current Window</div>
                          <div className="text-gray-200 font-semibold">{selfPerfTimeframe === "all" ? "All Time" : selfPerfTimeframe}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                          <div className="text-gray-500">Reliability Risk</div>
                          <div className="text-gray-200 font-semibold">{(failures.slaBreaches || 0) > 0 ? "Elevated" : "Controlled"}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                          <div className="text-gray-500">Review Updated</div>
                          <div className="text-gray-200 font-semibold">{performanceReview?.updatedAt ? new Date(performanceReview.updatedAt).toLocaleDateString('en-GB') : "-"}</div>
                        </div>
                        <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                          <div className="text-gray-500">Confidence</div>
                          <div className="text-gray-200 font-semibold">{hasMetrics ? "Data-backed" : "Insufficient data"}</div>
                        </div>
                      </div>
                      {selfPerformance?.fallbackTimeframe && selfPerformance.fallbackTimeframe !== selfPerfTimeframe && (
                        <div className="mt-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
                          Showing all-time analytics because no records were found for the selected "{selfPerfTimeframe}" window.
                        </div>
                      )}
                    </div>

                    <div className="bg-[#1f2933] p-5 rounded-lg border border-amber-700">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="text-lg font-semibold">Manager Review</h3>
                          <p className="text-xs text-gray-400">Confidential review shared by admin. Immutable record retained in history.</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {performanceReview?.updatedAt ? `Updated ${new Date(performanceReview.updatedAt).toLocaleString('en-GB')}` : "Not published yet"}
                        </span>
                      </div>

                      {performanceReview?.hiddenByEmployee && !showHiddenReview ? (
                        <div className="mt-3 p-4 bg-gray-900/60 border border-gray-700 rounded flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-sm text-gray-300">
                            Review hidden from dashboard
                            {performanceReview.hiddenAt ? ` on ${new Date(performanceReview.hiddenAt).toLocaleString('en-GB')}` : ""}.
                          </div>
                          <button
                            onClick={() => setShowHiddenReview(true)}
                            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                          >
                            View Review
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 p-4 bg-gray-900/60 border border-gray-700 rounded">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="text-sm font-semibold text-gray-200">
                                {performanceReview?.title || "No review title yet"}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`px-2 py-1 rounded ${performanceReview?.acknowledgedByEmployee ? "bg-green-900/40 text-green-300" : "bg-yellow-900/40 text-yellow-300"}`}>
                                  {performanceReview?.acknowledgedByEmployee ? "Acknowledged" : "Awaiting acknowledgement"}
                                </span>
                                {performanceReview?.hiddenByEmployee && (
                                  <span className="px-2 py-1 rounded bg-blue-900/40 text-blue-300">Hidden from dashboard</span>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-300 mt-2 whitespace-pre-line">
                              {performanceReview?.note || "Your admin has not published a performance review yet."}
                            </div>
                          </div>

                          {!!performanceReview?.updatedAt && (
                            <div className="mt-3 space-y-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={handleAcknowledgeReview}
                                  disabled={reviewActionLoading.acknowledge || performanceReview?.acknowledgedByEmployee}
                                  className={`px-3 py-1 rounded text-sm ${
                                    reviewActionLoading.acknowledge || performanceReview?.acknowledgedByEmployee
                                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                      : "bg-green-700 hover:bg-green-600 text-white"
                                  }`}
                                >
                                  {performanceReview?.acknowledgedByEmployee ? "Acknowledged" : reviewActionLoading.acknowledge ? "Acknowledging..." : "Acknowledge Review"}
                                </button>
                                <button
                                  onClick={handleHideReview}
                                  disabled={reviewActionLoading.hide || !performanceReview?.acknowledgedByEmployee || performanceReview?.hiddenByEmployee}
                                  className={`px-3 py-1 rounded text-sm ${
                                    reviewActionLoading.hide || !performanceReview?.acknowledgedByEmployee || performanceReview?.hiddenByEmployee
                                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                      : "bg-blue-700 hover:bg-blue-600 text-white"
                                  }`}
                                >
                                  {performanceReview?.hiddenByEmployee ? "Hidden" : reviewActionLoading.hide ? "Hiding..." : "Hide From Dashboard"}
                                </button>
                              </div>

                              <div className="bg-[#0b1220] border border-gray-700 rounded p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs text-gray-400">Employee Comment Thread</div>
                                  <button
                                    onClick={() => setReviewDiscussionOpen((prev) => !prev)}
                                    className="text-xs px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-700"
                                  >
                                    {reviewDiscussionOpen ? "Hide Discussion" : "Open Discussion"}
                                  </button>
                                </div>
                                {reviewDiscussionOpen && (
                                  <>
                                    <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
                                      {(performanceReview?.employeeComments || []).length === 0 ? (
                                        <div className="text-xs text-gray-500">No comments added yet.</div>
                                      ) : (
                                        (performanceReview?.employeeComments || []).map((comment, idx) => (
                                          <div key={`${comment.commentedAt || idx}`} className="bg-gray-900 border border-gray-700 rounded px-2 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="text-[11px] text-gray-400">{comment.commentedByName || "User"}</div>
                                              <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                (comment.commentedByRole || "employee") === "employee"
                                                  ? "bg-blue-900/40 text-blue-300"
                                                  : "bg-green-900/40 text-green-300"
                                              }`}>
                                                {comment.commentedByRole || "employee"}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-300 whitespace-pre-line mt-1">{comment.text}</div>
                                            <div className="text-[11px] text-gray-500 mt-1">
                                              {comment.commentedAt ? new Date(comment.commentedAt).toLocaleString('en-GB') : "-"}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                      <input
                                        type="text"
                                        value={reviewCommentDraft}
                                        onChange={(e) => setReviewCommentDraft(e.target.value)}
                                        placeholder="Add optional comment for manager review..."
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                                      />
                                      <button
                                        onClick={handleCommentOnReview}
                                        disabled={reviewActionLoading.comment || !reviewCommentDraft.trim()}
                                        className={`px-3 py-2 rounded text-sm ${
                                          reviewActionLoading.comment || !reviewCommentDraft.trim()
                                            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                            : "bg-indigo-700 hover:bg-indigo-600 text-white"
                                        }`}
                                      >
                                        {reviewActionLoading.comment ? "Posting..." : "Post"}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>

                              {reviewActionError && (
                                <div className="text-xs text-red-300 bg-red-900/20 border border-red-800 rounded px-3 py-2">
                                  {reviewActionError}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                      <h3 className="text-lg font-semibold mb-4">KPI Scoreboard</h3>
                      {selfPerfLoading ? (
                        <div className="text-sm text-gray-400">Loading performance metrics...</div>
                      ) : hasMetrics ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                          {kpis.map((item) => (
                            <div key={item.label} className="bg-[#0b1220] p-4 rounded border border-gray-700">
                              <div className="text-sm text-gray-400">{item.label}</div>
                              <div className={`text-2xl font-bold mt-1 ${item.tone}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">No performance data available for the selected timeframe.</div>
                      )}
                    </div>

                    <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                      <h3 className="text-lg font-semibold mb-4">Reliability and Risk</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-[#0b1220] p-4 rounded border border-gray-700">
                          <div className="text-sm text-gray-400">Late Submissions</div>
                          <div className="text-2xl font-bold text-red-300">{failures.lateSubmissions || 0}</div>
                        </div>
                        <div className="bg-[#0b1220] p-4 rounded border border-gray-700">
                          <div className="text-sm text-gray-400">No Response</div>
                          <div className="text-2xl font-bold text-yellow-300">{failures.noResponse || 0}</div>
                        </div>
                        <div className="bg-[#0b1220] p-4 rounded border border-gray-700">
                          <div className="text-sm text-gray-400">Reopens</div>
                          <div className="text-2xl font-bold text-orange-300">{failures.reopens || 0}</div>
                        </div>
                        <div className="bg-[#0b1220] p-4 rounded border border-gray-700">
                          <div className="text-sm text-gray-400">SLA Breaches</div>
                          <div className="text-2xl font-bold text-red-400">{failures.slaBreaches || 0}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Task Analytics Trail</h3>
                        <span className="text-xs text-gray-500">
                          {(selfPerformance?.taskHistory || []).length} records
                        </span>
                      </div>
                      {(selfPerformance?.taskHistory || []).length === 0 ? (
                        <div className="text-sm text-gray-400">No task analytics records available.</div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {selfPerformance.taskHistory.slice(0, 20).map((t) => (
                            <div key={t.id} className="bg-[#0b1220] border border-gray-700 rounded p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-white truncate">{t.title}</div>
                                <span className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-300 uppercase">
                                  {(t.status || "unknown").replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                Created: {t.createdAt ? formatDateTime(t.createdAt) : "-"} · Due: {t.dueDate ? formatDateTime(t.dueDate) : "-"}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                Completed: {t.completedAt ? formatDateTime(t.completedAt) : "-"} · Quality: {t.qualityScore ?? "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Review History</h3>
                        <span className="text-xs text-gray-500">
                          {(selfPerformance?.employee?.performanceReviewHistory || []).length} published
                        </span>
                      </div>
                      {(selfPerformance?.employee?.performanceReviewHistory || []).length === 0 ? (
                        <div className="text-sm text-gray-400">No previous reviews published yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {selfPerformance.employee.performanceReviewHistory.slice(0, 5).map((r, idx) => {
                            const historyKey = String(r._id || r.publishedAt || idx);
                            const isOpen = Boolean(reviewHistoryOpenMap[historyKey]);
                            const comments = Array.isArray(r.employeeComments) ? r.employeeComments : [];
                            const isLatestReview = idx === 0;
                            return (
                            <div key={`${r.publishedAt || idx}`} className="bg-[#0b1220] border border-gray-700 rounded p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-white">{r.title || "Performance Review"}</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {r.publishedAt ? formatDateTime(r.publishedAt) : "-"}
                                  </span>
                                  <button
                                    onClick={() => setReviewHistoryOpenMap((prev) => ({ ...prev, [historyKey]: !prev[historyKey] }))}
                                    className="text-xs px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-700"
                                  >
                                    {isOpen ? "Collapse" : "Open"}
                                  </button>
                                </div>
                              </div>
                              {isOpen ? (
                                <div className="mt-2 space-y-3">
                                  <div className="text-xs text-gray-400 whitespace-pre-line">
                                    {r.note || "No note"}
                                  </div>
                                  <div className="bg-[#020617] border border-gray-700 rounded p-3">
                                    <div className="text-xs text-gray-400">Employee Comment Thread</div>
                                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                      {comments.length === 0 ? (
                                        <div className="text-xs text-gray-500">No comments yet.</div>
                                      ) : (
                                        comments.map((comment, cIdx) => (
                                          <div key={`${comment.commentedAt || cIdx}`} className="bg-gray-900 border border-gray-700 rounded px-2 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="text-[11px] text-gray-400">{comment.commentedByName || "User"}</div>
                                              <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                (comment.commentedByRole || "employee") === "employee"
                                                  ? "bg-blue-900/40 text-blue-300"
                                                  : "bg-green-900/40 text-green-300"
                                              }`}>
                                                {comment.commentedByRole || "employee"}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-300 whitespace-pre-line mt-1">{comment.text || "-"}</div>
                                            <div className="text-[11px] text-gray-500 mt-1">
                                              {comment.commentedAt ? new Date(comment.commentedAt).toLocaleString('en-GB') : "-"}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                    {isLatestReview && (
                                      <div className="mt-3 flex gap-2">
                                        <input
                                          type="text"
                                          value={reviewCommentDraft}
                                          onChange={(e) => setReviewCommentDraft(e.target.value)}
                                          placeholder="Reply to manager on this review..."
                                          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                                        />
                                        <button
                                          onClick={handleCommentOnReview}
                                          disabled={reviewActionLoading.comment || !reviewCommentDraft.trim()}
                                          className={`px-3 py-2 rounded text-sm ${
                                            reviewActionLoading.comment || !reviewCommentDraft.trim()
                                              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                              : "bg-indigo-700 hover:bg-indigo-600 text-white"
                                          }`}
                                        >
                                          {reviewActionLoading.comment ? "Posting..." : "Post"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-xs text-gray-500">
                                  {String(r.note || "No note").slice(0, 100)}
                                  {String(r.note || "").length > 100 ? "..." : ""}
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                <span className={`px-2 py-1 rounded ${r.acknowledgedByEmployee ? "bg-green-900/40 text-green-300" : "bg-yellow-900/40 text-yellow-300"}`}>
                                  {r.acknowledgedByEmployee ? "Acknowledged" : "Not acknowledged"}
                                </span>
                                <span className={`px-2 py-1 rounded ${r.hiddenByEmployee ? "bg-blue-900/40 text-blue-300" : "bg-gray-800 text-gray-300"}`}>
                                  {r.hiddenByEmployee ? "Hidden on dashboard" : "Visible on dashboard"}
                                </span>
                                <span className="px-2 py-1 rounded bg-gray-800 text-gray-300">
                                  Comments: {(r.employeeComments || []).length}
                                </span>
                              </div>
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </main>

        <footer className="border-t border-gray-800 bg-[#0b1220] px-8 py-8 text-sm text-gray-400">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            <div>
              <div className="text-xs text-gray-500 mb-2">ONLINE SYSTEM</div>
              <div className="space-y-1 text-sm text-gray-300">
                <button onClick={() => setScreen(SCREENS.TASKS)} className="hover:text-white">My Tasks</button>
                <button onClick={() => setScreen(SCREENS.DETAILS)} className="hover:text-white">Task Details</button>
                <button onClick={() => setScreen(SCREENS.REQUESTS)} className="hover:text-white">Requests</button>
                <button onClick={() => setScreen(SCREENS.MEETINGS)} className="hover:text-white">Meetings</button>
                <button onClick={() => setScreen(SCREENS.NOTICES)} className="hover:text-white">Notices</button>
                <button onClick={() => setScreen(SCREENS.COMMUNITY)} className="hover:text-white">Community</button>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">USEFUL LINKS</div>
              <div className="space-y-1 text-sm text-gray-300">
                <button onClick={() => { setScreen(SCREENS.TASKS); setActiveTab("active"); }} className="hover:text-white">Active Tasks</button>
                <button onClick={() => { setScreen(SCREENS.TASKS); setActiveTab("assigned"); }} className="hover:text-white">Assigned Tasks</button>
                <button onClick={() => { setScreen(SCREENS.TASKS); setActiveTab("overdue"); }} className="hover:text-white">Overdue Tasks</button>
                <button onClick={() => { setScreen(SCREENS.TASKS); setActiveTab("completed"); }} className="hover:text-white">Completed Tasks</button>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">CUSTOMER POLICIES</div>
              <div className="space-y-1 text-sm text-gray-300">
                <div>Security & Privacy</div>
                <div>SLA & Compliance</div>
                <div>Data Retention</div>
                <div>Role Permissions</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">KEEP IN TOUCH</div>
              <div className="space-y-1 text-sm text-gray-300">
                <div>Support: support@ems.com</div>
                <div>System Owner: Jyoti</div>
                <div>Status: Enterprise Edition</div>
              </div>
              <div className="text-xs text-gray-500 mt-4">EXPERIENCE EMS APP ON MOBILE</div>
              <div className="text-sm text-gray-300 mt-1">Mobile access coming soon</div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto mt-8 border-t border-gray-800 pt-6 space-y-4">
            <div className="text-xs text-gray-500">
              100% original audit trail guarantee for all task changes and approvals in EMS.
            </div>
            <div className="text-xs text-gray-500">
              Recoverable history within 14 days for critical task changes.
            </div>
            <div className="text-xs text-gray-500">
              POPULAR SEARCHES: Task Accepted Â· Task Declined Â· Extension Requested Â· Modification Approved Â· Reopen SLA Â·
              Activity Timeline Â· Work Submission Â· Employee Insights Â· Notice Comment Â· Meeting Scheduled
            </div>
            <div className="text-xs text-gray-500">
              In case of any concern, Contact Us.
            </div>
            <div className="text-xs text-gray-500">
              Â© {new Date().getFullYear()} EMS Console. All rights reserved. Built by Jyoti.
            </div>
          </div>
        </footer>
      </div>
    </div>
    <SmartNotifications role="employee" items={smartNotifications} sessionKey={user?.token || authToken || ""} />
    <ChatbotWidget
      title="Employee Help Bot"
      context={{
        role: "employee",
        screen,
        stats: {
          assigned: dashboardStats.assignedTasks.length,
          overdue: dashboardStats.overdueTasks.length,
          pendingMods: dashboardStats.pendingModifications,
          pendingExt: dashboardStats.pendingExtensions,
          pendingReopens: dashboardStats.pendingReopens
        }
      }}
    />
    </>
  );
};

/* SHARED NAV */
const Nav = ({ children, onClick, disabled, active }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-left px-3 py-2 rounded ${
      disabled
        ? "opacity-40 cursor-not-allowed"
        : active
        ? "bg-blue-600 text-white shadow-lg"
        : "hover:bg-gray-800 text-gray-300 hover:text-white"
    }`}
  >
    {children}
  </button>
);

export default EmployeeDashboard;
























































