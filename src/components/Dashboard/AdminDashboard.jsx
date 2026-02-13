import React, { useEffect, useState, useContext, useMemo, useRef } from "react";
import { AuthContext } from "../../context/AuthProvider";
import { useLocation, useNavigate } from "react-router-dom";
import TaskReviewActions from "../Admin/TaskReviewActions";
import EmployeeManagement from "../Admin/EmployeeManagement";
import EmployeeInsights from "../Admin/EmployeeInsights/EmployeeInsights";
import TaskOversightPanel from "../Admin/TaskOversightPanel";
import TaskManagementPanel from "../Admin/TaskManagementPanel";
import TaskDiscussion from "../Shared/TaskDiscussion";
import ModificationRequestsPanel from "../Admin/ModificationRequestsPanel";
import MeetingManager from "../meetings/MeetingManager";
import AdminNoticePanel from "../Admin/AdminNoticePanel";
import FailureAnalytics from "../Admin/FailureAnalytics";
import PerformanceSnapshot from "../Admin/PerformanceSnapshot";
import CommunityFeed from "../Community/CommunityFeed";
import ChatbotWidget from "../Shared/ChatbotWidget";
import SmartNotifications from "../Shared/SmartNotifications";
import { fetchWithRetry } from "../../api/httpClient";
import { API_BASE_URL } from "../../config/api";

const toAbsoluteAssetUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
};

const AdminDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("overview");
  const [activeTab, setActiveTab] = useState("create");
  const [systemTab, setSystemTab] = useState("overview");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
  const [employeeDefaultTab, setEmployeeDefaultTab] = useState("register");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSourceFilter, setAuditSourceFilter] = useState("all");
  const [auditSeverityFilter, setAuditSeverityFilter] = useState("all");
  const [selectedAuditEmployee, setSelectedAuditEmployee] = useState("all");
  const [selectedAuditTask, setSelectedAuditTask] = useState("all");
  const [auditWorkflowFilter, setAuditWorkflowFilter] = useState("all");
  const [notificationPolicy, setNotificationPolicy] = useState({
    dedupeWindowMinutes: 120,
    maxImportantToasts: 3,
    eveningQuietStart: 22,
    morningQuietEnd: 7,
    criticalOverdueHours: 48,
    importantSnoozeMinutes: 30,
    escalationAckRequired: true
  });
  const [confirmationPolicy, setConfirmationPolicy] = useState({
    lowRisk: "soft_confirm",
    mediumRisk: "confirm_with_context",
    highRisk: "reason_required"
  });
  const [escalationPolicy, setEscalationPolicy] = useState({
    warnHours: 24,
    criticalHours: 48,
    hardEscalationHours: 72,
    ownerRole: "task_admin"
  });
  const [adminCapabilityData, setAdminCapabilityData] = useState({
    role: user?.role || "admin",
    capabilities: [],
    availableCapabilities: []
  });
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState("");

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [noticesAll, setNoticesAll] = useState([]);
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const [notificationsClearedAt, setNotificationsClearedAt] = useState(null);
  const [showOnlyNewNotifications, setShowOnlyNewNotifications] = useState(false);
  const [notificationSourceFilter, setNotificationSourceFilter] = useState("all");
  const [notificationActionFilter, setNotificationActionFilter] = useState("all");
  const [notificationSearch, setNotificationSearch] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [performanceData, setPerformanceData] = useState(null);
  const [failureIntelligence, setFailureIntelligence] = useState(null);
  
  //  SPLIT LOADING STATES
  const [loadingCore, setLoadingCore] = useState(true); // For tasks + employees + meetings
  const [loadingAnalytics, setLoadingAnalytics] = useState(false); // For analytics data
  
  const [error, setError] = useState("");
  const [statistics, setStatistics] = useState(null);
  const [discussionOpen, setDiscussionOpen] = useState({});
  const [extendForms, setExtendForms] = useState({});
  const [reassignForms, setReassignForms] = useState({});
  const [failForms, setFailForms] = useState({});
  const [reviewMetricsOpen, setReviewMetricsOpen] = useState({});
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewSort, setReviewSort] = useState("recent");
  const [reviewScope, setReviewScope] = useState("pending");
  const [reviewLane, setReviewLane] = useState("all");
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewQueueSummary, setReviewQueueSummary] = useState({
    total: 0,
    needsReview: 0,
    atRisk: 0,
    reopened: 0,
    closed: 0
  });
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [reviewQueuePage, setReviewQueuePage] = useState(1);
  const [reviewQueuePagination, setReviewQueuePagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [requestSearch, setRequestSearch] = useState("");
  const [extensionStatusFilter, setExtensionStatusFilter] = useState("pending");
  const [extensionSort, setExtensionSort] = useState("recent");
  const [extensionReviewNotes, setExtensionReviewNotes] = useState({});
  const [extensionApprovedDates, setExtensionApprovedDates] = useState({});
  const [extensionActionLoading, setExtensionActionLoading] = useState({});
  const [reopenSearch, setReopenSearch] = useState("");
  const [reopenStatusFilter, setReopenStatusFilter] = useState("pending");
  const [reopenSort, setReopenSort] = useState("recent");
  const [expiredModSearch, setExpiredModSearch] = useState("");
  const [expiredModTypeFilter, setExpiredModTypeFilter] = useState("all");
  const [expiredModSort, setExpiredModSort] = useState("recent");
  const [pendingRequestsCenter, setPendingRequestsCenter] = useState([]);
  const [pendingRequestsLoading, setPendingRequestsLoading] = useState(false);
  const [pendingRequestsSummary, setPendingRequestsSummary] = useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0
  });
  const [pendingRequestsPage, setPendingRequestsPage] = useState(1);
  const [pendingRequestsTotalPages, setPendingRequestsTotalPages] = useState(1);
  const [overviewFocusTaskId, setOverviewFocusTaskId] = useState(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditEventsRemote, setAuditEventsRemote] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [syncMeta, setSyncMeta] = useState({
    tasks: { lastOk: 0, status: "idle" },
    employees: { lastOk: 0, status: "idle" },
    meetings: { lastOk: 0, status: "idle" },
    notices: { lastOk: 0, status: "idle" },
    notifications: { lastOk: 0, status: "idle" }
  });
  const [lastEscalationAckAt, setLastEscalationAckAt] = useState(null);
  const [liveCounters, setLiveCounters] = useState(null);
  const [liveConnectionState, setLiveConnectionState] = useState("idle");
  const auditListRef = useRef(null);
  const [auditScrollTop, setAuditScrollTop] = useState(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignedTo: "",
    category: "",
    priority: "medium"
  });

  //  PREVENT DUPLICATE FETCHES
  const hasFetchedCoreRef = useRef(false);
  const hasFetchedAnalyticsRef = useRef(false);

  useEffect(() => {
    if (!user?.token) return;
    hasFetchedCoreRef.current = false;
    hasFetchedAnalyticsRef.current = false;
    setTasks([]);
    setEmployees([]);
    setMeetings([]);
    setNoticesAll([]);
    setInAppNotifications([]);
    setStatistics(null);
    setFailureIntelligence(null);
    setPerformanceData(null);
    setError("");
    setLoadingCore(true);
  }, [user?.id, user?.token]);

  
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
// Handle returning from task details with state
  useEffect(() => {
    console.log(" AdminDashboard mounted");
    console.log(" User state:", user ? "exists" : "null");
    console.log(" Location state:", location.state);
    
    if (location.state?.activeSection) {
      console.log(" Setting active section from location state:", location.state.activeSection);
      setActiveSectionGuarded(location.state.activeSection);
    }
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state?.activeSection, location.state?.activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const exec = params.get("exec");
    if (!exec) return;
    const section = params.get("section") || "task";
    const tab = params.get("tab") || "manage";
    if (canAccessSection(section)) {
      setActiveSection(section);
      setActiveTab(tab);
    }
  }, [location.search]);

  const openEditFromModRequest = location.state?.openEditFromModRequest;


  useEffect(() => {
    if (activeSection === "pendingRequests" && activeTab === "extensions") {
      if (extensionStatusFilter === "all") {
        setExtensionStatusFilter("pending");
      }
    }
  }, [activeSection, activeTab, extensionStatusFilter]);

  useEffect(() => {
    if (activeSection !== "pendingRequests") return;
    setPendingRequestsPage(1);
  }, [requestSearch, activeTab, activeSection]);

  useEffect(() => {
    if (activeSection !== "review") return;
    setReviewQueuePage(1);
  }, [activeSection, reviewSearch, reviewSort, reviewScope, reviewLane]);

  useEffect(() => {
    const fetchPendingRequestsCenter = async () => {
      if (!user?.token || activeSection !== "pendingRequests") return;
      try {
        setPendingRequestsLoading(true);
        const params = new URLSearchParams({
          page: String(pendingRequestsPage),
          limit: "50",
          sort: "recent",
          status: "all",
          origin: "all"
        });
        if (requestSearch.trim()) {
          params.set("search", requestSearch.trim());
        }

        const res = await fetch(`${API_BASE_URL}/api/tasks/modification-requests/pending?${params.toString()}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        if (data.success) {
          setPendingRequestsCenter(data.pendingRequests || []);
          setPendingRequestsSummary(data.summary || {
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            totalCount: 0
          });
          setPendingRequestsTotalPages(data.pagination?.totalPages || 1);
        } else {
          setPendingRequestsCenter([]);
          setPendingRequestsSummary({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 });
          setPendingRequestsTotalPages(1);
        }
      } catch (err) {
        console.error("Failed to load pending requests center:", err);
        setPendingRequestsCenter([]);
        setPendingRequestsSummary({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 });
        setPendingRequestsTotalPages(1);
      } finally {
        setPendingRequestsLoading(false);
      }
    };

    fetchPendingRequestsCenter();
  }, [activeSection, user, pendingRequestsPage, requestSearch]);

  useEffect(() => {
    if (activeSection !== "task" || !["active", "overdue"].includes(activeTab) || !overviewFocusTaskId) return;
    const timer = setTimeout(() => {
      const row = document.getElementById(`task-row-${overviewFocusTaskId}`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [activeSection, activeTab, overviewFocusTaskId]);

  // ==================== DATA FETCHING ====================
  const markSyncStatus = (key, status) => {
    setSyncMeta((prev) => ({
      ...prev,
      [key]: {
        lastOk: status === "ok" ? Date.now() : prev[key]?.lastOk || 0,
        status
      }
    }));
  };

  const fetchTasks = async () => {
    try {
      markSyncStatus("tasks", "syncing");
      console.log(" Fetching tasks...");
      const res = await fetchWithRetry(`${API_BASE_URL}/api/tasks`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        console.log(" Tasks fetched:", data.tasks?.length || 0);
        setTasks(data.tasks || []);
        markSyncStatus("tasks", "ok");
      } else {
        console.log(" Tasks fetch unsuccessful");
        setTasks([]);
        markSyncStatus("tasks", "error");
      }
    } catch (err) {
      console.error(" Failed to fetch tasks:", err);
      setTasks([]);
      markSyncStatus("tasks", "error");
    }
  };

  const fetchEmployees = async () => {
    try {
      markSyncStatus("employees", "syncing");
      console.log(" Fetching employees...");
      const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/employees`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      console.log(" Employees fetched:", data.employees?.length || 0);
      setEmployees(data.employees || []);
      markSyncStatus("employees", "ok");
    } catch (err) {
      console.error(" Failed to fetch employees:", err);
      setEmployees([]);
      markSyncStatus("employees", "error");
    }
  };

  const fetchMeetings = async () => {
    try {
      markSyncStatus("meetings", "syncing");
      console.log(" Fetching meetings...");
      const [upcomingRes, pastRes] = await Promise.all([
        fetchWithRetry(`${API_BASE_URL}/api/meetings/upcoming`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetchWithRetry(`${API_BASE_URL}/api/meetings/past`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${user.token}` },
        }),
      ]);

      const upcomingData = await upcomingRes.json();
      const pastData = await pastRes.json();

      if (upcomingData.success || pastData.success) {
        const merged = [
          ...(upcomingData.meetings || []),
          ...(pastData.meetings || [])
        ];

        const byId = {};
        merged.forEach((m) => {
          if (m?._id) byId[m._id] = m;
        });

        const now = Date.now();
        const normalized = Object.values(byId).map((m) => {
          const ts = new Date(m.meetingDateTime).getTime();
          const status = m.status || "scheduled";
          const isUpcoming = status === "in_progress" || (status === "scheduled" && ts >= now);
          const isExpired = status === "scheduled" && ts < now;
          return {
            ...m,
            isUpcoming,
            isExpired
          };
        });

        console.log(" Meetings fetched:", normalized.length);
        setMeetings(normalized);
        markSyncStatus("meetings", "ok");
      } else {
        console.log(" Meetings fetch unsuccessful");
        setMeetings([]);
        markSyncStatus("meetings", "error");
      }
    } catch (err) {
      console.error(" Failed to fetch meetings:", err);
      setMeetings([]);
      markSyncStatus("meetings", "error");
    }
  };

  const fetchFailureIntelligence = async () => {
    try {
      console.log(" Fetching failure intelligence...");
      const res = await fetch(`${API_BASE_URL}/api/tasks/intelligence/failures?timeframe=30`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        console.log(" Failure intelligence fetched");
        setFailureIntelligence(data.patterns);
      }
    } catch (err) {
      console.error(" Failed to fetch failure intelligence:", err);
    }
  };

  // Fetch Performance Data for Specific Employee
  const fetchPerformanceData = async (employeeId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/performance/${employeeId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPerformanceData(data);
      }
    } catch (err) {
      console.error("Failed to fetch performance data:", err);
    }
  };

  // Fetch Statistics Overview
  const fetchStatistics = async () => {
    try {
      console.log(" Fetching statistics...");
      const res = await fetch(`${API_BASE_URL}/api/tasks/statistics/overview`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        console.log(" Statistics fetched");
        setStatistics(data.statistics);
      }
    } catch (err) {
      console.error(" Failed to fetch statistics:", err);
    }
  };

  //  FIXED: CORE DATA FETCH (Tasks, Employees, Meetings) - Runs ONCE
  useEffect(() => {
    const initCoreData = async () => {
      if (hasFetchedCoreRef.current || !user?.token) {
        console.log(" Skipping core data fetch - already loaded or no user");
        setLoadingCore(false);
        return;
      }
      
      console.log(" Fetching CORE data (tasks, employees, meetings)...");
      hasFetchedCoreRef.current = true;
      
      try {
        //  Fetch core data in parallel
        await Promise.all([
          fetchTasks(), 
          fetchEmployees(), 
          fetchMeetings(),
          fetchNoticesAll(),
          fetchInAppNotifications(),
          fetchAdminCapabilities()
        ]);
        console.log(" CORE data loaded - dashboard can render!");
      } catch (err) {
        console.error(" Error in core data fetch:", err);
      } finally {
        setLoadingCore(false);
      }
    };

    initCoreData();
  }, [user]);

  useEffect(() => {
    const stored = localStorage.getItem("adminNotificationsClearedAt");
    if (stored) {
      setNotificationsClearedAt(stored);
      setShowOnlyNewNotifications(true);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("ems_admin_notification_policy");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setNotificationPolicy((prev) => ({
        ...prev,
        ...parsed
      }));
    } catch (_err) {
      // ignore malformed saved policy
    }
  }, []);

  useEffect(() => {
    const storedAck = localStorage.getItem("ems_admin_escalation_ack_at");
    if (storedAck) setLastEscalationAckAt(storedAck);
  }, []);

  useEffect(() => {
    if (notificationsClearedAt) {
      localStorage.setItem("adminNotificationsClearedAt", notificationsClearedAt);
    }
  }, [notificationsClearedAt]);

  useEffect(() => {
    localStorage.setItem("ems_admin_notification_policy", JSON.stringify(notificationPolicy));
  }, [notificationPolicy]);

  useEffect(() => {
    if (!lastEscalationAckAt) return;
    localStorage.setItem("ems_admin_escalation_ack_at", lastEscalationAckAt);
  }, [lastEscalationAckAt]);

  useEffect(() => {
    if (!user?.token) return;
    const intervalId = setInterval(() => {
      fetchTasks();
      fetchMeetings();
      fetchNoticesAll();
      fetchInAppNotifications();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [user?.token]);

  useEffect(() => {
    const fetchReviewQueue = async () => {
      if (!user?.token || activeSection !== "review") return;
      const buildLocalFallbackQueue = () => {
        const local = (reviewScope === "all"
          ? tasks.filter((t) => ["completed", "verified", "failed", "reopened"].includes(t.status) && !t.isArchived)
          : tasks.filter((t) => ["completed", "reopened"].includes(t.status) && !t.isArchived)
        );
        const total = local.length;
        const summary = {
          total,
          needsReview: local.filter((t) => t.status === "completed").length,
          atRisk: local.filter((t) => t.isOverdue).length,
          reopened: local.filter((t) => t.status === "reopened").length,
          closed: local.filter((t) => ["verified", "failed"].includes(t.status)).length
        };
        setReviewQueue(local);
        setReviewQueueSummary(summary);
        setReviewQueuePagination({ page: 1, limit: 20, total, totalPages: 1 });
      };
      try {
        setReviewQueueLoading(true);
        const params = new URLSearchParams({
          lane: reviewLane,
          search: reviewSearch.trim(),
          sort: reviewSort,
          scope: reviewScope,
          page: String(reviewQueuePage),
          limit: "20"
        });
        const res = await fetchWithRetry(`${API_BASE_URL}/api/tasks/queue/review?${params.toString()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const data = await res.json();
        if (data.success) {
          setReviewQueue(data.items || data.data?.items || []);
          setReviewQueueSummary(data.summary || data.meta?.summary || {
            total: 0,
            needsReview: 0,
            atRisk: 0,
            reopened: 0,
            closed: 0
          });
          setReviewQueuePagination(data.pagination || data.meta?.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1
          });
        } else {
          buildLocalFallbackQueue();
        }
      } catch (err) {
        console.error("Failed to load review queue:", err);
        buildLocalFallbackQueue();
      } finally {
        setReviewQueueLoading(false);
      }
    };

    fetchReviewQueue();
  }, [activeSection, user?.token, reviewLane, reviewScope, reviewSort, reviewSearch, reviewQueuePage]);

  useEffect(() => {
    if (!user?.token) return;

    let eventSource = null;
    let snapshotInterval = null;
    let closed = false;

    const fetchLiveSnapshot = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/live-counters`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setLiveCounters(data.counters || null);
          setLiveConnectionState((prev) => (prev === "live" ? prev : "delayed"));
        }
      } catch (_err) {
        // fallback keeps silent; state is handled by SSE lifecycle
      }
    };

    try {
      const url = `${API_BASE_URL}/api/admin/live-counters/stream?token=${encodeURIComponent(user.token)}`;
      eventSource = new EventSource(url);
      setLiveConnectionState("connecting");

      eventSource.addEventListener("counters", (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");
          setLiveCounters(payload);
          setLiveConnectionState("live");
        } catch (_err) {
          setLiveConnectionState("delayed");
        }
      });

      eventSource.addEventListener("ping", () => {
        setLiveConnectionState((prev) => (prev === "live" ? prev : "delayed"));
      });

      eventSource.onerror = () => {
        if (closed) return;
        setLiveConnectionState("reconnecting");
      };
    } catch (_err) {
      setLiveConnectionState("reconnecting");
    }

    fetchLiveSnapshot();
    snapshotInterval = setInterval(fetchLiveSnapshot, 25000);

    return () => {
      closed = true;
      if (snapshotInterval) clearInterval(snapshotInterval);
      if (eventSource) eventSource.close();
      setLiveConnectionState("idle");
    };
  }, [user?.token]);

  useEffect(() => {
    setNotificationActionFilter("all");
  }, [notificationSourceFilter]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditSourceFilter, auditSeverityFilter, auditSearch, auditPageSize, selectedAuditEmployee, selectedAuditTask, auditWorkflowFilter]);

  useEffect(() => {
    setSelectedAuditTask("all");
  }, [selectedAuditEmployee]);

  useEffect(() => {
    const fetchAuditLog = async () => {
      const effectiveCapabilities = adminCapabilityData.role === "superadmin"
        ? ["view_audit_log"]
        : (adminCapabilityData.capabilities || []);
      if (
        !user?.token ||
        activeSection !== "system" ||
        systemTab !== "audit" ||
        !effectiveCapabilities.includes("view_audit_log")
      ) {
        return;
      }
      try {
        setAuditLoading(true);
        setAuditError("");
        const params = new URLSearchParams({
          source: auditSourceFilter,
          severity: auditSeverityFilter,
          workflow: auditWorkflowFilter,
          employeeId: selectedAuditEmployee,
          taskId: selectedAuditTask,
          search: auditSearch.trim(),
          limit: "2000"
        });
        const res = await fetch(`${API_BASE_URL}/api/admin/audit-log?${params.toString()}`, {
          headers: { Authorization: `Bearer ${user.token}` },
          cache: "no-store"
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load audit log");
        }
        setAuditEventsRemote(data.events || []);
      } catch (err) {
        setAuditError(err.message || "Failed to load audit log");
        setAuditEventsRemote(null);
      } finally {
        setAuditLoading(false);
      }
    };
    fetchAuditLog();
  }, [
    user?.token,
    activeSection,
    systemTab,
    auditSourceFilter,
    auditSeverityFilter,
    auditWorkflowFilter,
    selectedAuditEmployee,
    selectedAuditTask,
    auditSearch,
    adminCapabilityData.capabilities,
    adminCapabilityData.role
  ]);

  //  ANALYTICS DATA - Only fetches when analytics section is active
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (activeSection !== "analytics" || !user?.token || hasFetchedAnalyticsRef.current) {
        return;
      }
      
      console.log(" Fetching ANALYTICS data (failures, statistics)...");
      hasFetchedAnalyticsRef.current = true;
      setLoadingAnalytics(true);
      
      try {
        await Promise.all([
          fetchFailureIntelligence(),
          fetchStatistics()
        ]);
        console.log(" ANALYTICS data loaded!");
      } catch (err) {
        console.error(" Error fetching analytics:", err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalyticsData();
  }, [activeSection, user]);

  // Reset analytics fetch flag when leaving analytics section
  useEffect(() => {
    if (activeSection !== "analytics") {
      hasFetchedAnalyticsRef.current = false;
    }
  }, [activeSection]);

  useEffect(() => {
    const onKeydown = (e) => {
      if (!e.altKey) return;
      const key = String(e.key || "").toLowerCase();
      if (key === "1") setActiveSectionGuarded("overview");
      if (key === "2") setActiveSectionGuarded("task");
      if (key === "3") setActiveSectionGuarded("review");
      if (key === "4") setActiveSectionGuarded("pendingRequests");
      if (key === "5") setActiveSectionGuarded("analytics");
      if (key === "6") setActiveSectionGuarded("system");
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  const hasCapability = (capability) => {
    if (!capability) return true;
    const role = adminCapabilityData.role || user?.role;
    if (role === "superadmin") return true;
    return (adminCapabilityData.capabilities || []).includes(capability);
  };

  const sectionCapabilityMap = {
    overview: null,
    employee: "manage_employees",
    employeeInsights: "view_employee_insights",
    task: "manage_tasks",
    oversight: "manage_tasks",
    review: "manage_reviews",
    pendingRequests: "manage_requests",
    meetings: "manage_meetings",
    community: null,
    notices: "manage_notices",
    analytics: "view_analytics",
    notifications: null,
    system: null
  };

  const canAccessSection = (sectionKey) => {
    const requiredCapability = sectionCapabilityMap[sectionKey] || null;
    return hasCapability(requiredCapability);
  };

  const setActiveSectionGuarded = (sectionKey, fallback = "overview") => {
    if (canAccessSection(sectionKey)) {
      setActiveSection(sectionKey);
      return true;
    }
    if (fallback && canAccessSection(fallback)) setActiveSection(fallback);
    return false;
  };

  useEffect(() => {
    if (activeSection !== "system" || !user?.token) return;
    fetchAdminCapabilities();
  }, [activeSection, user?.token]);

  useEffect(() => {
    if (!activeSection) return;
    if (!canAccessSection(activeSection)) {
      setActiveSection("overview");
    }
  }, [activeSection, adminCapabilityData.capabilities, adminCapabilityData.role]);

  useEffect(() => {
    if (activeSection !== "system") return;
    if (systemTab === "audit" && !hasCapability("view_audit_log")) {
      setSystemTab("overview");
      return;
    }
    if (systemTab === "notify_policy" && !hasCapability("manage_notification_policy")) {
      setSystemTab("overview");
    }
  }, [activeSection, systemTab, adminCapabilityData.capabilities, adminCapabilityData.role]);

  // ==================== CREATE TASK ====================
  const createTask = async () => {
    try {
      setError("");
      if (!form.title || !form.assignedTo) {
        setError("Title and employee are required");
        return;
      }
      if (form.dueDate) {
        const dueTs = new Date(form.dueDate).getTime();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (Number.isNaN(dueTs) || dueTs < today.getTime()) {
          setError("Due date cannot be in the past");
          return;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/tasks/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task");

      // Reset form
      setForm({
        title: "",
        description: "",
        dueDate: "",
        assignedTo: "",
        category: "",
        priority: "medium"
      });
      
      // Refresh data
      fetchTasks();
      alert(" Task created successfully!");
    } catch (err) {
      setError(err.message);
      alert(` Error: ${err.message}`);
    }
  };

  // ==================== DASHBOARD METRICS ====================
  const pendingModificationRequests = useMemo(() => {
    const list = [];
    const now = Date.now();
    tasks.forEach(task => {
      (task.modificationRequests || []).forEach(req => {
        const exp = req.expiresAt ? new Date(req.expiresAt).getTime() : null;
        const isExpired = exp != null && exp <= now;
        if (req.status === "pending" && !isExpired) {
          list.push({
            ...req,
            taskId: task._id,
            taskTitle: task.title,
            assignedTo: task.assignedTo,
            origin: "admin_initiated"
          });
        }
      });
      (task.employeeModificationRequests || []).forEach(req => {
        const exp = req.expiresAt ? new Date(req.expiresAt).getTime() : null;
        const isExpired = exp != null && exp <= now;
        if (req.status === "pending" && !isExpired) {
          list.push({
            ...req,
            taskId: task._id,
            taskTitle: task.title,
            assignedTo: task.assignedTo,
            origin: "employee_initiated"
          });
        }
      });
    });
    return list;
  }, [tasks]);

  const pendingModificationsCenter = useMemo(() => {
    // Enterprise behavior: pending bucket must exclude SLA-expired modification requests.
    return pendingModificationRequests.length;
  }, [pendingModificationRequests]);

  const reopenRequests = useMemo(() => {
    return tasks
      .filter(task => task.reopenDueAt || task.reopenSlaStatus)
      .map(task => ({
        taskId: task._id,
        taskTitle: task.title,
        assignedTo: task.assignedTo,
        reopenReason: task.reopenReason,
        reopenDueAt: task.reopenDueAt,
        reopenSlaStatus: task.reopenSlaStatus || "pending",
        reopenViewedAt: task.reopenViewedAt,
        reopenedBy: task.reopenedBy,
        taskStatus: task.status,
        updatedAt: task.updatedAt
      }));
  }, [tasks]);

  const filteredReopenRequests = useMemo(() => {
    let list = reopenRequests;
    if (reopenStatusFilter !== "all") {
      list = list.filter(req => (req.reopenSlaStatus || "pending") === reopenStatusFilter);
    }
    if (reopenSearch.trim()) {
      const q = reopenSearch.trim().toLowerCase();
      list = list.filter(req =>
        (req.taskTitle || "").toLowerCase().includes(q) ||
        (req.reopenReason || "").toLowerCase().includes(q) ||
        (req.assignedTo?.name || "").toLowerCase().includes(q) ||
        (req.assignedTo?.email || "").toLowerCase().includes(q)
      );
    }
    list = list.slice().sort((a, b) => {
      const aTime = new Date(a.reopenDueAt || a.updatedAt || 0).getTime();
      const bTime = new Date(b.reopenDueAt || b.updatedAt || 0).getTime();
      return reopenSort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [reopenRequests, reopenStatusFilter, reopenSearch, reopenSort]);

  const dashboardMetrics = useMemo(() => {
    // Task metrics
    const activeTasks = tasks.filter(t => 
      ["accepted", "in_progress", "reopened"].includes(t.status)
    );
    
    const pendingReviews = tasks.filter(t => t.status === "completed");
    
    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const status = t.status;
      if (["completed", "verified", "failed", "declined_by_employee", "deleted", "withdrawn"].includes(status)) return false;
      return new Date(t.dueDate) < new Date();
    });
    
    const activeEmployees = employees.filter(e => e.status === "active");
    
    const completedToday = tasks.filter(t => {
      if (t.status !== "completed") return false;
      const today = new Date().toDateString();
      const completedDate = new Date(t.completedAt || t.updatedAt).toDateString();
      return today === completedDate;
    });
    
    const declinedToday = tasks.filter(t => {
      if (t.status !== "declined_by_employee") return false;
      const today = new Date().toDateString();
      const updatedDate = new Date(t.updatedAt).toDateString();
      return today === updatedDate;
    });
    
    const urgentTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      if (["completed", "verified", "failed", "declined_by_employee", "deleted", "withdrawn"].includes(t.status)) return false;
      const daysUntilDue = Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 1 && daysUntilDue >= 0;
    });

    // Extension requests
    const pendingExtensions = tasks.reduce((count, task) => {
      return count + (task.extensionRequests?.filter(req => req.status === "pending").length || 0);
    }, 0);

    // Modification requests (both admin and employee initiated)
    const pendingModifications = pendingModificationRequests.length;
    const pendingReopens = reopenRequests.filter(r => {
      if ((r.reopenSlaStatus || "pending") !== "pending") return false;
      if (r.taskStatus !== "reopened") return false;
      if (!r.reopenDueAt) return false;
      return new Date(r.reopenDueAt) > new Date();
    }).length;

    // Archived tasks
    const archivedTasks = tasks.filter(t => t.isArchived === true);

    // Withdrawn tasks
    const withdrawnTasks = tasks.filter(t => t.status === "withdrawn");

    // Total pending requests (extensions + modifications)
    const totalPendingRequests = pendingExtensions + pendingModifications + pendingReopens;

    // Meeting metrics
    const upcomingMeetings = meetings.filter(m => {
      const status = m.status || "scheduled";
      return m.isUpcoming ?? (status === "in_progress" || (status === "scheduled" && new Date(m.meetingDateTime) >= new Date()));
    });

    const todayMeetings = upcomingMeetings.filter(m => {
      const meetingDate = new Date(m.meetingDateTime).toDateString();
      const today = new Date().toDateString();
      return meetingDate === today;
    });

    const pastMeetings = meetings.filter(m => !upcomingMeetings.some(u => u._id === m._id));

    const pendingRSVPs = meetings.reduce((count, meeting) => {
      return count + (meeting.attendees?.filter(a => a.rsvpStatus === "pending").length || 0);
    }, 0);

    return {
      activeTasks,
      pendingReviews,
      overdueTasks,
      activeEmployees,
      completedToday,
      declinedToday,
      urgentTasks,
      pendingExtensions,
      pendingModifications,
      pendingReopens,
      totalPendingRequests,
      archivedTasks,
      withdrawnTasks,
      totalTasks: tasks.length,
      todayMeetings,
      upcomingMeetings,
      pastMeetings,
      pendingRSVPs,
      totalMeetings: meetings.length
    };
  }, [tasks, employees, meetings]);

  const systemStats = useMemo(() => {
    const totalTasks = tasks.length;
    const verifiedTasks = tasks.filter(t => t.status === "verified").length;
    const failedTasks = tasks.filter(t => t.status === "failed").length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const activeTasks = dashboardMetrics.activeTasks.length;
    const overdueTasks = dashboardMetrics.overdueTasks.length;
    const urgentTasks = dashboardMetrics.urgentTasks.length;
    const archivedTasks = dashboardMetrics.archivedTasks.length;
    const withdrawnTasks = dashboardMetrics.withdrawnTasks.length;

    const adminCount = employees.filter(e => e.role === "admin").length;
    const employeeCount = employees.filter(e => e.role === "employee").length;
    const activeEmployees = dashboardMetrics.activeEmployees.length;

    const noticesTotal = noticesAll.length;
    const pollsTotal = noticesAll.filter(n => n.isPoll).length;
    const activePolls = noticesAll.filter(n => n.isPoll && (!n.pollEndDate || new Date(n.pollEndDate) > new Date())).length;
    const taskTimelineEvents = tasks.reduce((sum, t) => sum + (t.activityTimeline?.length || 0), 0);
    const noticeEvents = noticesAll.reduce((sum, n) => sum + ((n.discussion?.length || 0) + ((n.createdAt || n.sendAt) ? 1 : 0)), 0);
    const meetingEvents = meetings.length;
    const requestEvents = dashboardMetrics.pendingExtensions + dashboardMetrics.pendingModifications + dashboardMetrics.pendingReopens;
    const notificationsTotal = taskTimelineEvents + noticeEvents + meetingEvents + requestEvents + inAppNotifications.length;

    const requestQueue = {
      pendingExtensions: dashboardMetrics.pendingExtensions,
      pendingModifications: dashboardMetrics.pendingModifications,
      pendingReopens: dashboardMetrics.pendingReopens,
      totalPending: dashboardMetrics.totalPendingRequests
    };

    const failureRate = totalTasks > 0 ? ((failedTasks / totalTasks) * 100).toFixed(1) : 0;
    const verificationRate = totalTasks > 0 ? ((verifiedTasks / totalTasks) * 100).toFixed(1) : 0;
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    return {
      totalTasks,
      verifiedTasks,
      failedTasks,
      completedTasks,
      activeTasks,
      overdueTasks,
      urgentTasks,
      archivedTasks,
      withdrawnTasks,
      adminCount,
      employeeCount,
      activeEmployees,
      noticesTotal,
      pollsTotal,
      activePolls,
      notificationsTotal,
      requestQueue,
      failureRate,
      verificationRate,
      completionRate
    };
  }, [tasks, employees, noticesAll, inAppNotifications, dashboardMetrics, meetings]);

  const kpiDeltas = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const currentStart = now - sevenDaysMs;
    const previousStart = now - (2 * sevenDaysMs);

    const inWindow = (ts, start, end) => {
      if (!ts) return false;
      const value = new Date(ts).getTime();
      return value >= start && value < end;
    };

    const countTasks = (predicate, start, end) =>
      tasks.filter((t) => predicate(t) && inWindow(t.updatedAt || t.createdAt, start, end)).length;

    const currentCompleted = countTasks((t) => t.status === "completed" || t.status === "verified", currentStart, now);
    const previousCompleted = countTasks((t) => t.status === "completed" || t.status === "verified", previousStart, currentStart);

    const currentFailed = countTasks((t) => t.status === "failed", currentStart, now);
    const previousFailed = countTasks((t) => t.status === "failed", previousStart, currentStart);

    const currentNew = tasks.filter((t) => inWindow(t.createdAt, currentStart, now)).length;
    const previousNew = tasks.filter((t) => inWindow(t.createdAt, previousStart, currentStart)).length;

    const currentReopen = tasks.filter((t) =>
      (t.activityTimeline || []).some((evt) =>
        evt.action === "TASK_REOPENED" && inWindow(evt.timestamp || evt.createdAt, currentStart, now)
      )
    ).length;
    const previousReopen = tasks.filter((t) =>
      (t.activityTimeline || []).some((evt) =>
        evt.action === "TASK_REOPENED" && inWindow(evt.timestamp || evt.createdAt, previousStart, currentStart)
      )
    ).length;

    const withDelta = (currentValue, previousValue) => ({
      current: currentValue,
      previous: previousValue,
      delta: currentValue - previousValue
    });

    return {
      completed: withDelta(currentCompleted, previousCompleted),
      failed: withDelta(currentFailed, previousFailed),
      created: withDelta(currentNew, previousNew),
      reopened: withDelta(currentReopen, previousReopen)
    };
  }, [tasks]);

  const slaOperations = useMemo(() => {
    const now = Date.now();
    const pendingModList = pendingModificationRequests.map((req) => ({
      id: req._id || req.requestId,
      taskId: req.taskId,
      type: "modification",
      title: req.taskTitle,
      dueAt: req.expiresAt,
      requestedAt: req.requestedAt || req.createdAt || req.updatedAt,
      assignedTo: req.assignedTo?.name || req.assignedTo?.email || "Unknown"
    }));

    const pendingExtensionList = tasks.flatMap((task) =>
      (task.extensionRequests || [])
        .filter((req) => req.status === "pending")
        .map((req) => ({
          id: req._id,
          taskId: task._id,
          type: "extension",
          title: task.title,
          dueAt: req.requestedDueDate || req.newDueDate || req.dueDate,
          requestedAt: req.requestedAt || req.createdAt || req.updatedAt,
          assignedTo: task.assignedTo?.name || task.assignedTo?.email || "Unknown"
        }))
    );

    const pendingReopenList = reopenRequests
      .filter((req) => (req.reopenSlaStatus || "pending") === "pending")
      .map((req) => ({
        id: req.taskId,
        taskId: req.taskId,
        type: "reopen",
        title: req.taskTitle,
        dueAt: req.reopenDueAt,
        requestedAt: req.updatedAt,
        assignedTo: req.assignedTo?.name || req.assignedTo?.email || "Unknown"
      }));

    const allPending = [...pendingModList, ...pendingExtensionList, ...pendingReopenList];

    const bucketed = allPending.reduce(
      (acc, req) => {
        const dueTs = req.dueAt ? new Date(req.dueAt).getTime() : null;
        const requestedTs = req.requestedAt ? new Date(req.requestedAt).getTime() : null;
        const ageMs = requestedTs ? now - requestedTs : 0;
        const ageHours = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60)));
        const remainingHours = dueTs ? Math.floor((dueTs - now) / (1000 * 60 * 60)) : null;

        if (remainingHours !== null && remainingHours < 0) acc.breached += 1;
        else if (remainingHours !== null && remainingHours <= 24) acc.atRisk += 1;
        else acc.healthy += 1;

        if (ageHours < 24) acc.aging["0_24"] += 1;
        else if (ageHours < 48) acc.aging["24_48"] += 1;
        else acc.aging["48_plus"] += 1;

        return acc;
      },
      {
        breached: 0,
        atRisk: 0,
        healthy: 0,
        aging: { "0_24": 0, "24_48": 0, "48_plus": 0 }
      }
    );

    return {
      total: allPending.length,
      ...bucketed
    };
  }, [pendingModificationRequests, reopenRequests, tasks]);

  const dataHealth = useMemo(() => {
    const actionableStatuses = ["accepted", "in_progress", "reopened", "assigned"];
    const tasksMissingAssignee = tasks.filter((t) => !t.assignedTo || (!t.assignedTo._id && typeof t.assignedTo !== "string")).length;
    const activeWithoutDueDate = tasks.filter((t) => actionableStatuses.includes(t.status) && !t.dueDate).length;
    const overdueWithoutFlag = tasks.filter((t) => {
      if (!t.dueDate || !actionableStatuses.includes(t.status)) return false;
      return new Date(t.dueDate).getTime() < Date.now() && !t.isOverdue;
    }).length;
    const scheduledPastMeetings = meetings.filter((m) => (m.status || "scheduled") === "scheduled" && new Date(m.meetingDateTime).getTime() < Date.now()).length;
    const noticesWithoutRecipients = noticesAll.filter((n) => !n.recipients || n.recipients.length === 0).length;

    const score =
      tasksMissingAssignee +
      activeWithoutDueDate +
      overdueWithoutFlag +
      scheduledPastMeetings +
      noticesWithoutRecipients;

    return {
      score,
      tasksMissingAssignee,
      activeWithoutDueDate,
      overdueWithoutFlag,
      scheduledPastMeetings,
      noticesWithoutRecipients
    };
  }, [tasks, meetings, noticesAll]);

  const extensionRequests = useMemo(() => {
    return tasks.flatMap(task =>
      (task.extensionRequests || []).map(req => ({
        ...req,
        taskId: task._id,
        taskTitle: task.title,
        assignedTo: task.assignedTo,
        department: task.department
      }))
    );
  }, [tasks]);



  const expiredModificationRequests = useMemo(() => {
    const list = [];
    const now = Date.now();
    const closedTaskStatuses = new Set(["verified", "completed", "failed", "deleted", "archived", "withdrawn", "declined_by_employee"]);
    tasks.forEach(task => {
      const taskStatus = String(task.status || "").trim().toLowerCase();
      if (closedTaskStatuses.has(taskStatus)) return;
      (task.modificationRequests || []).forEach(req => {
        const exp = req.expiresAt ? new Date(req.expiresAt).getTime() : null;
        const isExpired = req.status === "expired" || (req.status === "pending" && exp && exp <= now);
        if (isExpired) {
          list.push({
            ...req,
            taskId: task._id,
            taskTitle: task.title,
            assignedTo: task.assignedTo,
            origin: "admin_initiated"
          });
        }
      });
      (task.employeeModificationRequests || []).forEach(req => {
        const exp = req.expiresAt ? new Date(req.expiresAt).getTime() : null;
        const isExpired = req.status === "expired" || (req.status === "pending" && exp && exp <= now);
        if (isExpired) {
          list.push({
            ...req,
            taskId: task._id,
            taskTitle: task.title,
            assignedTo: task.assignedTo,
            origin: "employee_initiated"
          });
        }
      });
    });
    return list;
  }, [tasks]);

  const filteredExpiredModificationRequests = useMemo(() => {
    let list = expiredModificationRequests.slice();
    if (expiredModTypeFilter !== "all") {
      list = list.filter(req => (req.requestType || "edit") === expiredModTypeFilter);
    }
    if (expiredModSearch.trim()) {
      const q = expiredModSearch.trim().toLowerCase();
      list = list.filter(req =>
        (req.taskTitle || "").toLowerCase().includes(q) ||
        (req.reason || "").toLowerCase().includes(q) ||
        (req.assignedTo?.name || "").toLowerCase().includes(q) ||
        (req.assignedTo?.email || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const aTime = new Date(a.expiresAt || a.updatedAt || a.requestedAt || 0).getTime();
      const bTime = new Date(b.expiresAt || b.updatedAt || b.requestedAt || 0).getTime();
      return expiredModSort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [expiredModificationRequests, expiredModTypeFilter, expiredModSearch, expiredModSort]);

  const extensionStats = useMemo(() => {
    const stats = { all: extensionRequests.length, pending: 0, approved: 0, rejected: 0 };
    extensionRequests.forEach(req => {
      if (req.status === "pending") stats.pending += 1;
      else if (req.status === "approved") stats.approved += 1;
      else if (req.status === "rejected") stats.rejected += 1;
    });
    return stats;
  }, [extensionRequests]);

  const filteredExtensionRequests = useMemo(() => {
    let list = extensionRequests;
    if (extensionStatusFilter !== "all") {
      list = list.filter(req => req.status === extensionStatusFilter);
    }
    if (requestSearch.trim()) {
      const q = requestSearch.trim().toLowerCase();
      list = list.filter(req =>
        (req.taskTitle || "").toLowerCase().includes(q) ||
        (req.reason || "").toLowerCase().includes(q) ||
        (req.assignedTo?.name || "").toLowerCase().includes(q) ||
        (req.assignedTo?.email || "").toLowerCase().includes(q)
      );
    }
    list = list.slice().sort((a, b) => {
      const aTime = new Date(a.requestedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.requestedAt || b.createdAt || 0).getTime();
      return extensionSort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [extensionRequests, extensionStatusFilter, requestSearch, extensionSort]);


  // ==================== HELPER FUNCTIONS ====================
  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString('en-GB') : "";

  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString('en-GB') : "";


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

  const fetchNoticesAll = async () => {
    try {
      markSyncStatus("notices", "syncing");
      const res = await fetch(`${API_BASE_URL}/api/notices`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNoticesAll(data.notices || []);
        markSyncStatus("notices", "ok");
      } else {
        setNoticesAll([]);
        markSyncStatus("notices", "error");
      }
    } catch (err) {
      console.error(" Failed to fetch notices:", err);
      setNoticesAll([]);
      markSyncStatus("notices", "error");
    }
  };

  const fetchInAppNotifications = async () => {
    try {
      markSyncStatus("notifications", "syncing");
      const res = await fetch(`${API_BASE_URL}/api/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setInAppNotifications(data.notifications || []);
        markSyncStatus("notifications", "ok");
      } else {
        setInAppNotifications([]);
        markSyncStatus("notifications", "error");
      }
    } catch (_err) {
      setInAppNotifications([]);
      markSyncStatus("notifications", "error");
    }
  };

  const getLatestModRequest = (task) => {
    const list = task?.modificationRequests || [];
    if (list.length === 0) return null;
    return list.slice().sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];
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

  const getModStatusBadge = (task) => {
    const latest = getLatestModRequest(task);
    if (!latest) return null;
    const expiresAtMs = latest.expiresAt ? new Date(latest.expiresAt).getTime() : null;
    const isExpired = latest.status === "pending" && expiresAtMs != null && expiresAtMs <= Date.now();
    if (isExpired) return { label: "MOD EXPIRED", className: "bg-red-700 text-white" };
    const normalized = String(latest.status || "").toLowerCase();
    if (normalized === "pending") return { label: "MOD PENDING", className: "bg-orange-600 text-white" };
    if (normalized === "approved") return { label: "MOD APPROVED", className: "bg-green-600 text-white" };
    if (normalized === "rejected") return { label: "MOD REJECTED", className: "bg-red-600 text-white" };
    if (normalized === "executed") return { label: "MOD EXECUTED", className: "bg-blue-600 text-white" };
    if (normalized === "counter_proposed") return { label: "COUNTER PROPOSED", className: "bg-yellow-500 text-black" };
    return { label: `MOD ${normalized.toUpperCase()}`, className: "bg-slate-600 text-white" };
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

  const getTaskAge = (createdAt) => {
    if (!createdAt) return "";
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days === 0 ? "Today" : `${days} day(s)`;
  };

  const getTodayDateInputValue = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getSLAStatus = (dueDate) => {
    if (!dueDate) return "";
    const diff = Math.ceil(
      (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (diff < 0) return `Overdue by ${Math.abs(diff)} day(s)`;
    if (diff === 0) return "Due today";
    return `Due in ${diff} day(s)`;
  };

  const getTurnaround = (task) => {
    if (!task?.createdAt || !task?.completedAt) return "";
    const start = new Date(task.createdAt);
    const end = new Date(task.completedAt);
    const diffMs = end - start;
    if (diffMs <= 0) return "";
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days === 0) return `${hours}h`;
    if (hours === 0) return `${days}d`;
    return `${days}d ${hours}h`;
  };

  const getLastActivity = (task) => {
    const timeline = task.activityTimeline || [];
    if (timeline.length === 0) return "No activity";
    
    const lastEvent = timeline[timeline.length - 1];
    const action = lastEvent.action.replace(/_/g, ' ').toLowerCase();
    const timeAgo = Math.floor((Date.now() - new Date(lastEvent.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    
    return `${action} ${timeAgo === 0 ? 'today' : `${timeAgo} day(s) ago`}`;
  };

  const notificationEvents = useMemo(() => {
    const events = [];

    tasks.forEach(task => {
      (task.activityTimeline || []).forEach(evt => {
        const timestamp = evt.createdAt || evt.timestamp;
        if (!timestamp) return;
        events.push({
          source: "task",
          taskId: task._id,
          taskTitle: task.title,
          action: evt.action,
          role: evt.role,
          details: evt.details,
          timestamp
        });
      });
    });

    meetings.forEach(meeting => {
      const timestamp = meeting.updatedAt || meeting.createdAt || meeting.meetingDateTime;
      if (!timestamp) return;
      events.push({
        source: "meeting",
        action: "MEETING_SCHEDULED",
        taskId: null,
        taskTitle: meeting.title,
        role: "system",
        details: `${new Date(meeting.meetingDateTime).toLocaleString('en-GB')}  ${meeting.meetingPlatform || "Meeting"}`,
        timestamp
      });
    });

    noticesAll.forEach(notice => {
      if (notice.createdAt) {
        events.push({
          source: "notice",
          action: "NOTICE_SENT",
          taskId: null,
          taskTitle: notice.title,
          role: "admin",
          details: notice.content,
          timestamp: notice.createdAt
        });
      }

      (notice.discussion || []).forEach(msg => {
        if (!msg.createdAt) return;
        events.push({
          source: "notice",
          action: "NOTICE_COMMENT",
          taskId: null,
          taskTitle: notice.title,
          role: msg.senderRole || "employee",
          details: msg.text,
          timestamp: msg.createdAt
        });
      });
    });
    
    inAppNotifications.forEach(n => {
      events.push({
        source: "community",
        action: (n.type || "MENTION").toUpperCase(),
        taskId: null,
        taskTitle: n.title || "Community",
        role: "system",
        details: n.message,
        timestamp: n.createdAt
      });
    });

    pendingModificationRequests.forEach(req => {
      const timestamp = req.requestedAt || req.createdAt || req.updatedAt;
      if (!timestamp) return;
      events.push({
        source: "request",
        action: "MODIFICATION_PENDING",
        taskId: req.taskId,
        taskTitle: req.taskTitle,
        role: req.origin === "employee_initiated" ? "employee" : "admin",
        details: req.reason,
        timestamp
      });
    });

    extensionRequests.forEach(req => {
      if (req.status !== "pending") return;
      const timestamp = req.requestedAt || req.createdAt || req.updatedAt;
      if (!timestamp) return;
      events.push({
        source: "request",
        action: "EXTENSION_PENDING",
        taskId: req.taskId,
        taskTitle: req.taskTitle,
        role: "employee",
        details: req.reason,
        timestamp
      });
    });

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return events;
  }, [tasks, meetings, noticesAll, inAppNotifications, pendingModificationRequests, extensionRequests]);

  const notificationStats = useMemo(() => {
    const stats = { all: notificationEvents.length, task: 0, meeting: 0, notice: 0, request: 0, community: 0 };
    notificationEvents.forEach(evt => {
      if (stats[evt.source] !== undefined) stats[evt.source] += 1;
    });
    return stats;
  }, [notificationEvents]);

  const newNotificationCount = useMemo(() => {
    if (!notificationsClearedAt) return notificationEvents.length;
    const clearedAt = new Date(notificationsClearedAt).getTime();
    return notificationEvents.filter(evt => new Date(evt.timestamp).getTime() > clearedAt).length;
  }, [notificationEvents, notificationsClearedAt]);

  const visibleNotifications = useMemo(() => {
    let list = showOnlyNewNotifications && notificationsClearedAt
      ? notificationEvents.filter(evt => new Date(evt.timestamp).getTime() > new Date(notificationsClearedAt).getTime())
      : notificationEvents;

    if (notificationSourceFilter !== "all") {
      list = list.filter(evt => evt.source === notificationSourceFilter);
    }
    if (notificationActionFilter !== "all") {
      list = list.filter(evt => evt.action === notificationActionFilter);
    }
    if (notificationSearch.trim()) {
      const q = notificationSearch.trim().toLowerCase();
      list = list.filter(evt =>
        (evt.taskTitle || "").toLowerCase().includes(q) ||
        (evt.details || "").toLowerCase().includes(q) ||
        (evt.action || "").toLowerCase().includes(q)
      );
    }
    return list.slice(0, 40);
  }, [
    notificationEvents,
    notificationsClearedAt,
    showOnlyNewNotifications,
    notificationSourceFilter,
    notificationActionFilter,
    notificationSearch
  ]);

  const localAuditEvents = useMemo(() => {
    const events = [];
    const classifyWorkflow = (source, action) => {
      const text = String(action || "").toLowerCase();
      if (source === "meeting") return "meeting";
      if (source === "notice") return "notice";
      if (text.includes("modification")) return "modification";
      if (text.includes("reopen")) return "reopen";
      if (text.includes("extension")) return "extension";
      return "task";
    };

    tasks.forEach((task) => {
      const assignedId = task?.assignedTo?._id || task?.assignedTo || null;
      const assignedName = task?.assignedTo?.name || task?.assignedTo?.email || "";
      (task.activityTimeline || []).forEach((evt) => {
        const action = String(evt.action || "UNKNOWN");
        const actionText = action.toLowerCase();
        const severity = actionText.includes("failed") || actionText.includes("declined")
          ? "high"
          : actionText.includes("overdue") || actionText.includes("reopen")
          ? "medium"
          : "low";

        events.push({
          id: `task-${task._id}-${evt._id || evt.timestamp || Math.random()}`,
          source: "task",
          severity,
          action,
          entity: task.title || "Task",
          actor: evt.by || evt.role || "system",
          details: evt.details || evt.note || "",
          timestamp: evt.timestamp || evt.createdAt || task.updatedAt || task.createdAt,
          taskId: task._id,
          employeeId: assignedId ? String(assignedId) : "",
          employeeName: assignedName,
          workflow: classifyWorkflow("task", action)
        });
      });
    });

    meetings.forEach((meeting) => {
      const participantIds = (meeting.attendees || [])
        .map((att) => att?.employee?._id || att?.employee)
        .filter(Boolean)
        .map((id) => String(id));
      events.push({
        id: `meeting-${meeting._id}`,
        source: "meeting",
        severity: meeting.isExpired ? "medium" : "low",
        action: `MEETING_${String(meeting.status || "scheduled").toUpperCase()}`,
        entity: meeting.title || "Meeting",
        actor: meeting.organizer?.name || "admin",
        details: meeting.description || "",
        timestamp: meeting.updatedAt || meeting.meetingDateTime || meeting.createdAt,
        taskId: "",
        employeeId: "",
        employeeName: "",
        participantIds,
        workflow: "meeting"
      });
    });

    noticesAll.forEach((notice) => {
      events.push({
        id: `notice-${notice._id}`,
        source: "notice",
        severity: "low",
        action: "NOTICE_PUBLISHED",
        entity: notice.title || "Notice",
        actor: notice.createdBy?.name || "admin",
        details: notice.content || notice.description || "",
        timestamp: notice.sendAt || notice.createdAt || notice.updatedAt,
        taskId: "",
        employeeId: "",
        employeeName: "",
        workflow: "notice"
      });
    });

    return events
      .filter((evt) => evt.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tasks, meetings, noticesAll]);

  const auditEvents = auditEventsRemote || localAuditEvents;

  const filteredAuditEvents = useMemo(() => {
    let list = auditEvents;
    if (auditSourceFilter !== "all") {
      list = list.filter((evt) => evt.source === auditSourceFilter);
    }
    if (auditSeverityFilter !== "all") {
      list = list.filter((evt) => evt.severity === auditSeverityFilter);
    }
    if (auditWorkflowFilter !== "all") {
      list = list.filter((evt) => evt.workflow === auditWorkflowFilter);
    }
    if (selectedAuditEmployee !== "all") {
      list = list.filter((evt) => {
        if (evt.source === "meeting") {
          return (evt.participantIds || []).includes(selectedAuditEmployee);
        }
        return evt.employeeId === selectedAuditEmployee;
      });
    }
    if (selectedAuditTask !== "all") {
      list = list.filter((evt) => evt.taskId === selectedAuditTask);
    }
    if (auditSearch.trim()) {
      const q = auditSearch.trim().toLowerCase();
      list = list.filter((evt) =>
        (evt.entity || "").toLowerCase().includes(q) ||
        (evt.action || "").toLowerCase().includes(q) ||
        (evt.actor || "").toLowerCase().includes(q) ||
        (evt.details || "").toLowerCase().includes(q)
      );
    }
    return list.slice(0, 500);
  }, [auditEvents, auditSourceFilter, auditSeverityFilter, auditSearch, selectedAuditEmployee, selectedAuditTask, auditWorkflowFilter]);

  const auditEmployeeOptions = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => {
      if (emp?._id) map.set(String(emp._id), emp);
    });
    tasks.forEach((task) => {
      const id = task?.assignedTo?._id || task?.assignedTo;
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, {
          _id: key,
          name: task?.assignedTo?.name || task?.assignedTo?.email || "Employee",
          email: task?.assignedTo?.email || ""
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [employees, tasks]);

  const auditTaskOptions = useMemo(() => {
    let scoped = tasks.slice();
    if (selectedAuditEmployee !== "all") {
      scoped = scoped.filter((task) => String(task?.assignedTo?._id || task?.assignedTo || "") === selectedAuditEmployee);
    }
    return scoped
      .map((task) => ({
        _id: task._id,
        title: task.title || "Untitled Task",
        assignee: task?.assignedTo?.name || task?.assignedTo?.email || ""
      }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [tasks, selectedAuditEmployee]);

  const selectedAuditTaskDetails = useMemo(() => {
    if (selectedAuditTask === "all") return null;
    return tasks.find((task) => String(task._id) === String(selectedAuditTask)) || null;
  }, [tasks, selectedAuditTask]);

  const pagedAuditEvents = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    return filteredAuditEvents.slice(start, start + auditPageSize);
  }, [filteredAuditEvents, auditPage, auditPageSize]);

  const auditVirtualRows = useMemo(() => {
    const rowHeight = 96;
    const viewport = 560;
    const overscan = 4;
    const startIndex = Math.max(0, Math.floor(auditScrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewport / rowHeight) + overscan * 2;
    const endIndex = Math.min(pagedAuditEvents.length, startIndex + visibleCount);
    const items = pagedAuditEvents.slice(startIndex, endIndex);
    return {
      items,
      startIndex,
      rowHeight,
      totalHeight: pagedAuditEvents.length * rowHeight
    };
  }, [pagedAuditEvents, auditScrollTop]);

  const auditPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAuditEvents.length / auditPageSize));
  }, [filteredAuditEvents.length, auditPageSize]);

  const syncHealth = useMemo(() => {
    const now = Date.now();
    const statuses = Object.entries(syncMeta).map(([key, meta]) => {
      const ageMs = meta?.lastOk ? now - meta.lastOk : Number.POSITIVE_INFINITY;
      let state = meta?.status || "idle";
      if (state !== "error" && meta?.lastOk) {
        if (ageMs <= 60 * 1000) state = "live";
        else if (ageMs <= 2 * 60 * 1000) state = "delayed";
        else state = "reconnecting";
      } else if (!meta?.lastOk && state !== "error") {
        state = "reconnecting";
      }
      return { key, state, ageMs };
    });

    const hasError = statuses.some((s) => s.state === "error");
    const hasReconnect = statuses.some((s) => s.state === "reconnecting");
    const hasDelay = statuses.some((s) => s.state === "delayed");
    const overall = hasError ? "error" : hasReconnect ? "reconnecting" : hasDelay ? "delayed" : "live";
    return { overall, statuses };
  }, [syncMeta, nowTick]);

  const adminHomeQueues = useMemo(() => {
    const needsAction = [];
    const atRisk = [];
    const informational = [];
    const closedTaskStatuses = new Set(["verified", "completed", "failed", "deleted", "archived", "withdrawn", "declined_by_employee"]);
    const seenNeedsAction = new Set();
    const seenAtRisk = new Set();
    const seenInformational = new Set();
    const pushUnique = (bucket, seen, item) => {
      const key = `${item.id}-${item.type}`;
      if (seen.has(key)) return;
      seen.add(key);
      bucket.push(item);
    };

    tasks.forEach((task) => {
      const status = String(task.status || "").trim().toLowerCase();
      const title = task.title || "Task";
      const base = { id: task._id, title, owner: task.assignedTo?.name || task.assignedTo?.email || "Unknown" };
      const isAssignmentDecline = status === "declined_by_employee" && String(task.declineType || "") === "assignment_decline";
      const isReopenDecline = status === "declined_by_employee" && String(task.declineType || "") === "reopen_decline";
      const isWithdrawn = status === "withdrawn" || String(task.declineType || "") === "withdrawal";
      const isOverdueOpen = Boolean(
        task.dueDate &&
        !closedTaskStatuses.has(status) &&
        new Date(task.dueDate).getTime() < Date.now()
      );
      const hasAwaitingEmployeeResponse =
        (task.modificationRequests || []).some((req) => req.status === "pending") ||
        (task.extensionRequests || []).some((req) => req.status === "pending") ||
        String(task.reopenSlaStatus || "").toLowerCase() === "pending";

      if (status === "completed") {
        pushUnique(needsAction, seenNeedsAction, { ...base, type: "review", note: "Completed task awaiting review" });
      } else if (isOverdueOpen) {
        pushUnique(needsAction, seenNeedsAction, { ...base, type: "overdue_action", note: `Overdue task needs immediate action (${formatDate(task.dueDate)})` });
      } else if (isWithdrawn) {
        pushUnique(atRisk, seenAtRisk, { ...base, type: "withdrawn", note: "Withdrawn task - reassignment risk" });
      } else if (isAssignmentDecline) {
        pushUnique(atRisk, seenAtRisk, { ...base, type: "assignment_decline", note: "Declined at assignment stage" });
      } else if (isReopenDecline) {
        pushUnique(atRisk, seenAtRisk, { ...base, type: "reopen_decline", note: "Reopen declined by employee" });
      } else if (hasAwaitingEmployeeResponse) {
        pushUnique(informational, seenInformational, { ...base, type: "awaiting_response", note: "Awaiting employee response" });
      } else {
        pushUnique(informational, seenInformational, { ...base, type: "task", note: `Status: ${status || "unknown"}` });
      }
    });

    expiredModificationRequests.forEach((req) => {
      pushUnique(atRisk, seenAtRisk, {
        id: req.taskId,
        title: req.taskTitle || "Expired modification request",
        owner: req.assignedTo?.name || req.assignedTo?.email || "Unknown",
        type: "expired_modification",
        note: "Modification request SLA expired"
      });
    });

    const latestAccepted = tasks
      .filter((task) => String(task.status || "").trim().toLowerCase() === "accepted")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0];
    if (latestAccepted) {
      const latestAcceptedItem = {
        id: latestAccepted._id,
        title: latestAccepted.title || "Task",
        owner: latestAccepted.assignedTo?.name || latestAccepted.assignedTo?.email || "Unknown",
        type: "latest_accepted",
        note: `Latest accepted task (${formatDate(latestAccepted.updatedAt || latestAccepted.createdAt)})`
      };
      const key = `${latestAcceptedItem.id}-${latestAcceptedItem.type}`;
      if (!seenInformational.has(key)) {
        seenInformational.add(key);
        informational.unshift(latestAcceptedItem);
      }
    }

    return {
      needsAction: needsAction.slice(0, 12),
      atRisk: atRisk.slice(0, 12),
      informational: informational.slice(0, 12)
    };
  }, [tasks, expiredModificationRequests]);

  const cohortAnalytics = useMemo(() => {
    const byPriority = {};
    const byAssignee = {};
    const byDepartment = {};

    tasks.forEach((task) => {
      const status = String(task.status || "").toLowerCase();
      const keyPriority = (task.priority || "unspecified").toLowerCase();
      const keyAssignee = task.assignedTo?.name || task.assignedTo?.email || "unassigned";
      const keyDept = task.department || task.category || "general";

      byPriority[keyPriority] = byPriority[keyPriority] || { total: 0, overdue: 0, failed: 0 };
      byPriority[keyPriority].total += 1;
      if (task.dueDate && !["verified", "completed", "failed", "deleted"].includes(status) && new Date(task.dueDate).getTime() < Date.now()) {
        byPriority[keyPriority].overdue += 1;
      }
      if (status === "failed") byPriority[keyPriority].failed += 1;

      byAssignee[keyAssignee] = byAssignee[keyAssignee] || { total: 0, completed: 0, failed: 0 };
      byAssignee[keyAssignee].total += 1;
      if (["completed", "verified"].includes(status)) byAssignee[keyAssignee].completed += 1;
      if (status === "failed") byAssignee[keyAssignee].failed += 1;

      byDepartment[keyDept] = byDepartment[keyDept] || { total: 0, completed: 0 };
      byDepartment[keyDept].total += 1;
      if (["completed", "verified"].includes(status)) byDepartment[keyDept].completed += 1;
    });

    const topAssignees = Object.entries(byAssignee)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    const topDepartments = Object.entries(byDepartment)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    return { byPriority, topAssignees, topDepartments };
  }, [tasks]);

  const exportAuditCsv = () => {
    const rows = filteredAuditEvents.map((evt) => ({
      timestamp: formatDateTime(evt.timestamp),
      source: evt.source,
      severity: evt.severity,
      action: evt.action,
      entity: evt.entity,
      actor: evt.actor,
      details: String(evt.details || "").replace(/\n/g, " ").trim()
    }));
    const headers = ["timestamp", "source", "severity", "action", "entity", "actor", "details"];
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ems-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAuditPdf = () => {
    const rows = filteredAuditEvents.slice(0, 200);
    const htmlRows = rows.map((evt) => `
      <tr>
        <td>${formatDateTime(evt.timestamp)}</td>
        <td>${evt.source}</td>
        <td>${evt.severity}</td>
        <td>${evt.action}</td>
        <td>${String(evt.entity || "").replace(/</g, "&lt;")}</td>
        <td>${String(evt.actor || "").replace(/</g, "&lt;")}</td>
      </tr>
    `).join("");

    const popup = window.open("", "_blank", "width=1200,height=800");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>EMS Audit Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h1 { margin: 0 0 8px; }
            p { margin: 0 0 12px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>EMS Audit Report</h1>
          <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th><th>Source</th><th>Severity</th><th>Action</th><th>Entity</th><th>Actor</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const fetchAdminCapabilities = async () => {
    if (!user?.token) return;
    try {
      setCapabilitiesLoading(true);
      setCapabilitiesError("");
      const res = await fetch(`${API_BASE_URL}/api/admin/capabilities`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminCapabilityData({
          role: data.role || user?.role || "admin",
          capabilities: data.capabilities || [],
          availableCapabilities: data.availableCapabilities || []
        });
      } else {
        setCapabilitiesError(data?.error || "Failed to load capability matrix");
      }
    } catch (err) {
      console.error("Failed to fetch admin capabilities:", err);
      setCapabilitiesError("Failed to load capability matrix");
    } finally {
      setCapabilitiesLoading(false);
    }
  };

  const adminSmartNotifications = useMemo(() => {
    const items = [];
    const now = Date.now();
    const criticalOverdueHours = Math.max(1, Number(notificationPolicy.criticalOverdueHours) || 48);
    const maxImportantToasts = Math.max(1, Number(notificationPolicy.maxImportantToasts) || 3);

    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      if (["completed", "verified", "failed", "declined_by_employee", "deleted", "withdrawn"].includes(t.status)) return false;
      return new Date(t.dueDate).getTime() < now;
    });
    if (overdueTasks.length > 0) {
      const mostOverdue = overdueTasks.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
      const overdueHours = Math.max(0, (now - new Date(mostOverdue.dueDate).getTime()) / (1000 * 60 * 60));
      const priority = overdueHours >= criticalOverdueHours ? "CRITICAL" : "IMPORTANT";
      items.push({
        id: `admin_overdue_${priority}_${overdueTasks.length}`,
        priority,
        title: priority === "CRITICAL" ? "SLA breached on tasks" : "Overdue tasks need review",
        message: `There are ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} without resolution.`,
        softMessage: `There are ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} to review when possible.`,
        actionLabel: "Open Task",
        autoDismissMs: priority === "IMPORTANT" ? 10000 : undefined,
        onClick: () => openTaskInManagement(mostOverdue._id, "overdue"),
        blocking: true
      });
    }

    const failedAfterReopen = tasks.filter(t => t.status === "failed" && t.reopenReason);
    if (failedAfterReopen.length > 0) {
      const latestFailed = failedAfterReopen.slice().sort((a, b) => new Date(b.updatedAt || b.completedAt || 0) - new Date(a.updatedAt || a.completedAt || 0))[0];
      items.push({
        id: `admin_failed_reopen_${failedAfterReopen.length}`,
        priority: "CRITICAL",
        title: "Task failed after reopen",
        message: `There are ${failedAfterReopen.length} task${failedAfterReopen.length > 1 ? "s" : ""} failed after reopen.`,
        softMessage: "A reopened task failed and needs review.",
        actionLabel: "Open Task",
        onClick: () => openTaskInManagement(latestFailed._id, "declined"),
        blocking: true
      });
    }

    const pendingReviews = tasks.filter(t => t.status === "completed");
    if (pendingReviews.length > 0) {
      const oldestReview = pendingReviews.slice().sort((a, b) => new Date(a.completedAt || a.updatedAt) - new Date(b.completedAt || b.updatedAt))[0];
      items.push({
        id: `admin_review_${pendingReviews.length}`,
        priority: "IMPORTANT",
        title: "Tasks awaiting review",
        message: `${pendingReviews.length} task${pendingReviews.length > 1 ? "s" : ""} are completed and need review.`,
        softMessage: `${pendingReviews.length} completed task${pendingReviews.length > 1 ? "s" : ""} are ready for review.`,
        actionLabel: "Open Review",
        onClick: () => openTaskInReviewCenter(oldestReview._id),
        dismissible: true
      });
    }

    const pendingExtensions = extensionRequests.filter(req => req.status === "pending");
    if (pendingExtensions.length > 0) {
      const firstReq = pendingExtensions[0];
      items.push({
        id: `admin_extensions_${pendingExtensions.length}`,
        priority: "IMPORTANT",
        title: "Extension requests pending",
        message: `You have ${pendingExtensions.length} extension request${pendingExtensions.length > 1 ? "s" : ""} awaiting action.`,
        softMessage: `Extension requests are waiting. You can review them when ready.`,
        actionLabel: "Open Request",
        onClick: () => {
          setActiveSection("pendingRequests");
          setActiveTab("extensions");
          openTaskDetails(firstReq.taskId, { activeSection: "pendingRequests", activeTab: "extensions" });
        },
        dismissible: true
      });
    }

    const unreadInApp = inAppNotifications.filter(n => !n.isRead).length;
    if (unreadInApp > 0) {
      items.push({
        id: `admin_unread_notif_${unreadInApp}`,
        priority: "IMPORTANT",
        title: "New notifications",
        message: `You have ${unreadInApp} unread notification${unreadInApp > 1 ? "s" : ""}.`,
        actionLabel: "Open Notifications",
        onClick: () => setActiveSection("notifications"),
        dismissible: true,
        autoDismissMs: 10000
      });
    }

    const pendingModifications = pendingModificationRequests;
    if (pendingModifications.length > 0) {
      items.push({
        id: `admin_mods_${pendingModifications.length}`,
        priority: "IMPORTANT",
        title: "Modification requests pending",
        message: `You have ${pendingModifications.length} modification request${pendingModifications.length > 1 ? "s" : ""} to review.`,
        softMessage: `There are modification requests ready for your review.`,
        actionLabel: "Open Requests",
        onClick: () => {
          setActiveSection("pendingRequests");
          setActiveTab("modifications");
          navigate("/admin", {
            state: {
              activeSection: "pendingRequests",
              activeTab: "modifications"
            }
          });
        },
        dismissible: true
      });
    }

    const critical = items.filter((item) => item.priority === "CRITICAL");
    const important = items
      .filter((item) => item.priority === "IMPORTANT")
      .slice(0, maxImportantToasts);
    const info = items.filter((item) => item.priority === "INFO");
    return [...critical, ...important, ...info];
  }, [tasks, extensionRequests, pendingModificationRequests, inAppNotifications, nowTick, notificationPolicy]);

  const notificationActionOptions = useMemo(() => {
    if (notificationSourceFilter === "meeting") {
      return [
        { value: "MEETING_SCHEDULED", label: "Meeting Scheduled" }
      ];
    }
    if (notificationSourceFilter === "notice") {
      return [
        { value: "NOTICE_SENT", label: "Notice Sent" },
        { value: "NOTICE_COMMENT", label: "Notice Comment" }
      ];
    }
    if (notificationSourceFilter === "request") {
      return [
        { value: "MODIFICATION_PENDING", label: "Modification Pending" },
        { value: "EXTENSION_PENDING", label: "Extension Pending" },
        { value: "MODIFICATION_REQUESTED", label: "Modification Requested" },
        { value: "MODIFICATION_APPROVED", label: "Modification Approved" },
        { value: "MODIFICATION_REJECTED", label: "Modification Rejected" },
        { value: "EXTENSION_REQUESTED", label: "Extension Requested" },
        { value: "EXTENSION_APPROVED", label: "Extension Approved" }
      ];
    }
    if (notificationSourceFilter === "task") {
      return [
        { value: "TASK_ACCEPTED", label: "Task Accepted" },
        { value: "TASK_COMPLETED", label: "Task Submitted" },
        { value: "TASK_DECLINED", label: "Task Declined" },
        { value: "TASK_REOPENED", label: "Task Reopened" },
        { value: "TASK_REOPEN_ACCEPTED", label: "Reopen Accepted" },
        { value: "TASK_REOPEN_DECLINED", label: "Reopen Declined" },
        { value: "TASK_WITHDRAWN", label: "Task Withdrawn" },
        { value: "TASK_EDITED", label: "Task Edited" },
        { value: "TASK_DELETED", label: "Task Deleted" }
      ];
    }
    return [
      { value: "TASK_ACCEPTED", label: "Task Accepted" },
      { value: "TASK_COMPLETED", label: "Task Submitted" },
      { value: "TASK_DECLINED", label: "Task Declined" },
      { value: "TASK_REOPENED", label: "Task Reopened" },
      { value: "TASK_REOPEN_ACCEPTED", label: "Reopen Accepted" },
      { value: "TASK_REOPEN_DECLINED", label: "Reopen Declined" },
      { value: "TASK_WITHDRAWN", label: "Task Withdrawn" },
      { value: "TASK_EDITED", label: "Task Edited" },
      { value: "TASK_DELETED", label: "Task Deleted" },
      { value: "MODIFICATION_REQUESTED", label: "Modification Requested" },
      { value: "MODIFICATION_PENDING", label: "Modification Pending" },
      { value: "MODIFICATION_APPROVED", label: "Modification Approved" },
      { value: "MODIFICATION_REJECTED", label: "Modification Rejected" },
      { value: "EXTENSION_REQUESTED", label: "Extension Requested" },
      { value: "EXTENSION_PENDING", label: "Extension Pending" },
      { value: "EXTENSION_APPROVED", label: "Extension Approved" },
      { value: "NOTICE_SENT", label: "Notice Sent" },
      { value: "NOTICE_COMMENT", label: "Notice Comment" },
      { value: "MEETING_SCHEDULED", label: "Meeting Scheduled" }
    ];
  }, [notificationSourceFilter]);

  const formatActionLabel = (action) => {
    if (!action) return "Activity";
    switch (action) {
      case "NOTICE_SENT": return "Notice Sent";
      case "NOTICE_COMMENT": return "Notice Comment";
      case "MEETING_SCHEDULED": return "Meeting Scheduled";
      case "MODIFICATION_PENDING": return "Modification Pending";
      case "EXTENSION_PENDING": return "Extension Pending";
      default:
        return action.replace(/_/g, " ");
    }
  };

  const topPerformerRows = useMemo(() => {
    const now = Date.now();
    return employees
      .filter(e => e.status === "active")
      .map(emp => {
        const empId = emp._id;
        const employeeTasks = tasks.filter(t => t.assignedTo?._id === empId);
        const submittedTasks = employeeTasks.filter(t => t.completedAt || t.workSubmission?.submittedAt);
        const verifiedCount = employeeTasks.filter(t => t.status === "verified").length;
        const onTimeCount = submittedTasks.filter(t => t.dueDate && new Date(t.completedAt || t.workSubmission?.submittedAt).getTime() <= new Date(t.dueDate).getTime()).length;
        const verificationRate = submittedTasks.length > 0 ? (verifiedCount / submittedTasks.length) * 100 : 0;
        const onTimeRate = submittedTasks.length > 0 ? (onTimeCount / submittedTasks.length) * 100 : 0;

        const employeeMeetings = meetings.filter(m =>
          (m.attendees || []).some(a => a.employee?._id === empId || a.employee === empId)
        );
        const completedMeetings = employeeMeetings.filter(m => new Date(m.meetingDateTime).getTime() <= now);
        const attendedMeetings = completedMeetings.filter(m => {
          const attendee = (m.attendees || []).find(a => a.employee?._id === empId || a.employee === empId);
          return attendee?.attended;
        });
        const attendanceRate = completedMeetings.length > 0 ? (attendedMeetings.length / completedMeetings.length) * 100 : 0;

        const employeeNotices = noticesAll.filter(n =>
          (n.recipients || []).some(r => r.user?._id === empId || r.user === empId)
        );
        const readNotices = employeeNotices.filter(n => {
          const recipient = (n.recipients || []).find(r => r.user?._id === empId || r.user === empId);
          return recipient?.read;
        });
        const noticeReadRate = employeeNotices.length > 0 ? (readNotices.length / employeeNotices.length) * 100 : 100;

        const employeeRequests = employeeTasks.flatMap(task => task.modificationRequests || []);
        const respondedRequests = employeeRequests.filter(r => {
          if (r.response?.respondedAt) return true;
          return ["approved", "rejected", "executed"].includes((r.status || "").toLowerCase());
        });
        const responseRate = employeeRequests.length > 0 ? (respondedRequests.length / employeeRequests.length) * 100 : 100;

        const compositeScore = Math.round(
          (verificationRate * 0.35) +
          (onTimeRate * 0.30) +
          (attendanceRate * 0.10) +
          (noticeReadRate * 0.10) +
          (responseRate * 0.15)
        );

        return {
          id: empId,
          name: emp.name,
          compositeScore,
          verifiedCount,
          totalAssigned: employeeTasks.length,
          pendingReview: employeeTasks.filter(t => t.status === "completed").length
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }, [employees, tasks, meetings, noticesAll]);

  const getActionIcon = (action) => {
    switch (action) {
      case "COMMENT_ADDED": return "MSG";
      case "NOTICE_COMMENT": return "MSG";
      case "MODIFICATION_REQUESTED": return "REQ";
      case "MODIFICATION_APPROVED": return "OK";
      case "MODIFICATION_REJECTED": return "NO";
      case "MODIFICATION_COUNTER_PROPOSAL": return "REV";
      case "MODIFICATION_PENDING": return "PEND";
      case "EXTENSION_PENDING": return "EXT";
      case "NOTICE_SENT": return "NOTE";
      case "MEETING_SCHEDULED": return "MEET";
      case "TASK_ACCEPTED": return "OK";
      case "TASK_COMPLETED": return "DONE";
      case "TASK_VERIFIED": return "OK";
      case "TASK_DECLINED": return "NO";
      case "TASK_EDITED": return "EDIT";
      case "TASK_DELETED": return "DEL";
      case "TASK_REOPENED": return "REOP";
      case "TASK_REOPEN_DECLINED": return "NO";
      case "TASK_REOPEN_ACCEPTED": return "OK";
      case "TASK_WITHDRAWN": return "WD";
      case "FILE_UPLOADED": return "FILE";
      default: return "NOTE";
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'bg-purple-500',
      'verified': 'bg-green-500',
      'reopened': 'bg-orange-500',
      'failed': 'bg-red-500',
      'in_progress': 'bg-yellow-500',
      'accepted': 'bg-blue-500',
      'assigned': 'bg-gray-500',
      'declined_by_employee': 'bg-gray-700',
      'deleted': 'bg-gray-800',
      'withdrawn': 'bg-orange-700'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'completed': 'Awaiting Review',
      'verified': 'Verified',
      'reopened': 'Reopened',
      'failed': 'Failed',
      'in_progress': 'In Progress',
      'accepted': 'Accepted',
      'assigned': 'Assigned',
      'declined_by_employee': 'Declined',
      'deleted': 'Deleted',
      'withdrawn': 'Withdrawn'
    };
    return labels[status] || status;
  };

  const formatDateInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  // ==================== HANDLER FUNCTIONS ====================
  // Handle viewing performance snapshot for employee
  const handleViewPerformance = (employeeId, employeeName) => {
    if (!employeeId) {
      alert("No employee selected");
      return;
    }
    fetchPerformanceData(employeeId);
    setActiveSection("analytics");
    setActiveTab("performance");
  };

  // Navigate to employee insights with selected employee
  const handleViewEmployeeInsights = (employeeId) => {
    if (!employeeId) {
      alert("No employee selected");
      return;
    }
    navigate("/admin/employee-insights", { 
      state: { selectedEmployeeId: employeeId } 
    });
  };

  // Handle logout with confirmation
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  const toggleDiscussion = (taskId) => {
    setDiscussionOpen(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleExtendForm = (task) => {
    setExtendForms(prev => ({
      ...prev,
      [task._id]: {
        open: !prev[task._id]?.open,
        newDueDate: prev[task._id]?.newDueDate || formatDateInput(task.dueDate),
        reason: prev[task._id]?.reason || "",
        notificationRequired: prev[task._id]?.notificationRequired ?? true
      }
    }));
  };

  const handleExtendDueDate = async (taskId) => {
    const formData = extendForms[taskId];
    if (!formData?.newDueDate || !formData?.reason || formData.reason.trim().length < 5) {
      alert("New due date and reason (min 5 chars) are required");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/extend-due`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          newDueDate: formData.newDueDate,
          reason: formData.reason.trim(),
          notificationRequired: formData.notificationRequired
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extend due date");
      alert(" Due date extended");
      setExtendForms(prev => ({ ...prev, [taskId]: { ...prev[taskId], open: false } }));
      fetchTasks();
    } catch (err) {
      alert(` Error: ${err.message}`);
    }
  };

  const toggleReassignForm = (taskId) => {
    setReassignForms(prev => ({
      ...prev,
      [taskId]: {
        open: !prev[taskId]?.open,
        newEmployeeId: prev[taskId]?.newEmployeeId || "",
        reason: prev[taskId]?.reason || "",
        handoverNotes: prev[taskId]?.handoverNotes || ""
      }
    }));
  };

  const confirmByRisk = (riskLevel, contextMessage = "") => {
    if (riskLevel === "high") {
      if (confirmationPolicy.highRisk === "blocked_without_approval") {
        alert("High-risk action is blocked by policy without elevated approval.");
        return false;
      }
      if (confirmationPolicy.highRisk === "reason_required") {
        const reason = window.prompt(`Reason required for this high-risk action.${contextMessage ? `\n${contextMessage}` : ""}`);
        if (!reason || reason.trim().length < 5) {
          alert("Action cancelled. Reason is required (min 5 chars).");
          return false;
        }
        return true;
      }
    }
    if (riskLevel === "medium" && confirmationPolicy.mediumRisk !== "soft_confirm") {
      return window.confirm(contextMessage || "Confirm this action?");
    }
    if (riskLevel === "low" && confirmationPolicy.lowRisk !== "soft_confirm") {
      return window.confirm(contextMessage || "Confirm this action?");
    }
    return true;
  };

  const handleReassignTask = async (taskId) => {
    if (!hasCapability("manage_tasks")) {
      alert("Missing capability: manage_tasks");
      return;
    }
    const formData = reassignForms[taskId];
    if (!formData?.newEmployeeId) {
      alert("Please select an employee to reassign");
      return;
    }
    if (!confirmByRisk("medium", "Reassign task ownership to another employee?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/reassign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          newEmployeeId: formData.newEmployeeId,
          reason: formData.reason || "Admin reassignment",
          handoverNotes: formData.handoverNotes || ""
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reassign task");
      alert(" Task reassigned");
      setReassignForms(prev => ({ ...prev, [taskId]: { ...prev[taskId], open: false } }));
      fetchTasks();
    } catch (err) {
      alert(` Error: ${err.message}`);
    }
  };

  const handleExtensionDecision = async (taskId, requestId, decision, requestedExtension) => {
    if (!hasCapability("manage_requests")) {
      alert("Missing capability: manage_requests");
      return;
    }
    const note = (extensionReviewNotes[requestId] || "").trim();
    if (note.length < 5) {
      alert("Review note required (minimum 5 characters)");
      return;
    }

    const approvedDate = extensionApprovedDates[requestId] || requestedExtension || "";

    setExtensionActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/extension/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          decision,
          note,
          approvedDate: decision === "approve" ? approvedDate : undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process extension");
      }
      fetchTasks();
      setExtensionReviewNotes(prev => ({ ...prev, [requestId]: "" }));
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setExtensionActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const toggleFailForm = (taskId) => {
    setFailForms(prev => ({
      ...prev,
      [taskId]: {
        open: !prev[taskId]?.open,
        failureType: prev[taskId]?.failureType || "overdue_timeout",
        reason: prev[taskId]?.reason || "",
        archiveAfter: prev[taskId]?.archiveAfter || false,
        archiveNote: prev[taskId]?.archiveNote || ""
      }
    }));
  };

  const handleFailTask = async (taskId) => {
    if (!hasCapability("manage_reviews")) {
      alert("Missing capability: manage_reviews");
      return;
    }
    const formData = failForms[taskId];
    if (!formData?.reason || formData.reason.trim().length < 5) {
      alert("Failure reason required (min 5 chars)");
      return;
    }
    if (!confirmByRisk("high", "Mark this task as failed?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/fail`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          reason: formData.reason.trim(),
          failureType: formData.failureType
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark task as failed");
      if (formData.archiveAfter) {
        if (!formData.archiveNote || formData.archiveNote.trim().length < 5) {
          alert("Archive note required (min 5 chars)");
        } else {
          await handleArchiveTask(taskId, formData.archiveNote.trim());
        }
      }
      setFailForms(prev => ({ ...prev, [taskId]: { ...prev[taskId], open: false } }));
      fetchTasks();
    } catch (err) {
      alert(` Error: ${err.message}`);
    }
  };

  const handleArchiveTask = async (taskId, archiveNote) => {
    if (!hasCapability("manage_tasks")) {
      alert("Missing capability: manage_tasks");
      return;
    }
    if (!confirmByRisk("high", "Archive this task?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ archiveNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive task");
      alert(" Task archived");
      fetchTasks();
    } catch (err) {
      alert(` Error: ${err.message}`);
    }
  };

  const handleReopenTask = async (taskId) => {
    if (!hasCapability("manage_reviews")) {
      alert("Missing capability: manage_reviews");
      return;
    }
    try {
      const reason = window.prompt("Reopen reason (min 5 chars)");
      if (!reason || reason.trim().length < 5) {
        alert("Reopen reason must be at least 5 characters");
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/reopen`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reopen task");
      alert(" Task reopened");
      fetchTasks();
    } catch (err) {
      alert(` Error: ${err.message}`);
    }
  };

  const openTaskDetails = (taskId, returnOverride) => {
    navigate(`/task-details/${taskId}`, {
      state: {
        returnPath: "/admin",
        returnState: returnOverride || { activeSection, activeTab },
      }
    });
  };

  const openTaskInManagement = (taskId, tab = "auto") => {
    const task = tasks.find((t) => t._id === taskId);
    const status = String(task?.status || "").toLowerCase();

    const resolvedTab = (() => {
      if (tab && tab !== "auto") return tab;
      if (!task) return tab || "manage";
      if (["assigned", "accepted", "in_progress"].includes(status)) return "active";
      if (status === "completed") return "completed";
      if (status === "verified") return "verified";
      if (status === "reopened") return "reopened";
      if (status === "declined_by_employee") return "declined";
      if (status === "withdrawn") return "withdrawn";
      if (status === "failed") return "manage";
      if (task?.isArchived || ["deleted", "archived"].includes(status)) return "archived";
      return "manage";
    })();

    setOverviewFocusTaskId(taskId || null);
    setActiveSection("task");
    setActiveTab(resolvedTab);
    navigate("/admin", {
      state: {
        activeSection: "task",
        activeTab: resolvedTab,
        taskId: taskId || null
      }
    });
  };

  const openTaskInReviewCenter = (taskId) => {
    const task = tasks.find((t) => t._id === taskId);
    setActiveSection("review");
    setReviewScope("pending");
    setReviewLane("needs_review");
    setReviewQueuePage(1);
    if (task?.title) {
      setReviewSearch(task.title);
    }
    navigate("/admin", {
      state: {
        activeSection: "review"
      }
    });
  };

  const openTaskTimeline = (taskId, returnOverride) => {
    navigate(`/task-timeline/${taskId}`, {
      state: {
        returnPath: "/admin",
        returnState: returnOverride || { activeSection, activeTab },
      }
    });
  };

  const openTaskDetailsFromReview = (taskId) => {
    navigate(`/task-details/${taskId}`, {
      state: {
        returnPath: "/admin",
        returnState: { activeSection: "review" },
      }
    });
  };

  // ==================== RENDER SECTIONS ====================
  const renderSection = () => {
    if (!canAccessSection(activeSection)) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-sm text-gray-400 mt-2">
            Your current admin role does not have permission for this section.
          </p>
        </div>
      );
    }

    if (activeSection === "overview") {
      const {
        activeTasks,
        pendingReviews,
        overdueTasks,
        activeEmployees,
        completedToday,
        declinedToday,
        urgentTasks,
        pendingExtensions,
        pendingModifications,
        totalPendingRequests,
        archivedTasks,
        withdrawnTasks,
        totalTasks,
        todayMeetings,
        upcomingMeetings,
        pendingRSVPs
      } = dashboardMetrics;
      const expiredModCount = expiredModificationRequests.length;
      const slaBreachCount = overdueTasks.length + expiredModCount;

      return (
        <div className="space-y-6">
          <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Live Operations Feed</div>
                <div className="text-xs text-gray-400">
                  {liveCounters?.updatedAt ? `Updated ${formatDateTime(liveCounters.updatedAt)}` : "Waiting for first live snapshot"}
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded border ${
                liveConnectionState === "live"
                  ? "border-green-700 text-green-300 bg-green-900/20"
                  : liveConnectionState === "reconnecting"
                  ? "border-yellow-700 text-yellow-300 bg-yellow-900/20"
                  : "border-gray-700 text-gray-300 bg-gray-900/30"
              }`}>
                {liveConnectionState}
              </div>
            </div>
            {liveCounters && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Active: <span className="font-semibold">{liveCounters.activeTasks ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Overdue: <span className="font-semibold">{liveCounters.overdueTasks ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Reviews: <span className="font-semibold">{liveCounters.pendingReviews ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Req Total: <span className="font-semibold">{liveCounters.totalPendingRequests ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Ext: <span className="font-semibold">{liveCounters.pendingExtensions ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Mod: <span className="font-semibold">{liveCounters.pendingModifications ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">Reopen: <span className="font-semibold">{liveCounters.pendingReopens ?? 0}</span></div>
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-2">SLA Breach: <span className="font-semibold text-red-300">{liveCounters.slaBreached ?? 0}</span></div>
              </div>
            )}
          </div>

          {/* ==================== NOTIFICATION BAR ==================== */}
          <div className="space-y-3">
            {/* Today's Meetings Notification */}
            {todayMeetings.length > 0 && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 text-xs font-semibold">MEET</span>
                  <div className="flex-1">
                    <h4 className="font-semibold">Today's Meetings</h4>
                    <p className="text-sm text-gray-300">
                      {todayMeetings.length} meeting(s) scheduled for today
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveSection("meetings")}
                    className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded text-sm"
                  >
                    View Schedule
                  </button>
                </div>
              </div>
            )}

            {/* Employee Completed Tasks Notification */}
            {completedToday.length > 0 && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-xs font-semibold">DONE</span>
                  <div className="flex-1">
                    <h4 className="font-semibold">New Task Completions</h4>
                    <p className="text-sm text-gray-300">
                      {completedToday.length} task(s) completed by employees today
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveSection("review")}
                    className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded text-sm"
                  >
                    Review Now
                  </button>
                </div>
              </div>
            )}

            {/* Combined Pending Requests Notification */}
            {totalPendingRequests > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 text-xs font-semibold">REQ</span>
                  <div className="flex-1">
                    <h4 className="font-semibold">Pending Requests</h4>
                    <p className="text-sm text-gray-300">
                      {totalPendingRequests} total request(s) pending your review
                    </p>
                    <div className="text-xs text-gray-400 mt-1 flex gap-4">
                      {pendingExtensions > 0 && (
                        <span> {pendingExtensions} extension(s)</span>
                      )}
                      {pendingModifications > 0 && (
                        <span> {pendingModifications} modification(s)</span>
                      )}
                      {expiredModCount > 0 && (
                        <span className="text-red-300">SLA expired: {expiredModCount}</span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSection("pendingRequests")}
                    className="bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded text-sm"
                  >
                    Review Requests
                  </button>
                </div>
              </div>
            )}

            {/* Employee Declined Tasks Notification */}
            {declinedToday.length > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-red-400 text-xs font-semibold">DECL</span>
                  <div className="flex-1">
                    <h4 className="font-semibold">Task Declinations</h4>
                    <p className="text-sm text-gray-300">
                      {declinedToday.length} task(s) declined by employees today
                    </p>
                    {declinedToday[0]?.declineReason && (
                      <p className="text-xs text-gray-400 mt-1">
                        Latest reason: "{declinedToday[0].declineReason}"
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setActiveSection("task");
                      setActiveTab("declined");
                    }}
                    className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm"
                  >
                    View Tasks
                  </button>
                </div>
              </div>
            )}

            {/* Withdrawn Tasks Notification */}
            {withdrawnTasks.length > 0 && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 text-xs font-semibold">WD</span>
                  <div className="flex-1">
                    <h4 className="font-semibold">Withdrawn Tasks</h4>
                    <p className="text-sm text-gray-300">
                      {withdrawnTasks.length} task(s) withdrawn by employees
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveSection("task");
                      setActiveTab("withdrawn");
                    }}
                    className="bg-orange-700 hover:bg-orange-600 px-4 py-2 rounded text-sm"
                  >
                    Review & Reassign
                  </button>
                </div>
              </div>
            )}

            {/* Urgent Tasks Notification */}
            {urgentTasks.length > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 text-xs font-semibold">URG</span>
                  <div className="flex-1">
                    <h4 className="font-semibold">Urgent Deadlines</h4>
                    <p className="text-sm text-gray-300">
                      {urgentTasks.length} task(s) due today or tomorrow
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const urgentTaskId = urgentTasks[0]?._id || null;
                      openTaskInManagement(urgentTaskId, "active");
                    }}
                    className="bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded text-sm"
                  >
                    Take Action
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">Admin Home Queues</h3>
                <p className="text-xs text-gray-400">Priority buckets to keep actions structured and enterprise-ready.</p>
              </div>
              <div className="text-xs text-gray-400">
                Needs Action: {adminHomeQueues.needsAction.length} | At Risk: {adminHomeQueues.atRisk.length} | Informational: {adminHomeQueues.informational.length}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-red-800 rounded p-3">
                <div className="text-sm font-semibold text-red-300 mb-2">Needs Action</div>
                <div className="space-y-2 max-h-44 overflow-auto">
                  {adminHomeQueues.needsAction.length === 0 ? (
                    <div className="text-xs text-gray-500">No immediate actions.</div>
                  ) : adminHomeQueues.needsAction.map((item) => (
                    <button
                      key={`na-${item.id}-${item.type}`}
                      onClick={() => openTaskInManagement(item.id, item.type === "review" ? "completed" : "manage")}
                      className="w-full text-left text-xs bg-gray-800 border border-gray-700 rounded p-2 hover:border-red-500"
                    >
                      <div className="text-gray-200 font-medium truncate">{item.title}</div>
                      <div className="text-gray-400">{item.note}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 border border-yellow-800 rounded p-3">
                <div className="text-sm font-semibold text-yellow-300 mb-2">At Risk</div>
                <div className="space-y-2 max-h-44 overflow-auto">
                  {adminHomeQueues.atRisk.length === 0 ? (
                    <div className="text-xs text-gray-500">No at-risk items.</div>
                  ) : adminHomeQueues.atRisk.map((item) => (
                    <button
                      key={`ar-${item.id}-${item.type}`}
                      onClick={() => {
                        const tab =
                          item.type === "withdrawn"
                            ? "withdrawn"
                            : item.type === "assignment_decline" || item.type === "reopen_decline"
                            ? "declined"
                            : "overdue";
                        openTaskInManagement(item.id, tab);
                      }}
                      className="w-full text-left text-xs bg-gray-800 border border-gray-700 rounded p-2 hover:border-yellow-500"
                    >
                      <div className="text-gray-200 font-medium truncate">{item.title}</div>
                      <div className="text-gray-400">{item.note}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 border border-blue-800 rounded p-3">
                <div className="text-sm font-semibold text-blue-300 mb-2">Informational</div>
                <div className="space-y-2 max-h-44 overflow-auto">
                  {adminHomeQueues.informational.length === 0 ? (
                    <div className="text-xs text-gray-500">No informational updates.</div>
                  ) : adminHomeQueues.informational.map((item) => (
                    <button
                      key={`info-${item.id}-${item.type}`}
                      onClick={() => openTaskInManagement(item.id, "manage")}
                      className="w-full text-left text-xs bg-gray-800 border border-gray-700 rounded p-2 hover:border-blue-500"
                    >
                      <div className="text-gray-200 font-medium truncate">{item.title}</div>
                      <div className="text-gray-400">{item.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ==================== KPI CARDS ==================== */}
          <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Tasks KPI */}
            <div
              className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-[#263340]"
              onClick={() => {
                setActiveSection("task");
                setActiveTab("active");
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Tasks</p>
                  <p className="text-3xl font-bold mt-2">{activeTasks.length}</p>
                  <p className="text-xs text-gray-500 mt-1">assigned | accepted | in_progress | reopened</p>
                </div>
                <div className="text-xs text-blue-400 font-semibold">TASK</div>
              </div>
            </div>

            {/* Pending Reviews KPI */}
            <div
              className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-yellow-500 cursor-pointer hover:bg-[#263340]"
              onClick={() => setActiveSection("review")}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Pending Reviews</p>
                  <p className="text-3xl font-bold mt-2">{pendingReviews.length}</p>
                  <p className="text-xs text-gray-500 mt-1">completed tasks awaiting review</p>
                </div>
                <div className="text-xs text-yellow-400 font-semibold">REVIEW</div>
              </div>
            </div>

            {/* Overdue Tasks KPI */}
            <div
              className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-red-500 cursor-pointer hover:bg-[#263340]"
              onClick={() => {
                setActiveSection("task");
                setActiveTab("overdue");
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Overdue Tasks</p>
                  <p className="text-3xl font-bold mt-2">{overdueTasks.length}</p>
                  <p className="text-xs text-gray-500 mt-1">tasks past due date</p>
                </div>
                <div className="text-xs text-red-400 font-semibold">OVER</div>
              </div>
              {overdueTasks.length > 0 && totalTasks > 0 && (
                <div className="mt-4">
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500"
                      style={{ width: `${Math.min(overdueTasks.length / totalTasks * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round((overdueTasks.length / totalTasks) * 100)}% of total tasks
                  </p>
                </div>
              )}
            </div>

            {/* Active Employees KPI */}
            <div
              className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-green-500 cursor-pointer hover:bg-[#263340]"
              onClick={() => {
                setActiveSection("employee");
                setEmployeeStatusFilter("active");
                setEmployeeDefaultTab("list");
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Employees</p>
                  <p className="text-3xl font-bold mt-2">{activeEmployees.length}</p>
                  <p className="text-xs text-gray-500 mt-1">employees currently active</p>
                </div>
                <div className="text-xs text-green-400 font-semibold">EMP</div>
              </div>
            </div>
          </div>

          {/* ==================== ADDITIONAL METRICS ==================== */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            {/* Meetings Today Card */}
            <div className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-blue-400">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Today's Meetings</p>
                  <p className="text-3xl font-bold mt-2">{todayMeetings.length}</p>
                  <p className="text-xs text-gray-500 mt-1">scheduled for today</p>
                </div>
                <div className="text-xs text-blue-300 font-semibold">MEET</div>
              </div>
              {todayMeetings.length > 0 && (
                <button 
                  onClick={() => setActiveSection("meetings")}
                  className="mt-3 w-full py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm"
                >
                  View Schedule
                </button>
              )}
            </div>

            {/* Pending Requests Card (Combined) */}
            <div className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-yellow-400">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Pending Requests</p>
                  <p className="text-3xl font-bold mt-2">{totalPendingRequests}</p>
                  <p className="text-xs text-gray-500 mt-1">extensions + modifications</p>
                </div>
                <div className="text-xs text-yellow-300 font-semibold">REQ</div>
              </div>
              {totalPendingRequests > 0 && (
                <button 
                  onClick={() => setActiveSection("pendingRequests")}
                  className="mt-3 w-full py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-sm"
                >
                  Review Now
                </button>
              )}
            </div>

            {/* Archived Tasks Card */}
            <div className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-purple-400">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Archived Tasks</p>
                  <p className="text-3xl font-bold mt-2">{archivedTasks.length}</p>
                  <p className="text-xs text-gray-500 mt-1">completed & archived</p>
                </div>
                <div className="text-xs text-purple-300 font-semibold">ARCH</div>
              </div>
              {archivedTasks.length > 0 && (
                <button 
                  onClick={() => {
                    setActiveSection("task");
                    setActiveTab("archived");
                  }}
                  className="mt-3 w-full py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm"
                >
                  View Archive
                </button>
              )}
            </div>

            {/* Withdrawn Tasks Card */}
            <div className="bg-[#1f2933] p-5 rounded-lg border-l-4 border-orange-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Withdrawn Tasks</p>
                  <p className="text-3xl font-bold mt-2">{withdrawnTasks.length}</p>
                  <p className="text-xs text-gray-500 mt-1">need reassignment</p>
                </div>
                <div className="text-xs text-orange-400 font-semibold">WD</div>
              </div>
              {withdrawnTasks.length > 0 && (
                <button 
                  onClick={() => {
                    setActiveSection("task");
                    setActiveTab("withdrawn");
                  }}
                  className="mt-3 w-full py-2 bg-orange-700 hover:bg-orange-600 rounded text-sm"
                >
                  Reassign
                </button>
              )}
            </div>
          </div>

          {/* ==================== SYSTEM ALERTS ==================== */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">System Status</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SLA Breaches Alert */}
              <div className={`border rounded p-4 ${slaBreachCount > 0 ? 'border-red-700 bg-red-900/30' : 'border-green-700 bg-green-900/30'}`}>
                <div className="flex items-center gap-2">
                  <span className={slaBreachCount > 0 ? 'text-red-400 text-xs font-semibold' : 'text-green-400 text-xs font-semibold'}>
                    {totalTasks === 0 ? 'NEW' : slaBreachCount > 0 ? 'ALERT' : 'OK'}
                  </span>
                  <span className="font-medium">
                    {totalTasks === 0 ? 'No Task Data Yet' : slaBreachCount > 0 ? 'SLA Breaches Detected' : 'No SLA Breaches'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {totalTasks === 0
                    ? 'Create your first task to start SLA monitoring.'
                    : slaBreachCount > 0 
                    ? `${overdueTasks.length} task(s) overdue${expiredModCount > 0 ? ` and ${expiredModCount} modification request(s) expired` : ''}.`
                    : 'All tasks are within their SLA deadlines.'}
                </p>
              </div>

              {/* Tasks Awaiting Admin Action */}
              <div className={`border rounded p-4 ${pendingReviews.length > 0 ? 'border-yellow-700 bg-yellow-900/30' : 'border-gray-700 bg-gray-800/30'}`}>
                <div className="flex items-center gap-2">
                  <span className={pendingReviews.length > 0 ? 'text-yellow-400 text-xs font-semibold' : 'text-gray-400 text-xs font-semibold'}>
                    {totalTasks === 0 ? 'NEW' : pendingReviews.length > 0 ? 'PEND' : 'OK'}
                  </span>
                  <span className="font-medium">
                    {totalTasks === 0 ? 'No Reviews Yet' : pendingReviews.length > 0 ? 'Tasks Awaiting Review' : 'All Tasks Reviewed'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {totalTasks === 0
                    ? 'Reviews appear after employees submit completed tasks.'
                    : pendingReviews.length > 0
                    ? `${pendingReviews.length} completed task(s) are pending your review and approval.`
                    : 'No pending reviews at this time.'}
                </p>
              </div>
            </div>
          </div>

          {/* ==================== QUICK STATS ==================== */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Task Status Distribution */}
            <div className="bg-[#1f2933] p-4 rounded">
              <h4 className="font-semibold text-gray-300 mb-3">Task Status Distribution</h4>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Assigned", status: "assigned", color: "gray" },
                  { label: "In Progress", status: "in_progress", color: "blue" },
                  { label: "Completed", status: "completed", color: "purple" },
                  { label: "Verified", status: "verified", color: "green" },
                  { label: "Failed/Declined", statuses: ["failed", "declined_by_employee"], color: "red" },
                  { label: "Reopened", status: "reopened", color: "orange" },
                  { label: "Withdrawn", status: "withdrawn", color: "yellow" },
                ].map(item => {
                  const count = item.statuses 
                    ? tasks.filter(t => item.statuses.includes(t.status)).length
                    : tasks.filter(t => t.status === item.status).length;
                  
                  const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                  
                  return (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-${item.color}-500`}></div>
                        <span className="text-gray-300">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-white">{count}</span>
                        <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-[#1f2933] p-4 rounded">
              <h4 className="font-semibold text-gray-300 mb-3">Recent Activity</h4>
              <div className="space-y-3">
                {tasks
                  .slice()
                  .sort((a, b) => {
                    const aLatest = (a.activityTimeline || []).slice().sort((x, y) => new Date(y.timestamp || y.createdAt || 0) - new Date(x.timestamp || x.createdAt || 0))[0];
                    const bLatest = (b.activityTimeline || []).slice().sort((x, y) => new Date(y.timestamp || y.createdAt || 0) - new Date(x.timestamp || x.createdAt || 0))[0];
                    const aTime = new Date(aLatest?.timestamp || aLatest?.createdAt || a.updatedAt || 0).getTime();
                    const bTime = new Date(bLatest?.timestamp || bLatest?.createdAt || b.updatedAt || 0).getTime();
                    return bTime - aTime;
                  })
                  .slice(0, 5)
                  .map(task => {
                    const timeline = (task.activityTimeline || [])
                      .slice()
                      .sort((x, y) => new Date(y.timestamp || y.createdAt || 0) - new Date(x.timestamp || x.createdAt || 0));
                    const latest = timeline[0];
                    return (
                      <div key={task._id} className="p-3 border border-gray-700 rounded bg-[#111827]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-white truncate">{task.title}</div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-300 whitespace-nowrap">
                            {(task.status || "unknown").replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {task.assignedTo?.name || "Unassigned"} � {formatDate(task.updatedAt || task.createdAt)}
                        </div>
                        <div className="mt-2 text-xs text-gray-300">
                          <div className="font-medium text-gray-400 mb-1">Latest timeline</div>
                          {(timeline.length > 0 ? timeline.slice(0, 2) : [{ action: "UPDATED", details: "No timeline details", timestamp: task.updatedAt }]).map((evt, idx) => (
                            <div key={idx} className="truncate">
                              {(evt.action || "UPDATED").replace(/_/g, " ").toLowerCase()} � {formatDateTime(evt.timestamp || evt.createdAt)}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <button
                            onClick={() => task.assignedTo?._id && handleViewPerformance(task.assignedTo._id, task.assignedTo?.name || "Employee")}
                            className="bg-green-700 hover:bg-green-600 px-2 py-1 rounded"
                          >
                            View Performance
                          </button>
                          <button
                            onClick={() => openTaskTimeline(task._id)}
                            className="bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded"
                          >
                            Work Timeline
                          </button>
                          <button
                            onClick={() => openTaskDetails(task._id)}
                            className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                          >
                            Task Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Employee Performance */}
            <div className="bg-[#1f2933] p-4 rounded">
              <h4 className="font-semibold text-gray-300 mb-3">Top Performers</h4>
              <div className="space-y-3">
                {topPerformerRows.slice(0, 3).map((emp) => (
                  <div key={emp.id} className="p-2 border border-gray-700 rounded">
                    <div className="flex justify-between items-center">
                      <div className="font-medium truncate pr-2 text-white">{emp.name}</div>
                      <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">
                        Score {emp.compositeScore}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Verified {emp.verifiedCount}/{emp.totalAssigned} | Pending review {emp.pendingReview}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleViewPerformance(emp.id, emp.name)}
                        className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded"
                      >
                        Performance
                      </button>
                      <button
                        onClick={() => handleViewEmployeeInsights(emp.id)}
                        className="text-xs bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded"
                      >
                        Insights
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "employee") {
      return <EmployeeManagement statusFilter={employeeStatusFilter} defaultTab={employeeDefaultTab} />;
    }

    if (activeSection === "employeeInsights") {
      return <EmployeeInsights />;
    }

    if (activeSection === "meetings") {
      return <MeetingManager canManage={hasCapability("manage_meetings")} canViewAnalytics={hasCapability("view_analytics")} />;
    }

    if (activeSection === "community") {
      return <CommunityFeed />;
    }

    if (activeSection === "notices") {
      return <AdminNoticePanel />;
    }

    if (activeSection === "analytics") {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Analytics & Intelligence</h2>
          
          {loadingAnalytics && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-center">
              <span className="text-blue-400">Loading analytics data...</span>
            </div>
          )}
          
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveTab("performance")}
              className={`px-4 py-2 rounded ${
                activeTab === "performance"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
               Performance Snapshots
            </button>
            <button
              onClick={() => setActiveTab("failures")}
              className={`px-4 py-2 rounded ${
                activeTab === "failures"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
               Failure Intelligence
            </button>
            <button
              onClick={() => setActiveTab("statistics")}
              className={`px-4 py-2 rounded ${
                activeTab === "statistics"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
               System Statistics
            </button>
          </div>

          {activeTab === "performance" && (
            <div className="space-y-6">
              <PerformanceSnapshot />
              {performanceData && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Current Employee Performance</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Employee</p>
                      <p className="font-medium">{performanceData.employee?.name}</p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Verification Rate</p>
                      <p className="font-medium">{performanceData.metrics?.verificationRate}%</p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">On-Time Rate</p>
                      <p className="font-medium">{performanceData.metrics?.onTimeRate}%</p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Avg Completion Time</p>
                      <p className="font-medium">{performanceData.metrics?.avgCompletionTime} hours</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Total Tasks</p>
                      <p className="font-medium">{performanceData.metrics?.totalTasks}</p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Verified Tasks</p>
                      <p className="font-medium">{performanceData.metrics?.verified}</p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Reopened Rate</p>
                      <p className="font-medium">{performanceData.metrics?.reopenRate}%</p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded">
                      <p className="text-sm text-gray-400">Extended Tasks</p>
                      <p className="font-medium">{performanceData.metrics?.extended}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === "failures" && <FailureAnalytics />}
          
          {activeTab === "statistics" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-lg border border-slate-600/60 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">System Statistics</h3>
                    <p className="text-sm text-gray-300">Real-time executive snapshot of workload, quality, workforce, and operations.</p>
                  </div>
                  <div className="text-xs text-gray-400 bg-slate-900/60 border border-slate-700 rounded px-3 py-2">
                    Live snapshot based on current data
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mt-5">
                  <div className="bg-slate-900/80 p-4 rounded border border-slate-700">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Total Tasks</p>
                    <p className="text-2xl font-bold mt-1">{systemStats.totalTasks}</p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded border border-blue-900/60">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Active Tasks</p>
                    <p className="text-2xl font-bold text-blue-300 mt-1">{systemStats.activeTasks}</p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded border border-red-900/60">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Overdue Open</p>
                    <p className="text-2xl font-bold text-red-300 mt-1">{systemStats.overdueTasks}</p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded border border-orange-900/60">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Urgent (24h)</p>
                    <p className="text-2xl font-bold text-orange-300 mt-1">{systemStats.urgentTasks}</p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded border border-green-900/60">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Verification Rate</p>
                    <p className="text-2xl font-bold text-green-300 mt-1">{systemStats.verificationRate}%</p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded border border-yellow-900/60">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Failure Rate</p>
                    <p className="text-2xl font-bold text-yellow-300 mt-1">{systemStats.failureRate}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm lg:col-span-1">
                  <h4 className="font-semibold mb-4">KPI Trend (Last 7 Days)</h4>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Tasks Created", data: kpiDeltas.created, goodWhenPositive: true, onOpen: () => { setActiveSection("task"); setActiveTab("manage"); } },
                      { label: "Tasks Completed", data: kpiDeltas.completed, goodWhenPositive: true, onOpen: () => { setActiveSection("task"); setActiveTab("completed"); } },
                      { label: "Tasks Failed", data: kpiDeltas.failed, goodWhenPositive: false, onOpen: () => { setActiveSection("task"); setActiveTab("declined"); } },
                      { label: "Tasks Reopened", data: kpiDeltas.reopened, goodWhenPositive: false, onOpen: () => { setActiveSection("task"); setActiveTab("reopened"); } }
                    ].map((item) => {
                      const delta = item.data.delta;
                      const improved = item.goodWhenPositive ? delta >= 0 : delta <= 0;
                      return (
                        <button
                          type="button"
                          key={item.label}
                          onClick={item.onOpen}
                          className="w-full flex items-center justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2 hover:border-blue-500"
                        >
                          <span className="text-gray-300">{item.label}</span>
                          <span className={`font-semibold ${improved ? "text-green-300" : "text-red-300"}`}>
                            {delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">SLA Operations Center</h4>
                    <span className="text-xs text-gray-400">{slaOperations.total} open</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <div className="bg-red-900/20 border border-red-800 rounded p-2 text-center">
                      <div className="text-gray-400">Breached</div>
                      <div className="text-lg font-bold text-red-300">{slaOperations.breached}</div>
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-800 rounded p-2 text-center">
                      <div className="text-gray-400">At Risk</div>
                      <div className="text-lg font-bold text-yellow-300">{slaOperations.atRisk}</div>
                    </div>
                    <div className="bg-green-900/20 border border-green-800 rounded p-2 text-center">
                      <div className="text-gray-400">Healthy</div>
                      <div className="text-lg font-bold text-green-300">{slaOperations.healthy}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Aging 0-24h</span>
                      <span className="font-semibold">{slaOperations.aging["0_24"]}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Aging 24-48h</span>
                      <span className="font-semibold">{slaOperations.aging["24_48"]}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Aging 48h+</span>
                      <span className="font-semibold text-red-300">{slaOperations.aging["48_plus"]}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveSection("pendingRequests");
                      setActiveTab("modifications");
                    }}
                    className="mt-4 w-full px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 text-sm"
                  >
                    Open Request Queue
                  </button>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Data Health</h4>
                    <span className={`text-xs px-2 py-1 rounded ${dataHealth.score === 0 ? "bg-green-900/30 text-green-300" : "bg-yellow-900/30 text-yellow-300"}`}>
                      {dataHealth.score === 0 ? "Healthy" : `${dataHealth.score} issue(s)`}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Missing assignee</span>
                      <span className="font-semibold">{dataHealth.tasksMissingAssignee}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Active without due date</span>
                      <span className="font-semibold">{dataHealth.activeWithoutDueDate}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Overdue flag mismatch</span>
                      <span className="font-semibold">{dataHealth.overdueWithoutFlag}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Scheduled but in past</span>
                      <span className="font-semibold">{dataHealth.scheduledPastMeetings}</span>
                    </div>
                    <div className="flex justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2">
                      <span className="text-gray-300">Notices with no recipients</span>
                      <span className="font-semibold">{dataHealth.noticesWithoutRecipients}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setActiveSection("task");
                        setActiveTab("manage");
                      }}
                      className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-xs"
                    >
                      Review Tasks
                    </button>
                    <button
                      onClick={() => setActiveSection("meetings")}
                      className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-xs"
                    >
                      Review Meetings
                    </button>
                    <button
                      onClick={() => setActiveSection("notices")}
                      className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-xs"
                    >
                      Review Notices
                    </button>
                    <button
                      onClick={() => setActiveSection("employee")}
                      className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-xs"
                    >
                      Validate Assignees
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Workload & Quality</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Completed</div>
                      <div className="text-xl font-bold">{systemStats.completedTasks}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-green-900/50">
                      <div className="text-gray-400">Verified</div>
                      <div className="text-xl font-bold text-green-400">{systemStats.verifiedTasks}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-red-900/50">
                      <div className="text-gray-400">Failed</div>
                      <div className="text-xl font-bold text-red-400">{systemStats.failedTasks}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Archived</div>
                      <div className="text-xl font-bold">{systemStats.archivedTasks}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-orange-900/50">
                      <div className="text-gray-400">Failure Rate</div>
                      <div className="text-xl font-bold text-orange-400">{systemStats.failureRate}%</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-green-900/50">
                      <div className="text-gray-400">Verification Rate</div>
                      <div className="text-xl font-bold text-green-400">{systemStats.verificationRate}%</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Workforce</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-900 p-3 rounded border border-blue-900/50">
                      <div className="text-gray-400">Active Employees</div>
                      <div className="text-xl font-bold text-blue-300">{systemStats.activeEmployees}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Total Employees</div>
                      <div className="text-xl font-bold">{systemStats.employeeCount}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Admins</div>
                      <div className="text-xl font-bold">{systemStats.adminCount}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-yellow-900/50">
                      <div className="text-gray-400">Withdrawn Tasks</div>
                      <div className="text-xl font-bold text-yellow-400">{systemStats.withdrawnTasks}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Requests & Operations</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Pending Extensions</div>
                      <div className="text-xl font-bold">{systemStats.requestQueue.pendingExtensions}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Pending Modifications</div>
                      <div className="text-xl font-bold">{systemStats.requestQueue.pendingModifications}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Pending Reopens</div>
                      <div className="text-xl font-bold">{systemStats.requestQueue.pendingReopens}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-yellow-900/50">
                      <div className="text-gray-400">Total Pending</div>
                      <div className="text-xl font-bold text-yellow-400">{systemStats.requestQueue.totalPending}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Meetings & Notices</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Meetings Today</div>
                      <div className="text-xl font-bold">{dashboardMetrics.todayMeetings.length}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Upcoming Meetings</div>
                      <div className="text-xl font-bold">{dashboardMetrics.upcomingMeetings.length}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Pending RSVPs</div>
                      <div className="text-xl font-bold">{dashboardMetrics.pendingRSVPs}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Notices Sent</div>
                      <div className="text-xl font-bold">{systemStats.noticesTotal}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-gray-700">
                      <div className="text-gray-400">Polls</div>
                      <div className="text-xl font-bold">{systemStats.pollsTotal}</div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-900/50">
                      <div className="text-gray-400">Active Polls</div>
                      <div className="text-xl font-bold text-blue-400">{systemStats.activePolls}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Cohort by Priority</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(cohortAnalytics.byPriority).length === 0 ? (
                      <div className="text-gray-500 text-xs">No priority cohorts found.</div>
                    ) : Object.entries(cohortAnalytics.byPriority).map(([priority, stats]) => (
                      <div key={priority} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 flex justify-between">
                        <span className="text-gray-300 capitalize">{priority}</span>
                        <span className="text-gray-400">
                          {stats.total} total | <span className="text-red-300">{stats.overdue} overdue</span> | <span className="text-yellow-300">{stats.failed} failed</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Top Assignees</h4>
                  <div className="space-y-2 text-sm">
                    {cohortAnalytics.topAssignees.length === 0 ? (
                      <div className="text-gray-500 text-xs">No assignee data found.</div>
                    ) : cohortAnalytics.topAssignees.map(([name, stats]) => (
                      <div key={name} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 flex justify-between">
                        <span className="text-gray-300 truncate max-w-[55%]">{name}</span>
                        <span className="text-gray-400">
                          {stats.total} total | <span className="text-green-300">{stats.completed} done</span> | <span className="text-red-300">{stats.failed} failed</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-sm">
                  <h4 className="font-semibold mb-4">Top Departments/Categories</h4>
                  <div className="space-y-2 text-sm">
                    {cohortAnalytics.topDepartments.length === 0 ? (
                      <div className="text-gray-500 text-xs">No department/category cohorts found.</div>
                    ) : cohortAnalytics.topDepartments.map(([name, stats]) => (
                      <div key={name} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 flex justify-between">
                        <span className="text-gray-300 truncate max-w-[55%]">{name}</span>
                        <span className="text-gray-400">
                          {stats.total} total | <span className="text-green-300">{stats.completed} complete</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === "notifications") {
      return (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-semibold">Notifications</h2>
                <p className="text-sm text-gray-400">All recent activity across tasks, meetings, and notices.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOnlyNewNotifications}
                    onChange={(e) => setShowOnlyNewNotifications(e.target.checked)}
                    className="accent-blue-600"
                  />
                  Show only new
                </label>
                <button
                  onClick={() => {
                    const now = new Date().toISOString();
                    setNotificationsClearedAt(now);
                    setShowOnlyNewNotifications(true);
                  }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                >
                  Clear (Persistent)
                </button>
              </div>
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
                  onClick={() => setNotificationSourceFilter(key)}
                  className={`text-xs px-3 py-2 rounded border ${
                    notificationSourceFilter === key
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Source</label>
                <select
                  value={notificationSourceFilter}
                  onChange={(e) => setNotificationSourceFilter(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="task">Tasks</option>
                  <option value="request">Requests</option>
                  <option value="meeting">Meetings</option>
                  <option value="notice">Notices</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Action</label>
                <select
                  value={notificationActionFilter}
                  onChange={(e) => setNotificationActionFilter(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm"
                >
                  <option value="all">All</option>
                  {notificationActionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Search</label>
                <input
                  type="text"
                  value={notificationSearch}
                  onChange={(e) => setNotificationSearch(e.target.value)}
                  placeholder="Search by task, details, action..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#1f2933] p-4 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-300">Recent Activity</h4>
              <span className="text-xs text-gray-500">Latest 30 activities</span>
            </div>
            {visibleNotifications.length === 0 ? (
              <div className="text-gray-500 text-sm">No recent activity yet.</div>
            ) : (
              <div className="space-y-2">
                {visibleNotifications.map((evt, idx) => {
                  const sourceLabel = evt.source ? evt.source.charAt(0).toUpperCase() + evt.source.slice(1) : "Update";
                  const sourceBadge = evt.source === "request"
                    ? "bg-orange-900/30 text-orange-300"
                    : evt.source === "meeting"
                    ? "bg-purple-900/30 text-purple-300"
                    : evt.source === "notice"
                    ? "bg-amber-900/30 text-amber-300"
                    : "bg-blue-900/30 text-blue-300";
                  return (
                    <div
                      key={`${evt.taskId || evt.taskTitle || "event"}-${idx}`}
                      className="p-4 border border-gray-800 rounded bg-[#0f172a]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="text-lg">{getActionIcon(evt.action)}</div>
                          <div>
                            <div className="text-sm text-gray-200">
                              <span className="font-medium">{formatActionLabel(evt.action)}</span>
                              {evt.taskTitle && (
                                <span className="text-gray-400">  {evt.taskTitle}</span>
                              )}
                            </div>
                            {evt.details && (
                              <div className="text-xs text-gray-400 mt-1">{evt.details}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {evt.role ? `${evt.role}  ` : ""}{formatDateTime(evt.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded ${sourceBadge}`}>{sourceLabel}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {evt.taskId && (
                          <>
                            <button
                              onClick={() => openTaskInManagement(evt.taskId, "manage")}
                              className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                            >
                              Open Task
                            </button>
                            <button
                              onClick={() => openTaskTimeline(evt.taskId, { activeSection: "notifications" })}
                              className="text-xs bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded"
                            >
                              Timeline
                            </button>
                          </>
                        )}
                        {evt.source === "request" && (
                          <button
                            onClick={() => setActiveSection("pendingRequests")}
                            className="text-xs bg-orange-700 hover:bg-orange-600 px-2 py-1 rounded"
                          >
                            Open Requests
                          </button>
                        )}
                        {evt.source === "meeting" && (
                          <button
                            onClick={() => setActiveSection("meetings")}
                            className="text-xs bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded"
                          >
                            View Meetings
                          </button>
                        )}
                        {evt.source === "notice" && (
                          <button
                            onClick={() => setActiveSection("notices")}
                            className="text-xs bg-amber-700 hover:bg-amber-600 px-2 py-1 rounded"
                          >
                            View Notices
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeSection === "system") {
      return (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-semibold">System Governance Center</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Audit readiness, role permissions, and notification policy controls.
                </p>
              </div>
              <div className="text-xs text-gray-400 bg-gray-900 border border-gray-700 rounded px-3 py-2">
                {syncHealth.overall === "live"
                  ? "Live"
                  : syncHealth.overall === "delayed"
                  ? "Delayed"
                  : syncHealth.overall === "reconnecting"
                  ? "Reconnecting"
                  : "Sync issue"}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              {syncHealth.statuses.map((item) => (
                <div key={item.key} className="text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1">
                  <span className="text-gray-400 uppercase">{item.key}</span>
                  <span className={`ml-2 ${
                    item.state === "live"
                      ? "text-green-300"
                      : item.state === "delayed"
                      ? "text-yellow-300"
                      : item.state === "error"
                      ? "text-red-300"
                      : "text-blue-300"
                  }`}>
                    {item.state}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 items-center">
              {[
                { key: "overview", label: "Overview", requiredCapability: null },
                { key: "guide", label: "User Guide", requiredCapability: null },
                { key: "audit", label: "Audit Log", requiredCapability: "view_audit_log" },
                { key: "rbac", label: "Role Matrix", requiredCapability: null },
                { key: "notify_policy", label: "Notification Policy", requiredCapability: "manage_notification_policy" }
              ]
                .filter((tab) => hasCapability(tab.requiredCapability))
                .map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSystemTab(tab.key)}
                  className={`px-3 py-2 rounded text-sm border ${
                    systemTab === tab.key
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="ml-auto text-xs text-gray-400">
                Role: <span className="text-gray-200 uppercase">{adminCapabilityData.role || user?.role || "admin"}</span>
              </div>
            </div>
          </div>

          {systemTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#1f2933] p-4 rounded-lg border border-gray-700">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Platform Health</div>
                  <div className="text-2xl font-bold text-green-300 mt-1">{syncHealth.overall.toUpperCase()}</div>
                  <div className="text-xs text-gray-400 mt-1">{syncHealth.statuses.filter(s => s.state === "live").length}/{syncHealth.statuses.length} channels live</div>
                </div>
                <div className="bg-[#1f2933] p-4 rounded-lg border border-gray-700">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Governance</div>
                  <div className="text-2xl font-bold text-blue-300 mt-1">{systemStats.adminCount}</div>
                  <div className="text-xs text-gray-400 mt-1">Admin operators with capability controls</div>
                </div>
                <div className="bg-[#1f2933] p-4 rounded-lg border border-gray-700">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Operational Load</div>
                  <div className="text-2xl font-bold text-yellow-300 mt-1">{systemStats.requestQueue.totalPending}</div>
                  <div className="text-xs text-gray-400 mt-1">Pending requests across reopen, extension, modification</div>
                </div>
                <div className="bg-[#1f2933] p-4 rounded-lg border border-gray-700">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Reliability Risk</div>
                  <div className="text-2xl font-bold text-red-300 mt-1">{systemStats.overdueTasks}</div>
                  <div className="text-xs text-gray-400 mt-1">Overdue tasks requiring intervention</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <h3 className="font-semibold text-gray-100 mb-3">System Definition</h3>
                  <div className="text-sm text-gray-300 space-y-2">
                    <div><span className="text-gray-400">Model:</span> Role-governed execution platform for task, request, meeting, and notice operations.</div>
                    <div><span className="text-gray-400">Decision Flow:</span> Request initiation -&gt; SLA tracking -&gt; decision -&gt; execution -&gt; immutable timeline.</div>
                    <div><span className="text-gray-400">Control Layer:</span> Capability-based admin actions with audit visibility and policy-configured notifications.</div>
                    <div><span className="text-gray-400">Reliability Guardrails:</span> Request IDs, standardized error contract, auth throttling, and centralized incident context.</div>
                  </div>
                </div>

                <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                  <h3 className="font-semibold text-gray-100 mb-3">Operational Snapshot</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="text-gray-400 text-xs">Total Tasks</div>
                      <div className="text-xl font-semibold">{systemStats.totalTasks}</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="text-gray-400 text-xs">Active Employees</div>
                      <div className="text-xl font-semibold text-blue-300">{systemStats.activeEmployees}</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="text-gray-400 text-xs">Verification Rate</div>
                      <div className="text-xl font-semibold text-green-300">{systemStats.verificationRate}%</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="text-gray-400 text-xs">Failure Rate</div>
                      <div className="text-xl font-semibold text-red-300">{systemStats.failureRate}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                <h3 className="font-semibold text-gray-100 mb-3">Feature Readiness Matrix</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
                  {[
                    { name: "Task Governance", status: "Operational", detail: "Lifecycle, review, reopen, archive, reassignment" },
                    { name: "Request Operations", status: "Operational", detail: "Modification, extension, reopen SLA workflows" },
                    { name: "Meeting Operations", status: "Operational", detail: "Scheduling, action items, attendance, recordings" },
                    { name: "Audit & Compliance", status: "Operational", detail: "Audit log filters and export" },
                    { name: "Notification Policy", status: "Operational", detail: "Dedupe, snooze, escalation acknowledgement" },
                    { name: "Live Operations", status: "In Progress", detail: "Live counters with reconnect state; further hardening pending" },
                    { name: "Data Quality Controls", status: "In Progress", detail: "Health signals available, remediation depth expanding" },
                    { name: "Accessibility Coverage", status: "Planned", detail: "Keyboard, ARIA, contrast full pass pending" },
                    { name: "Performance Scaling", status: "Planned", detail: "Virtualization and full server-side pagination expansion" }
                  ].map((item) => (
                    <div key={item.name} className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-gray-100">{item.name}</div>
                        <span className={`text-[11px] px-2 py-1 rounded ${
                          item.status === "Operational"
                            ? "bg-green-900/40 text-green-300"
                            : item.status === "In Progress"
                            ? "bg-yellow-900/40 text-yellow-300"
                            : "bg-blue-900/40 text-blue-300"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#1f2933] p-5 rounded-lg border border-gray-700">
                <h3 className="font-semibold text-gray-100 mb-3">Two-Week Execution Roadmap</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-900 border border-gray-700 rounded p-4">
                    <div className="font-semibold text-gray-100">Week 1 · Stability + Security</div>
                    <div className="text-gray-400 mt-2 space-y-1">
                      <div>1. Eliminate runtime blockers and state inconsistency in admin/employee views.</div>
                      <div>2. Normalize API response contracts and status enums across modules.</div>
                      <div>3. Enforce capability checks on sensitive endpoints and gated UI actions.</div>
                      <div>4. Add regression test coverage for core task/request/meeting flows.</div>
                    </div>
                  </div>
                  <div className="bg-gray-900 border border-gray-700 rounded p-4">
                    <div className="font-semibold text-gray-100">Week 2 · Operations + Scale</div>
                    <div className="text-gray-400 mt-2 space-y-1">
                      <div>1. Harden live counter stream and fallback behavior.</div>
                      <div>2. Expand data-health remediation actions and stale-state cleanups.</div>
                      <div>3. Complete server-side pagination/filtering for heavy datasets.</div>
                      <div>4. Run accessibility and UX consistency pass across admin and employee modules.</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Owner: Jyoti · Support: support@ems.com · Track via System Details -&gt; Audit Log and Notification Policy.
                </div>
              </div>
            </div>
          )}

          {systemTab === "guide" && (
            <div className="space-y-5">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
                <h3 className="text-lg font-semibold">User Guide</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Step-by-step operator guide for admin and employee workflows, with escalation-safe operating rules.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-[#1f2933] border border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-100">Admin Daily Runbook</h4>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div>1. Open `Dashboard Overview` and clear `Needs Action` first.</div>
                    <div>2. Process `Pending Requests` in SLA order (reopen, extension, modification).</div>
                    <div>3. Review completed tasks in `Reviews &amp; Approvals` and finalize quality decision.</div>
                    <div>4. Validate `Meetings` status transitions and attendance lock after completion.</div>
                    <div>5. Check `Notifications` and `System Details` for policy and audit anomalies.</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setActiveSection("overview")} className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-sm">Open Overview</button>
                    <button onClick={() => setActiveSection("pendingRequests")} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">Open Requests</button>
                    <button onClick={() => setActiveSection("review")} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">Open Reviews</button>
                  </div>
                </div>

                <div className="bg-[#1f2933] border border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-100">Employee Workflow Guide</h4>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div>1. Accept task and start work from `My Tasks` with SLA awareness.</div>
                    <div>2. Use `Requests` for extension/modification/reopen response with clear reason.</div>
                    <div>3. Submit work evidence in supported format (link/document) before due date.</div>
                    <div>4. Track meetings from `Meetings` and respond RSVP before session start.</div>
                    <div>5. In `Performance`, acknowledge manager review and add optional thread comment.</div>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    Governance: employees cannot alter published manager reviews; history remains immutable.
                  </div>
                </div>
              </div>

              <div className="bg-[#1f2933] border border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-100">Troubleshooting and Escalation</h4>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-900 border border-gray-700 rounded p-3">
                    <div className="text-xs text-gray-400">If Task action fails</div>
                    <div className="mt-1 text-gray-300">Re-open task details, retry once, then check Notifications for reason code.</div>
                  </div>
                  <div className="bg-gray-900 border border-gray-700 rounded p-3">
                    <div className="text-xs text-gray-400">If Meeting controls are disabled</div>
                    <div className="mt-1 text-gray-300">Confirm status and schedule gate. `Mark Attendance` is enabled only in progress.</div>
                  </div>
                  <div className="bg-gray-900 border border-gray-700 rounded p-3">
                    <div className="text-xs text-gray-400">If data looks stale</div>
                    <div className="mt-1 text-gray-300">Check sync indicator (Live/Delayed/Reconnecting) and inspect Audit tab for latest events.</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Support channel: `support@ems.com` · Incident owner: `System Admin` · Include request ID in escalation ticket.
                </div>
              </div>
            </div>
          )}

          {systemTab === "audit" && hasCapability("view_audit_log") && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">Audit Log</h3>
                    <p className="text-sm text-gray-400">Immutable operational events across tasks, meetings, and notices.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={exportAuditCsv}
                      disabled={!hasCapability("export_audit_log")}
                      className={`px-3 py-2 rounded text-sm ${
                        hasCapability("export_audit_log")
                          ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={exportAuditPdf}
                      disabled={!hasCapability("export_audit_log")}
                      className={`px-3 py-2 rounded text-sm ${
                        hasCapability("export_audit_log")
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-8 gap-3">
                  <input
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search by entity, actor, action..."
                    className="md:col-span-2 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  />
                  <select
                    value={auditSourceFilter}
                    onChange={(e) => setAuditSourceFilter(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All Sources</option>
                    <option value="task">Task</option>
                    <option value="meeting">Meeting</option>
                    <option value="notice">Notice</option>
                  </select>
                  <select
                    value={auditPageSize}
                    onChange={(e) => setAuditPageSize(Number(e.target.value))}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                  <select
                    value={auditSeverityFilter}
                    onChange={(e) => setAuditSeverityFilter(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All Severity</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={selectedAuditEmployee}
                    onChange={(e) => setSelectedAuditEmployee(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All Employees</option>
                    {auditEmployeeOptions.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} {emp.email ? `(${emp.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedAuditTask}
                    onChange={(e) => setSelectedAuditTask(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All Tasks</option>
                    {auditTaskOptions.map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={auditWorkflowFilter}
                    onChange={(e) => setAuditWorkflowFilter(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All Workflows</option>
                    <option value="task">Task</option>
                    <option value="modification">Modification</option>
                    <option value="extension">Extension</option>
                    <option value="reopen">Reopen</option>
                    <option value="meeting">Meeting</option>
                    <option value="notice">Notice</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                {auditLoading && <div className="text-sm text-blue-300 mb-3">Loading audit log...</div>}
                {auditError && <div className="text-sm text-red-300 mb-3">{auditError}</div>}
                {filteredAuditEvents.length === 0 ? (
                  <div className="text-sm text-gray-400">No audit events found.</div>
                ) : (
                  <div
                    ref={auditListRef}
                    className="max-h-[560px] overflow-y-auto"
                    onScroll={(e) => setAuditScrollTop(e.currentTarget.scrollTop)}
                  >
                    <div style={{ height: auditVirtualRows.totalHeight, position: "relative" }}>
                      {auditVirtualRows.items.map((evt, i) => (
                        <div
                          key={evt.id}
                          className="bg-gray-900 border border-gray-700 rounded p-3 absolute left-0 right-0"
                          style={{ top: `${(auditVirtualRows.startIndex + i) * auditVirtualRows.rowHeight}px` }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-gray-200 flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{evt.action.replace(/_/g, " ")}</span>
                              <span className="text-gray-400"> ? {evt.entity}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${
                                evt.workflow === "modification"
                                  ? "border-orange-700 text-orange-300 bg-orange-900/30"
                                  : evt.workflow === "extension"
                                  ? "border-yellow-700 text-yellow-300 bg-yellow-900/30"
                                  : evt.workflow === "reopen"
                                  ? "border-red-700 text-red-300 bg-red-900/30"
                                  : evt.workflow === "meeting"
                                  ? "border-blue-700 text-blue-300 bg-blue-900/30"
                                  : evt.workflow === "notice"
                                  ? "border-purple-700 text-purple-300 bg-purple-900/30"
                                  : "border-slate-700 text-slate-300 bg-slate-900/30"
                              }`}>
                                {(evt.workflow || "task").toUpperCase()}
                              </span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              evt.severity === "high"
                                ? "bg-red-900/30 text-red-300"
                                : evt.severity === "medium"
                                ? "bg-yellow-900/30 text-yellow-300"
                                : "bg-blue-900/30 text-blue-300"
                            }`}>
                              {evt.severity}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {evt.source.toUpperCase()} ? {evt.actor || "system"} ? {formatDateTime(evt.timestamp)}
                          </div>
                          {evt.details && <div className="text-xs text-gray-500 mt-1">{evt.details}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {filteredAuditEvents.length > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <div>
                      Page {auditPage} of {auditPageCount} ({filteredAuditEvents.length} events)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={auditPage <= 1}
                        className="px-2 py-1 rounded bg-gray-900 border border-gray-700 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setAuditPage((p) => Math.min(auditPageCount, p + 1))}
                        disabled={auditPage >= auditPageCount}
                        className="px-2 py-1 rounded bg-gray-900 border border-gray-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedAuditTaskDetails && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-base font-semibold">Task Timeline</h4>
                      <p className="text-xs text-gray-400">
                        {selectedAuditTaskDetails.title} · Assigned to {selectedAuditTaskDetails?.assignedTo?.name || selectedAuditTaskDetails?.assignedTo?.email || "Employee"}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      Modifications: {(selectedAuditTaskDetails.modificationRequests || []).length} · Employee Requests: {(selectedAuditTaskDetails.employeeModificationRequests || []).length} · Reopen SLA: {selectedAuditTaskDetails.reopenSlaStatus || "n/a"}
                    </div>
                  </div>
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {(selectedAuditTaskDetails.activityTimeline || []).length === 0 ? (
                      <div className="text-sm text-gray-400">No timeline events for this task.</div>
                    ) : (
                      (selectedAuditTaskDetails.activityTimeline || [])
                        .slice()
                        .reverse()
                        .map((evt, idx) => (
                          <div key={`${selectedAuditTaskDetails._id}-timeline-${idx}`} className="bg-gray-900 border border-gray-700 rounded p-3">
                            <div className="text-sm text-gray-200">
                              <span className="font-semibold">{String(evt.action || "UPDATED").replace(/_/g, " ")}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {(evt.by || evt.actorName || evt.role || "system")} · {formatDateTime(evt.timestamp || evt.createdAt || selectedAuditTaskDetails.updatedAt)}
                            </div>
                            {(evt.details || evt.note) && (
                              <div className="text-xs text-gray-500 mt-1">{evt.details || evt.note}</div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {systemTab === "rbac" && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
              <h3 className="text-lg font-semibold">Role Permission Matrix</h3>
              <p className="text-sm text-gray-400 mt-1">Live capability map from backend policy.</p>
              {capabilitiesLoading && (
                <div className="mt-3 text-xs text-blue-300">Loading capability matrix...</div>
              )}
              {capabilitiesError && (
                <div className="mt-3 text-xs text-red-300">{capabilitiesError}</div>
              )}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-700 rounded overflow-hidden">
                  <thead className="bg-gray-900 text-gray-300">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-gray-700">Capability Key</th>
                      <th className="text-left px-3 py-2 border-b border-gray-700">Current Admin Access</th>
                      <th className="text-left px-3 py-2 border-b border-gray-700">Employee Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminCapabilityData.availableCapabilities || []).map((capKey) => (
                      <tr key={capKey} className="border-t border-gray-700">
                        <td className="px-3 py-2 text-gray-300 font-mono text-xs">{capKey}</td>
                        <td className="px-3 py-2">
                          {hasCapability(capKey) ? (
                            <span className="inline-flex px-2 py-1 rounded bg-green-900/40 text-green-300 text-xs">
                              Granted
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 rounded bg-red-900/40 text-red-300 text-xs">
                              Restricted
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-xs">
                          No direct admin capability. Employee has workflow-limited access.
                        </td>
                      </tr>
                    ))}
                    {(!adminCapabilityData.availableCapabilities || adminCapabilityData.availableCapabilities.length === 0) && !capabilitiesLoading && (
                      <tr className="border-t border-gray-700">
                        <td colSpan={3} className="px-3 py-3 text-gray-400 text-sm">
                          Capability metadata is not available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {systemTab === "notify_policy" && hasCapability("manage_notification_policy") && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
              <h3 className="text-lg font-semibold">Notification Decision Policy</h3>
              <p className="text-sm text-gray-400">
                Tune delivery behavior without changing business events.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                  <div className="text-xs text-gray-400 mb-1">Dedupe Window (minutes)</div>
                  <input
                    type="number"
                    min="5"
                    value={notificationPolicy.dedupeWindowMinutes}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, dedupeWindowMinutes: Number(e.target.value || 0) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </label>
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                  <div className="text-xs text-gray-400 mb-1">Max Important Toasts</div>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={notificationPolicy.maxImportantToasts}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, maxImportantToasts: Number(e.target.value || 1) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </label>
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                  <div className="text-xs text-gray-400 mb-1">Important Snooze (minutes)</div>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={notificationPolicy.importantSnoozeMinutes}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, importantSnoozeMinutes: Number(e.target.value || 5) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </label>
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                  <div className="text-xs text-gray-400 mb-1">Critical Overdue Threshold (hours)</div>
                  <input
                    type="number"
                    min="1"
                    value={notificationPolicy.criticalOverdueHours}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, criticalOverdueHours: Number(e.target.value || 1) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </label>
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                  <div className="text-xs text-gray-400 mb-1">Quiet Hours Start (0-23)</div>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={notificationPolicy.eveningQuietStart}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, eveningQuietStart: Number(e.target.value || 0) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </label>
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                  <div className="text-xs text-gray-400 mb-1">Quiet Hours End (0-23)</div>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={notificationPolicy.morningQuietEnd}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, morningQuietEnd: Number(e.target.value || 0) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </label>
                <label className="bg-gray-900 border border-gray-700 rounded p-3 text-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Escalation Ack Required</div>
                    <div className="text-xs text-gray-500">Require acknowledgement for escalated alerts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!notificationPolicy.escalationAckRequired}
                    onChange={(e) => setNotificationPolicy((prev) => ({ ...prev, escalationAckRequired: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                <div className="font-semibold mb-2">Escalation Policy</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="text-xs text-gray-400">
                    Warn (h)
                    <input
                      type="number"
                      min="1"
                      value={escalationPolicy.warnHours}
                      onChange={(e) => setEscalationPolicy((prev) => ({ ...prev, warnHours: Number(e.target.value || 1) }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-gray-400">
                    Critical (h)
                    <input
                      type="number"
                      min="1"
                      value={escalationPolicy.criticalHours}
                      onChange={(e) => setEscalationPolicy((prev) => ({ ...prev, criticalHours: Number(e.target.value || 1) }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-gray-400">
                    Hard Escalation (h)
                    <input
                      type="number"
                      min="1"
                      value={escalationPolicy.hardEscalationHours}
                      onChange={(e) => setEscalationPolicy((prev) => ({ ...prev, hardEscalationHours: Number(e.target.value || 1) }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-gray-400">
                    Owner Mapping
                    <select
                      value={escalationPolicy.ownerRole}
                      onChange={(e) => setEscalationPolicy((prev) => ({ ...prev, ownerRole: e.target.value }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    >
                      <option value="task_admin">task_admin</option>
                      <option value="review_admin">review_admin</option>
                      <option value="notice_admin">notice_admin</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    Last escalation acknowledgement: {lastEscalationAckAt ? formatDateTime(lastEscalationAckAt) : "Not acknowledged yet"}
                  </span>
                  <button
                    onClick={() => setLastEscalationAckAt(new Date().toISOString())}
                    className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white"
                  >
                    Acknowledge Now
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm">
                <div className="font-semibold mb-2">Risk Confirmation Policy</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="text-xs text-gray-400">
                    Low Risk
                    <select
                      value={confirmationPolicy.lowRisk}
                      onChange={(e) => setConfirmationPolicy((prev) => ({ ...prev, lowRisk: e.target.value }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    >
                      <option value="soft_confirm">soft_confirm</option>
                      <option value="confirm_with_context">confirm_with_context</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-400">
                    Medium Risk
                    <select
                      value={confirmationPolicy.mediumRisk}
                      onChange={(e) => setConfirmationPolicy((prev) => ({ ...prev, mediumRisk: e.target.value }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    >
                      <option value="confirm_with_context">confirm_with_context</option>
                      <option value="reason_required">reason_required</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-400">
                    High Risk
                    <select
                      value={confirmationPolicy.highRisk}
                      onChange={(e) => setConfirmationPolicy((prev) => ({ ...prev, highRisk: e.target.value }))}
                      className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    >
                      <option value="reason_required">reason_required</option>
                      <option value="blocked_without_approval">blocked_without_approval</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Policy is saved locally for this admin console session profile and applied to notification rendering.
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === "task") {
      return (
        <>
          <h2 className="text-2xl font-semibold mb-4">Task Management</h2>

          <div className="flex gap-3 mb-6 flex-wrap">
            {["create", "manage", "active", "overdue", "completed", "verified", "reopened", "declined", "withdrawn", "reassign", "archived", "history"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                }`}
              >
                {tab === "manage"
                  ? " Manage Tasks"
                  : tab === "history"
                    ? " History"
                  : tab === "reassign"
                    ? "Reassign"
                    : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "manage" && (
            <TaskManagementPanel openEditFromModRequest={openEditFromModRequest} />
          )}

          {activeTab === "reassign" && (
            <TaskManagementPanel view="reassign" />
          )}

          {activeTab === "history" && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="text-xl font-semibold text-white mb-2">Task History (Reopen & Modifications)</h3>
                <p className="text-sm text-gray-400">
                  Track tasks that were reopened or modified (edit/delete) for review and approval history.
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-orange-400 mb-3">Reopened Tasks</h4>
                {tasks.filter(t => (t.activityTimeline || []).some(a => a.action === "TASK_REOPENED")).length === 0 ? (
                  <div className="text-gray-500">No reopened tasks found.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks
                      .filter(t => (t.activityTimeline || []).some(a => a.action === "TASK_REOPENED"))
                      .map(task => {
                        const timeline = task.activityTimeline || [];
                        const lastEvent = timeline[timeline.length - 1];
                        return (
                          <div key={task._id} className="bg-gray-700 rounded p-4 border border-orange-700 flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-white">{task.title}</h3>
                              <p className="text-sm text-gray-300">Assigned to: {task.assignedTo?.name || "Unknown"}</p>
                              <p className="text-xs text-gray-400">Status: {task.status}</p>
                              <p className="text-xs text-gray-500">
                                Last activity: {lastEvent ? `${lastEvent.action?.replace(/_/g, " ")}  ${formatDateTime(lastEvent.createdAt || lastEvent.timestamp)}` : "No activity"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openTaskDetails(task._id, { activeSection: "task", activeTab: "history" })}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => openTaskTimeline(task._id, { activeSection: "task", activeTab: "history" })}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"
                              >
                                Timeline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-blue-400 mb-3">Modification History (Edit/Delete)</h4>
                {tasks.filter(t => (t.activityTimeline || []).some(a => ["TASK_EDITED", "TASK_DELETED", "MODIFICATION_APPROVED", "MODIFICATION_REJECTED", "MODIFICATION_COUNTER_PROPOSAL", "MODIFICATION_EXPIRED"].includes(a.action))).length === 0 ? (
                  <div className="text-gray-500">No modification history found.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks
                      .filter(t => (t.activityTimeline || []).some(a => ["TASK_EDITED", "TASK_DELETED", "MODIFICATION_APPROVED", "MODIFICATION_REJECTED", "MODIFICATION_COUNTER_PROPOSAL", "MODIFICATION_EXPIRED"].includes(a.action)))
                      .map(task => {
                        const timeline = task.activityTimeline || [];
                        const lastEvent = timeline[timeline.length - 1];
                        const lastEdit = timeline
                          .slice()
                          .reverse()
                          .find(a => ["TASK_EDITED", "TASK_DELETED"].includes(a.action));
                        return (
                          <div key={task._id} className="bg-gray-700 rounded p-4 border border-blue-700 flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-white">{task.title}</h3>
                              <p className="text-sm text-gray-300">Assigned to: {task.assignedTo?.name || "Unknown"}</p>
                              <p className="text-xs text-gray-400">Status: {task.status}</p>
                              <p className="text-xs text-gray-500">
                                Last activity: {lastEvent ? `${lastEvent.action?.replace(/_/g, " ")}  ${formatDateTime(lastEvent.createdAt || lastEvent.timestamp)}` : "No activity"}
                              </p>
                              {lastEdit && (
                                <p className="text-xs text-gray-400">
                                  Last change: {lastEdit.action?.replace(/_/g, " ")}  {formatDateTime(lastEdit.createdAt || lastEdit.timestamp)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openTaskDetails(task._id, { activeSection: "task", activeTab: "history" })}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => openTaskTimeline(task._id, { activeSection: "task", activeTab: "history" })}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"
                              >
                                Timeline
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

          {activeTab === "create" && (
            <div className="space-y-4 max-w-2xl bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white">Create New Task</h3>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              
              <div className="space-y-4">
                <input 
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500"
                  placeholder="Task title *"
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })} 
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="date" 
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    min={getTodayDateInputValue()}
                    value={form.dueDate} 
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })} 
                  />
                  
                  <select 
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <select
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={form.assignedTo}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  >
                    <option value="">Select employee to assign *</option>
                    {employees
                      .filter((emp) => (emp.status || "active") !== "inactive")
                      .map((emp) => (
                        <option key={emp._id} value={emp.email || emp.name}>
                          {emp.name} ({emp.email})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    {employees.filter((emp) => (emp.status || "active") !== "inactive").length} employees available
                  </p>
                </div>
                
                <input 
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500"
                  placeholder="Category (optional)"
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })} 
                />
                
                <textarea 
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500"
                  placeholder="Description (optional)"
                  rows="3"
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                />
                
                <button 
                  onClick={createTask} 
                  className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-medium text-white"
                >
                  Create Task
                </button>
              </div>
            </div>
          )}

          {activeTab === "active" && (
            <div className="space-y-4">
              {dashboardMetrics.activeTasks
                .slice(0, 10)
                .map((task) => (
                <div id={`task-row-${task._id}`} key={task._id} className={`bg-gray-800 border p-4 rounded ${overviewFocusTaskId === task._id ? "border-yellow-500 ring-1 ring-yellow-500/50" : "border-gray-700"}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{task.title}</h3>
                        {(() => {
                          const modBadge = getModStatusBadge(task);
                          return modBadge ? (
                            <span className={`text-[11px] px-2 py-1 rounded ${modBadge.className}`}>
                              {modBadge.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-gray-400">Assigned on: {formatDate(task.createdAt)}</p>
                      <p className="text-sm text-gray-400">Task open for: {getTaskAge(task.createdAt)}</p>
                      <p className={`text-sm ${task.isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
                        SLA: {getSLAStatus(task.dueDate)}
                        {task.isOverdue && ` (${task.overdueDays} days overdue)`}
                      </p>
                      {(() => {
                        const latestMod = getLatestModRequest(task);
                        const modSla = latestMod ? getModSlaMeta(latestMod) : null;
                        return latestMod ? (
                          <div className="text-xs text-gray-300">
                            <div>Mod Request: {latestMod.requestType} ({latestMod.status})</div>
                            <div className="text-gray-400">Reason: {latestMod.reason}</div>
                            {modSla && (
                              <div className={modSla.level === "danger" ? "text-red-400" : modSla.level === "warning" ? "text-yellow-400" : "text-gray-400"}>
                                {modSla.label}
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                      {task.reopenDueAt && (
                        <p className="text-xs text-gray-400">
                          Reopen SLA: {getReopenSlaMeta(task)?.label || "-"}
                        </p>
                      )}
                      <p className="text-sm text-gray-400">Last activity: {getLastActivity(task)}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs rounded text-white ${getStatusColor(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={() => openTaskDetails(task._id)}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                         View Discussion & Details 
                      </button>
                      <button
                        onClick={() => toggleDiscussion(task._id)}
                        className="text-gray-300 hover:text-white text-sm"
                      >
                        {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                      </button>
                    </div>
                  </div>

                  {discussionOpen[task._id] && (
                    <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                  )}
                </div>
              ))}
              
              {dashboardMetrics.activeTasks.length > 10 && (
                <button 
                  onClick={() => setActiveTab("manage")}
                  className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded text-sm border border-gray-700"
                >
                  View all {dashboardMetrics.activeTasks.length} active tasks 
                </button>
              )}
            </div>
          )}

          {activeTab === "overdue" && (
            <div className="space-y-4">
              {dashboardMetrics.overdueTasks.map((task) => (
                <div
                  id={`task-row-${task._id}`}
                  key={task._id}
                  className={`bg-red-900/20 border p-4 rounded ${
                    overviewFocusTaskId === task._id ? "border-yellow-500 ring-1 ring-yellow-500/50" : "border-red-700"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-red-400"> {task.overdueDays} days overdue</p>
                      <p className="text-sm text-gray-400">Due date: {formatDate(task.dueDate)}</p>
                      <p className="text-sm text-gray-400">Task open for: {getTaskAge(task.createdAt)}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-red-600 text-white">
                      Overdue
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => toggleExtendForm(task)}
                      className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                    >
                       Extend Time
                    </button>
                    <button
                      onClick={() => toggleFailForm(task._id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                    >
                       Mark Failed / Archive
                    </button>
                    <button
                      onClick={() => toggleDiscussion(task._id)}
                      className="text-gray-300 hover:text-white text-sm"
                    >
                      {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                    </button>
                  </div>

                  {extendForms[task._id]?.open && (
                    <div className="mt-4 bg-gray-900 border border-gray-700 p-4 rounded">
                      <h4 className="text-sm font-semibold mb-2">Extend Due Date</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="datetime-local"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={extendForms[task._id]?.newDueDate || ""}
                          onChange={(e) =>
                            setExtendForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], newDueDate: e.target.value }
                            }))
                          }
                        />
                        <input
                          type="text"
                          placeholder="Reason (min 5 chars)"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={extendForms[task._id]?.reason || ""}
                          onChange={(e) =>
                            setExtendForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], reason: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => handleExtendDueDate(task._id)}
                          className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                        >
                          Save Extension
                        </button>
                        <button
                          onClick={() => toggleExtendForm(task)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {failForms[task._id]?.open && (
                    <div className="mt-4 bg-gray-900 border border-gray-700 p-4 rounded">
                      <h4 className="text-sm font-semibold mb-2">Fail Task</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={failForms[task._id]?.failureType || "overdue_timeout"}
                          onChange={(e) =>
                            setFailForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], failureType: e.target.value }
                            }))
                          }
                        >
                          <option value="overdue_timeout">Overdue Timeout</option>
                          <option value="quality_not_met">Quality Not Met</option>
                          <option value="incomplete_work">Incomplete Work</option>
                          <option value="communication_breakdown">Communication Breakdown</option>
                          <option value="technical_issues">Technical Issues</option>
                          <option value="resource_constraints">Resource Constraints</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Failure reason (min 5 chars)"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={failForms[task._id]?.reason || ""}
                          onChange={(e) =>
                            setFailForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], reason: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm text-gray-300 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={failForms[task._id]?.archiveAfter || false}
                            onChange={(e) =>
                              setFailForms(prev => ({
                                ...prev,
                                [task._id]: { ...prev[task._id], archiveAfter: e.target.checked }
                              }))
                            }
                          />
                          Archive after failing
                        </label>
                        {failForms[task._id]?.archiveAfter && (
                          <input
                            type="text"
                            placeholder="Archive note (min 5 chars)"
                            className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm flex-1"
                            value={failForms[task._id]?.archiveNote || ""}
                            onChange={(e) =>
                              setFailForms(prev => ({
                                ...prev,
                                [task._id]: { ...prev[task._id], archiveNote: e.target.value }
                              }))
                            }
                          />
                        )}
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => handleFailTask(task._id)}
                          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                        >
                          Confirm Fail
                        </button>
                        <button
                          onClick={() => toggleFailForm(task._id)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {discussionOpen[task._id] && (
                    <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "completed" && (
            <div className="space-y-4">
              {dashboardMetrics.pendingReviews.map((task) => (
                <div key={task._id} className="bg-purple-900/20 border border-purple-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-purple-400">Awaiting your review</p>
                      <p className="text-sm text-gray-400">Completed on: {formatDate(task.completedAt)}</p>
                      <p className="text-sm text-gray-400">Task open for: {getTaskAge(task.createdAt)}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-purple-600 text-white">
                      Ready for Review
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => setActiveSection("review")}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                    >
                       Review Now
                    </button>
                    <button
                      onClick={() => openTaskDetailsFromReview(task._id)}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                    >
                       Task Details
                    </button>
                    <button
                      onClick={() => toggleDiscussion(task._id)}
                      className="text-gray-300 hover:text-white text-sm"
                    >
                      {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                    </button>
                  </div>

                  {discussionOpen[task._id] && (
                    <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "verified" && (
            <div className="space-y-4">
              {tasks.filter(t => t.status === "verified" && !t.isArchived).map((task) => (
                <div key={task._id} className="bg-green-900/20 border border-green-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-green-400"> Verified and completed</p>
                      <p className="text-sm text-gray-400">Verified on: {formatDate(task.reviewedAt)}</p>
                      <p className="text-sm text-gray-400">Task open for: {getTaskAge(task.createdAt)}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-green-600 text-white">
                      Verified
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleReopenTask(task._id)}
                      className="bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-sm"
                    >
                       Reopen
                    </button>
                    <button
                      onClick={() => {
                        const note = window.prompt("Archive note (min 5 chars)");
                        if (note && note.trim().length >= 5) {
                          handleArchiveTask(task._id, note.trim());
                        } else if (note !== null) {
                          alert("Archive note required (min 5 chars)");
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm"
                    >
                       Archive
                    </button>
                    <button
                      onClick={() => toggleDiscussion(task._id)}
                      className="text-gray-300 hover:text-white text-sm"
                    >
                      {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                    </button>
                  </div>

                  {discussionOpen[task._id] && (
                    <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "reopened" && (
            <div className="space-y-4">
              {tasks.filter(t => t.status === "reopened").map((task) => (
                <div key={task._id} className="bg-orange-900/20 border border-orange-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-orange-400"> Reopened</p>
                      {task.reopenReason && (
                        <p className="text-sm text-gray-400">Reason: {task.reopenReason}</p>
                      )}
                      {task.reopenDueAt && (
                        <p className="text-sm text-gray-400">
                          Reopen SLA: {getReopenSlaMeta(task)?.label || formatDate(task.reopenDueAt)}
                        </p>
                      )}
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-orange-600 text-white">
                      Reopened
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => openTaskDetails(task._id, { activeSection: "task", activeTab: "reopened" })}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                    >
                      Task Details
                    </button>
                    <button
                      onClick={() => openTaskTimeline(task._id, { activeSection: "task", activeTab: "reopened" })}
                      className="bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded text-sm"
                    >
                      Work Timeline
                    </button>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === "reopened").length === 0 && (
                <div className="text-gray-500 text-center py-8">No reopened tasks</div>
              )}
            </div>
          )}

          {activeTab === "declined" && (
            <div className="space-y-4">
              <p className="text-gray-400 mb-4">
                Tasks declined by employees. Review decline reasons and reassign if needed.
              </p>
              {tasks.filter(t => t.status === "declined_by_employee").map((task) => (
                <div key={task._id} className="bg-gray-900/50 border border-gray-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-gray-400">Decline type: {task.declineType || "Unknown"}</p>
                      <p className="text-sm text-yellow-400">Reason: {task.declineReason || "No reason provided"}</p>
                      <p className="text-sm text-gray-400">Declined on: {formatDate(task.updatedAt)}</p>
                      <p className="text-sm text-gray-400">Task open for: {getTaskAge(task.createdAt)}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-gray-700 text-white">
                      Declined
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => toggleReassignForm(task._id)}
                      disabled={task.declineType === "reopen_decline"}
                      className={`px-3 py-1 rounded text-sm ${
                        task.declineType === "reopen_decline"
                          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                      title={
                        task.declineType === "reopen_decline"
                          ? "Reassign allowed only for assignment decline"
                          : "Reassign task"
                      }
                    >
                       Reassign (Declined)
                    </button>
                    <button
                      onClick={() => toggleFailForm(task._id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                    >
                       Mark Failed / Archive
                    </button>
                    <button
                      onClick={() => toggleDiscussion(task._id)}
                      className="text-gray-300 hover:text-white text-sm"
                    >
                      {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                    </button>
                  </div>

                  {reassignForms[task._id]?.open && (
                    <div className="mt-4 bg-gray-900 border border-gray-700 p-4 rounded">
                      <h4 className="text-sm font-semibold mb-2">Reassign Task</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={reassignForms[task._id]?.newEmployeeId || ""}
                          onChange={(e) =>
                            setReassignForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], newEmployeeId: e.target.value }
                            }))
                          }
                        >
                          <option value="">Select employee</option>
                          {employees.filter(e => e.status === "active").map(emp => (
                            <option key={emp._id} value={emp._id}>
                              {emp.name} ({emp.email})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={reassignForms[task._id]?.reason || ""}
                          onChange={(e) =>
                            setReassignForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], reason: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <textarea
                        placeholder="Handover notes (optional)"
                        className="mt-3 w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                        rows="2"
                        value={reassignForms[task._id]?.handoverNotes || ""}
                        onChange={(e) =>
                          setReassignForms(prev => ({
                            ...prev,
                            [task._id]: { ...prev[task._id], handoverNotes: e.target.value }
                          }))
                        }
                      />
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => handleReassignTask(task._id)}
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                        >
                          Confirm Reassign
                        </button>
                        <button
                          onClick={() => toggleReassignForm(task._id)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {failForms[task._id]?.open && (
                    <div className="mt-4 bg-gray-900 border border-gray-700 p-4 rounded">
                      <h4 className="text-sm font-semibold mb-2">Fail Task</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={failForms[task._id]?.failureType || "overdue_timeout"}
                          onChange={(e) =>
                            setFailForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], failureType: e.target.value }
                            }))
                          }
                        >
                          <option value="overdue_timeout">Overdue Timeout</option>
                          <option value="quality_not_met">Quality Not Met</option>
                          <option value="incomplete_work">Incomplete Work</option>
                          <option value="communication_breakdown">Communication Breakdown</option>
                          <option value="technical_issues">Technical Issues</option>
                          <option value="resource_constraints">Resource Constraints</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Failure reason (min 5 chars)"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={failForms[task._id]?.reason || ""}
                          onChange={(e) =>
                            setFailForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], reason: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm text-gray-300 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={failForms[task._id]?.archiveAfter || false}
                            onChange={(e) =>
                              setFailForms(prev => ({
                                ...prev,
                                [task._id]: { ...prev[task._id], archiveAfter: e.target.checked }
                              }))
                            }
                          />
                          Archive after failing
                        </label>
                        {failForms[task._id]?.archiveAfter && (
                          <input
                            type="text"
                            placeholder="Archive note (min 5 chars)"
                            className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm flex-1"
                            value={failForms[task._id]?.archiveNote || ""}
                            onChange={(e) =>
                              setFailForms(prev => ({
                                ...prev,
                                [task._id]: { ...prev[task._id], archiveNote: e.target.value }
                              }))
                            }
                          />
                        )}
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => handleFailTask(task._id)}
                          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                        >
                          Confirm Fail
                        </button>
                        <button
                          onClick={() => toggleFailForm(task._id)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {discussionOpen[task._id] && (
                    <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "withdrawn" && (
            <div className="space-y-4">
              <p className="text-gray-400 mb-4">
                Tasks withdrawn by employees after acceptance. These need reassignment.
              </p>
              {dashboardMetrics.withdrawnTasks.map((task) => (
                <div key={task._id} className="bg-orange-900/20 border border-orange-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Withdrawn by: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-yellow-400">Reason: {task.declineReason || "No reason provided"}</p>
                      <p className="text-sm text-gray-400">Withdrawn on: {formatDate(task.closedAt)}</p>
                      <p className="text-sm text-gray-400">Task open for: {getTaskAge(task.createdAt)}</p>
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-orange-700 text-white">
                      Withdrawn
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => toggleReassignForm(task._id)}
                      className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                    >
                       Reassign Task
                    </button>
                    <button
                      onClick={() => toggleFailForm(task._id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                    >
                       Mark Failed / Archive
                    </button>
                    <button
                      onClick={() => toggleDiscussion(task._id)}
                      className="text-gray-300 hover:text-white text-sm"
                    >
                      {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                    </button>
                  </div>

                  {reassignForms[task._id]?.open && (
                    <div className="mt-4 bg-gray-900 border border-gray-700 p-4 rounded">
                      <h4 className="text-sm font-semibold mb-2">Reassign Task</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={reassignForms[task._id]?.newEmployeeId || ""}
                          onChange={(e) =>
                            setReassignForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], newEmployeeId: e.target.value }
                            }))
                          }
                        >
                          <option value="">Select employee</option>
                          {employees.filter(e => e.status === "active").map(emp => (
                            <option key={emp._id} value={emp._id}>
                              {emp.name} ({emp.email})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={reassignForms[task._id]?.reason || ""}
                          onChange={(e) =>
                            setReassignForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], reason: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <textarea
                        placeholder="Handover notes (optional)"
                        className="mt-3 w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                        rows="2"
                        value={reassignForms[task._id]?.handoverNotes || ""}
                        onChange={(e) =>
                          setReassignForms(prev => ({
                            ...prev,
                            [task._id]: { ...prev[task._id], handoverNotes: e.target.value }
                          }))
                        }
                      />
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => handleReassignTask(task._id)}
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                        >
                          Confirm Reassign
                        </button>
                        <button
                          onClick={() => toggleReassignForm(task._id)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {failForms[task._id]?.open && (
                    <div className="mt-4 bg-gray-900 border border-gray-700 p-4 rounded">
                      <h4 className="text-sm font-semibold mb-2">Fail Task</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={failForms[task._id]?.failureType || "overdue_timeout"}
                          onChange={(e) =>
                            setFailForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], failureType: e.target.value }
                            }))
                          }
                        >
                          <option value="overdue_timeout">Overdue Timeout</option>
                          <option value="quality_not_met">Quality Not Met</option>
                          <option value="incomplete_work">Incomplete Work</option>
                          <option value="communication_breakdown">Communication Breakdown</option>
                          <option value="technical_issues">Technical Issues</option>
                          <option value="resource_constraints">Resource Constraints</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Failure reason (min 5 chars)"
                          className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          value={failForms[task._id]?.reason || ""}
                          onChange={(e) =>
                            setFailForms(prev => ({
                              ...prev,
                              [task._id]: { ...prev[task._id], reason: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-sm text-gray-300 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={failForms[task._id]?.archiveAfter || false}
                            onChange={(e) =>
                              setFailForms(prev => ({
                                ...prev,
                                [task._id]: { ...prev[task._id], archiveAfter: e.target.checked }
                              }))
                            }
                          />
                          Archive after failing
                        </label>
                        {failForms[task._id]?.archiveAfter && (
                          <input
                            type="text"
                            placeholder="Archive note (min 5 chars)"
                            className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm flex-1"
                            value={failForms[task._id]?.archiveNote || ""}
                            onChange={(e) =>
                              setFailForms(prev => ({
                                ...prev,
                                [task._id]: { ...prev[task._id], archiveNote: e.target.value }
                              }))
                            }
                          />
                        )}
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => handleFailTask(task._id)}
                          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                        >
                          Confirm Fail
                        </button>
                        <button
                          onClick={() => toggleFailForm(task._id)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {discussionOpen[task._id] && (
                    <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "archived" && (
            <div className="space-y-4">
              <p className="text-gray-400 mb-4">
                Archived tasks that have been completed and verified. These are stored for record keeping.
              </p>
              {dashboardMetrics.archivedTasks.map((task) => (
                <div key={task._id} className="bg-purple-900/20 border border-purple-700 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="text-sm text-gray-400">Assigned to: {task.assignedTo?.name || ""}</p>
                      <p className="text-sm text-purple-400"> Archived</p>
                      <p className="text-sm text-gray-400">Archived on: {formatDate(task.archivedAt)}</p>
                      {task.archiveNote && (
                        <p className="text-sm text-gray-400">Note: {task.archiveNote}</p>
                      )}
                    </div>
                    <span className="px-3 py-1 text-xs rounded bg-purple-600 text-white">
                      Archived
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    if (activeSection === "oversight") {
      return <TaskOversightPanel />;
    }

    if (activeSection === "review") {
      if (!hasCapability("manage_reviews")) {
        return (
          <div className="bg-gray-900 border border-red-700 rounded p-6">
            <h2 className="text-2xl font-semibold text-white mb-2">Reviews & Approvals</h2>
            <p className="text-sm text-red-300">
              Access blocked. Missing capability: `manage_reviews`.
            </p>
          </div>
        );
      }
      const reviewTasks = reviewQueue;
      const laneMatches = (task) => {
        if (reviewLane === "all") return true;
        if (reviewLane === "needs_review") return task.status === "completed";
        if (reviewLane === "at_risk") return Boolean(task.isOverdue);
        if (reviewLane === "reopened") return task.status === "reopened";
        if (reviewLane === "closed") return ["verified", "failed"].includes(task.status);
        return true;
      };

      const filteredReviews = reviewTasks
        .filter(t => {
          if (!laneMatches(t)) return false;
          return true;
        })
        .sort((a, b) => {
          if (reviewSort === "oldest") {
            return new Date(a.completedAt || a.updatedAt) - new Date(b.completedAt || b.updatedAt);
          }
          return new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt);
        });
      const reviewQueueMeta = reviewQueueSummary;

      return (
        <>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">Reviews & Approvals</h2>
              <p className="text-sm text-gray-400">
                Review queue for submitted work, reopen outcomes, and final decision execution.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Queue items</div>
              <div className="text-2xl font-bold">{reviewQueuePagination.total || reviewQueueMeta.total || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 p-4 rounded border border-gray-800">
              <div className="text-xs text-gray-400">Needs review</div>
              <div className="text-xl font-bold">{reviewQueueMeta.needsReview}</div>
            </div>
            <div className="bg-gray-900 p-4 rounded border border-gray-800">
              <div className="text-xs text-gray-400">At risk (SLA)</div>
              <div className="text-xl font-bold text-red-400">{reviewQueueMeta.atRisk}</div>
            </div>
            <div className="bg-gray-900 p-4 rounded border border-gray-800">
              <div className="text-xs text-gray-400">Reopened for rework</div>
              <div className="text-xl font-bold text-orange-300">{reviewQueueMeta.reopened}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 p-4 rounded border border-gray-800">
              <div className="text-xs text-gray-400">Completed today</div>
              <div className="text-xl font-bold">{dashboardMetrics.completedToday.length}</div>
            </div>
            <div className="bg-gray-900 p-4 rounded border border-gray-800">
              <div className="text-xs text-gray-400">Average task age</div>
              <div className="text-xl font-bold">
                {dashboardMetrics.pendingReviews.length > 0
                  ? Math.round(
                      filteredReviews.reduce((sum, t) => {
                        return sum + (Date.now() - new Date(t.createdAt).getTime());
                      }, 0) / filteredReviews.length / (1000 * 60 * 60 * 24)
                    ) + " days"
                  : ""}
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded border border-gray-800">
              <div className="text-xs text-gray-400">Closed decisions</div>
              <div className="text-xl font-bold">
                {reviewQueueMeta.closed}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-3">
            <input
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white flex-1 min-w-[220px]"
              placeholder="Search by task or employee..."
              value={reviewSearch}
              onChange={(e) => setReviewSearch(e.target.value)}
            />
            <select
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              value={reviewScope}
              onChange={(e) => setReviewScope(e.target.value)}
            >
              <option value="pending">Pending only</option>
              <option value="all">All review tasks (no archived)</option>
            </select>
            <select
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              value={reviewLane}
              onChange={(e) => setReviewLane(e.target.value)}
            >
              <option value="all">All lanes</option>
              <option value="needs_review">Needs Review</option>
              <option value="at_risk">At Risk (SLA)</option>
              <option value="reopened">Reopened</option>
              <option value="closed">Closed (verified/failed)</option>
            </select>
            <select
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              value={reviewSort}
              onChange={(e) => setReviewSort(e.target.value)}
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: "all", label: "All", value: reviewQueueMeta.total || reviewQueuePagination.total || 0 },
              { key: "needs_review", label: "Needs Review", value: reviewQueueMeta.needsReview },
              { key: "at_risk", label: "At Risk", value: reviewQueueMeta.atRisk },
              { key: "reopened", label: "Reopened", value: reviewQueueMeta.reopened },
              { key: "closed", label: "Closed", value: reviewQueueMeta.closed }
            ].map((lane) => (
              <button
                key={lane.key}
                onClick={() => setReviewLane(lane.key)}
                className={`px-3 py-1.5 text-xs rounded border transition ${
                  reviewLane === lane.key
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800"
                }`}
              >
                {lane.label}: {lane.value}
              </button>
            ))}
          </div>

          {reviewQueueLoading && (
            <div className="bg-gray-900 border border-gray-800 rounded p-6 text-gray-400">
              Loading review queue...
            </div>
          )}

          {!reviewQueueLoading && filteredReviews.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded p-6 text-gray-400">
              No tasks match your filters.
            </div>
          )}

          <div className="space-y-4">
            {!reviewQueueLoading && filteredReviews.map((task) => (
              <div key={task._id} className="bg-gray-800 border border-gray-700 rounded p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold text-white">{task.title}</div>
                    <div className="text-sm text-gray-400">
                      Assigned to: {task.assignedTo?.name || ""}  Completed: {formatDate(task.completedAt)}
                    </div>
                    <div className="text-sm text-gray-400">
                      Task open for: {getTaskAge(task.createdAt)}  SLA: {getSLAStatus(task.dueDate)}
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs rounded text-white ${
                    task.status === "completed"
                      ? "bg-purple-600"
                      : task.status === "reopened"
                        ? "bg-orange-600"
                        : task.status === "verified"
                          ? "bg-green-600"
                          : task.status === "failed"
                            ? "bg-red-600"
                            : "bg-gray-600"
                  }`}>
                    {(task.status || "unknown").replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <TaskReviewActions
                      task={task}
                      token={user.token}
                      onUpdated={fetchTasks}
                      canManageReviews={hasCapability("manage_reviews")}
                      canManageTasks={hasCapability("manage_tasks")}
                    />
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          onClick={() => openTaskDetailsFromReview(task._id)}
                          className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                        >
                          Open Task Details
                        </button>
                        <button
                          onClick={() => openTaskTimeline(task._id)}
                          className="text-sm bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded"
                        >
                          Work Timeline
                        </button>
                        <button
                          onClick={() =>
                            setReviewMetricsOpen((prev) => ({
                              ...prev,
                              [task._id]: !prev[task._id],
                            }))
                          }
                          className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
                        >
                          {reviewMetricsOpen[task._id] ? "Hide SLA" : "View SLA"}
                        </button>
                        <button
                          onClick={() => toggleDiscussion(task._id)}
                          className="text-sm text-gray-300 hover:text-white"
                        >
                          {discussionOpen[task._id] ? "Hide Discussion" : "Open Discussion"}
                        </button>
                      </div>
                      {reviewMetricsOpen[task._id] && (
                        <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-300">
                          <div className="font-semibold mb-2">SLA & Task Metrics</div>
                          <div>Due date: {formatDate(task.dueDate)}</div>
                          <div>SLA status: {getSLAStatus(task.dueDate)}</div>
                          <div>Task age: {getTaskAge(task.createdAt)}</div>
                          <div>Turnaround: {getTurnaround(task)}</div>
                          <div>Overdue: {task.isOverdue ? `Yes (${task.overdueDays || 0} days)` : "No"}</div>
                        </div>
                      )}
                      {task.status === "reopened" && (
                        <div className="mt-3 bg-orange-900/20 border border-orange-700 rounded p-3 text-sm text-gray-300">
                          <div className="font-semibold mb-2">Reopen SLA</div>
                          <div>Status: {task.reopenSlaStatus || "pending"}</div>
                          <div className={getSlaLevelClasses(getReopenSlaMeta(task)?.level)}>
                            {getReopenSlaMeta(task)?.label || `Due: ${formatDate(task.reopenDueAt)}`}
                          </div>
                          {task.reopenReason && <div>Reason: {task.reopenReason}</div>}
                        </div>
                      )}
                      {discussionOpen[task._id] && (
                        <TaskDiscussion taskId={task._id} token={user.token} role="admin" />
                      )}
                    </div>
                  <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-300">
                    <div className="font-semibold mb-2">Submission Snapshot</div>
                    <div>Submitted: {formatDate(task.completedAt || task.updatedAt)}</div>
                    <div>Priority: {task.priority || ""}</div>
                    <div>Category: {task.category || ""}</div>
                    <div>Last activity: {getLastActivity(task)}</div>
                    {(task.workSubmission?.link || (task.workSubmission?.files?.length || 0) > 0) && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-400 mb-1">Work Submission</div>
                        {task.workSubmission?.link && (
                          <div className="text-blue-400 break-all"> {task.workSubmission.link}</div>
                        )}
                        {(task.workSubmission?.files?.length || 0) > 0 && (
                          <div className="mt-1">
                            <div className="text-xs text-gray-400">Files:</div>
                            <div className="space-y-1 mt-1">
                              {(task.workSubmission.files || []).map((file, idx) => {
                                const fileUrl = toAbsoluteAssetUrl(file?.url);
                                if (!fileUrl) {
                                  return (
                                    <div key={`${file?.name || "file"}-${idx}`} className="text-xs text-gray-300">
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
                                    className="block text-xs text-blue-300 hover:underline break-all"
                                  >
                                    {file?.name || `File ${idx + 1}`}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {task.workSubmission?.employeeNote && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-400 mb-1">Employee Note</div>
                        <div className="text-gray-300 break-words">{task.workSubmission.employeeNote}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!reviewQueueLoading && (reviewQueuePagination.totalPages || 1) > 1 && (
            <div className="mt-5 flex items-center justify-between bg-gray-900 border border-gray-800 rounded p-3">
              <div className="text-xs text-gray-400">
                Page {reviewQueuePagination.page} of {reviewQueuePagination.totalPages} • {reviewQueuePagination.total} total
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewQueuePage((p) => Math.max(1, p - 1))}
                  disabled={reviewQueuePagination.page <= 1}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded"
                >
                  Prev
                </button>
                <button
                  onClick={() => setReviewQueuePage((p) => Math.min(reviewQueuePagination.totalPages || 1, p + 1))}
                  disabled={reviewQueuePagination.page >= (reviewQueuePagination.totalPages || 1)}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      );
    }

    if (activeSection === "pendingRequests") {
      return (
        <div className="space-y-6">
          <div className="bg-[#1f2933] p-6 rounded-lg border border-gray-700">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Requests Center</h2>
                <p className="text-sm text-gray-400">
                  Review and approve employee modification and extension requests with SLA visibility.
                </p>
              </div>
                <div className="flex gap-2 text-xs">
                  <div className="px-3 py-2 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                    Pending Modifications: <span className="text-orange-300 font-semibold">{pendingRequestsLoading ? "�" : pendingModificationsCenter}</span>
                  </div>
                  <div className="px-3 py-2 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                    Pending Extensions: <span className="text-yellow-300 font-semibold">{dashboardMetrics.pendingExtensions}</span>
                  </div>
                  <div className="px-3 py-2 rounded bg-[#0f172a] border border-gray-700 text-gray-300">
                    Pending Reopens: <span className="text-red-300 font-semibold">{dashboardMetrics.pendingReopens}</span>
                  </div>
                </div>
              </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                <div className="text-xs text-gray-500">Total Pending</div>
                <div className="text-2xl font-semibold text-white">
                  {pendingRequestsLoading ? "�" : (dashboardMetrics.pendingExtensions + pendingModificationsCenter + dashboardMetrics.pendingReopens)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Requests awaiting action</div>
              </div>
              <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                <div className="text-xs text-gray-500">Modification Requests</div>
                <div className="text-2xl font-semibold text-white">{pendingRequestsLoading ? "�" : pendingModificationsCenter}</div>
                <div className="text-xs text-gray-400 mt-1">Edit / delete approvals</div>
              </div>
              <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                <div className="text-xs text-gray-500">Extension Requests</div>
                <div className="text-2xl font-semibold text-white">{dashboardMetrics.pendingExtensions}</div>
                <div className="text-xs text-gray-400 mt-1">Time extensions to review</div>
              </div>
              <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                <div className="text-xs text-gray-500">Reopen Requests</div>
                <div className="text-2xl font-semibold text-white">{dashboardMetrics.pendingReopens}</div>
                <div className="text-xs text-gray-400 mt-1">Awaiting employee response</div>
              </div>
              <div className="bg-[#0b1220] border border-gray-800 rounded p-4">
                <div className="text-xs text-gray-500">SLA Critical</div>
                <div className="text-2xl font-semibold text-white">
                  {expiredModificationRequests.length}
                </div>
                <div className="text-xs text-gray-400 mt-1">Expiring approvals</div>
              </div>
            </div>

            {expiredModificationRequests.length > 0 && (
              <div className="mt-4 bg-red-950/40 border border-red-700 rounded p-3 text-sm text-red-200">
                <span className="font-semibold">SLA Alert:</span>{" "}
                {expiredModificationRequests.length} modification request(s) have expired.
                Open <span className="font-semibold">Expired Requests</span> to review and close them.
              </div>
            )}

            {activeTab === "extensions" && (
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  className="flex-1 min-w-[220px] p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                  placeholder="Search extensions by task, assignee, or reason..."
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
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
                <select
                  value={extensionSort}
                  onChange={(e) => setExtensionSort(e.target.value)}
                  className="p-2 bg-[#0f172a] border border-gray-700 rounded text-sm"
                >
                  <option value="recent">Most recent</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab("modifications")}
              className={`px-4 py-2 rounded ${
                activeTab === "modifications"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
               Modification Requests ({pendingRequestsLoading ? "�" : pendingModificationsCenter})
            </button>
            <button
              onClick={() => setActiveTab("extensions")}
              className={`px-4 py-2 rounded ${
                activeTab === "extensions"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
               Extension Requests ({dashboardMetrics.pendingExtensions})
            </button>
            <button
              onClick={() => setActiveTab("reopen")}
              className={`px-4 py-2 rounded ${
                activeTab === "reopen"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              Reopen Requests ({dashboardMetrics.pendingReopens})
            </button>
            <button
              onClick={() => setActiveTab("expired")}
              className={`px-4 py-2 rounded ${
                activeTab === "expired"
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              Expired Requests ({expiredModificationRequests.length})
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-900/40 border border-gray-700 rounded px-3 py-2">
            <div>
              Request dataset page {pendingRequestsPage} of {pendingRequestsTotalPages} (filtered server-side)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingRequestsPage((p) => Math.max(1, p - 1))}
                disabled={pendingRequestsPage <= 1 || pendingRequestsLoading}
                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPendingRequestsPage((p) => Math.min(pendingRequestsTotalPages, p + 1))}
                disabled={pendingRequestsPage >= pendingRequestsTotalPages || pendingRequestsLoading}
                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          {activeTab === "modifications" ? (
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <ModificationRequestsPanel />
            </div>
          ) : activeTab === "reopen" ? (
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Reopen Requests</h3>
                  <p className="text-sm text-gray-400">Tasks reopened by admin awaiting employee response.</p>
                </div>
                <span className="text-xs text-gray-400">{filteredReopenRequests.length} items</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <input
                  value={reopenSearch}
                  onChange={(e) => setReopenSearch(e.target.value)}
                  placeholder="Search by task, assignee, or reason..."
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white flex-1 min-w-[220px]"
                />
                <select
                  value={reopenStatusFilter}
                  onChange={(e) => setReopenStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="responded">Responded</option>
                  <option value="timed_out">Timed Out</option>
                </select>
                <select
                  value={reopenSort}
                  onChange={(e) => setReopenSort(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                >
                  <option value="recent">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                {filteredReopenRequests.map((req) => (
                  <div key={req.taskId} className="bg-[#0f172a] border border-orange-800/40 rounded p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-white">{req.taskTitle || "Untitled Task"}</div>
                        <div className="text-gray-400 mt-1">Assigned: {req.assignedTo?.name || "-"}</div>
                        <div className="text-gray-300 mt-1">Reason: {req.reopenReason || "-"}</div>
                        <div className="text-gray-400 mt-1">
                          SLA: {getReopenSlaMeta({ reopenDueAt: req.reopenDueAt, reopenSlaStatus: req.reopenSlaStatus })?.label || "-"}
                        </div>
                        <div className="text-gray-400 mt-1">Status: {req.reopenSlaStatus || "pending"}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openTaskDetails(req.taskId, { activeSection: "pendingRequests", activeTab: "reopen" })}
                          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                        >
                          Open Task
                        </button>
                        <button
                          onClick={() => {
                            navigate("/admin", {
                              state: {
                                activeSection: "task",
                                activeTab: "reopened",
                                taskId: req.taskId
                              }
                            });
                          }}
                          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                        >
                          Task Management
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredReopenRequests.length === 0 && (
                  <div className="py-3 text-gray-400">No reopen requests match the current filters.</div>
                )}
              </div>
            </div>
          ) : activeTab === "expired" ? (
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Expired Modification Requests</h3>
                  <p className="text-sm text-gray-400">SLA expired requests that need review or closure.</p>
                </div>
                <span className="text-xs text-gray-400">{filteredExpiredModificationRequests.length} items</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <input
                  value={expiredModSearch}
                  onChange={(e) => setExpiredModSearch(e.target.value)}
                  placeholder="Search by task, assignee, or reason..."
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white flex-1 min-w-[220px]"
                />
                <select
                  value={expiredModTypeFilter}
                  onChange={(e) => setExpiredModTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                >
                  <option value="all">All Types</option>
                  <option value="edit">Edit</option>
                  <option value="delete">Delete</option>
                  <option value="extension">Extension</option>
                  <option value="reassign">Reassign</option>
                  <option value="scope_change">Scope Change</option>
                </select>
                <select
                  value={expiredModSort}
                  onChange={(e) => setExpiredModSort(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                >
                  <option value="recent">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                {filteredExpiredModificationRequests.map((req, idx) => (
                  <div
                    key={`${req.taskId}-${idx}`}
                    className="bg-red-950/30 border border-red-800/50 rounded p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-white">{req.taskTitle || "Untitled Task"}</div>
                        <div className="text-gray-400 mt-1">Assigned: {req.assignedTo?.name || "-"}</div>
                        <div className="text-gray-400">Type: {req.requestType || "modification"}</div>
                        <div className="text-red-300">
                          Expired: {formatDateTime(req.expiresAt || req.updatedAt || req.requestedAt)}
                        </div>
                        <div className="text-gray-300 mt-1">Reason: {req.reason || "-"}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {req.taskId && (
                          <button
                            onClick={() => openTaskDetails(req.taskId, { activeSection: "pendingRequests", activeTab: "modifications" })}
                            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                          >
                            Open Task
                          </button>
                        )}
                        <button
                          onClick={() => {
                            navigate("/admin", {
                              state: {
                                activeSection: "task",
                                activeTab: "manage",
                                filterMode: "pending-mods",
                                taskId: req.taskId
                              }
                            });
                          }}
                          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                        >
                          Task Management
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredExpiredModificationRequests.length === 0 && (
                  <div className="py-3 text-gray-400">No expired requests match the current filters.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Time Extension Requests</h3>
                  <p className="text-sm text-gray-400">Review extension requests and open tasks for action.</p>
                </div>
                <span className="text-xs text-gray-400">{filteredExtensionRequests.length} items</span>
              </div>

              <div className="mt-4 space-y-3">
                {filteredExtensionRequests.length === 0 ? (
                  <div className="text-gray-400">No extension requests found.</div>
                ) : (
                  filteredExtensionRequests.map((req, idx) => (
                    <div key={`${req.taskId}-${idx}`} className="bg-[#0f172a] p-4 rounded border border-gray-700">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-white">{req.taskTitle || "Untitled Task"}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            Assigned to: {req.assignedTo?.name || "-"}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Requested: {formatDateTime(req.requestedAt || req.createdAt)}
                          </div>
                          {(req.newDueDate || req.requestedExtension) && (
                            <div className="text-xs text-gray-400 mt-1">
                              Requested Due: {formatDate(req.newDueDate || req.requestedExtension)}
                            </div>
                          )}
                          {req.approvedDate && (
                            <div className="text-xs text-gray-400 mt-1">
                              Approved Due: {formatDate(req.approvedDate)}
                            </div>
                          )}
                          {req.reviewedAt && (
                            <div className="text-xs text-gray-400 mt-1">
                              Reviewed: {formatDateTime(req.reviewedAt)} {req.reviewedBy?.name ? `by ${req.reviewedBy.name}` : ""}
                            </div>
                          )}
                          {req.reason && (
                            <div className="text-xs text-gray-300 mt-2">
                              Reason: {req.reason}
                            </div>
                          )}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded ${
                          req.status === "approved"
                            ? "bg-green-900/30 text-green-300"
                            : req.status === "rejected"
                            ? "bg-red-900/30 text-red-300"
                            : "bg-yellow-900/30 text-yellow-300"
                        }`}>
                          {req.status || "pending"}
                        </div>
                      </div>
                      {req.status === "pending" && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="date"
                            className="p-2 bg-gray-900 border border-gray-700 rounded text-sm"
                            value={extensionApprovedDates[req._id] || (req.requestedExtension ? new Date(req.requestedExtension).toISOString().slice(0, 10) : "")}
                            onChange={(e) => setExtensionApprovedDates(prev => ({ ...prev, [req._id]: e.target.value }))}
                          />
                          <input
                            className="p-2 bg-gray-900 border border-gray-700 rounded text-sm"
                            placeholder="Approval note (min 5 chars)"
                            value={extensionReviewNotes[req._id] || ""}
                            onChange={(e) => setExtensionReviewNotes(prev => ({ ...prev, [req._id]: e.target.value }))}
                          />
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {req.taskId && (
                          <button
                            onClick={() => openTaskDetails(req.taskId, { activeSection: "pendingRequests", activeTab: "extensions" })}
                            className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600"
                          >
                            Open Task Details
                          </button>
                        )}
                        {req.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleExtensionDecision(req.taskId, req._id, "approve", req.requestedExtension || req.newDueDate)}
                              disabled={extensionActionLoading[req._id]}
                              className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleExtensionDecision(req.taskId, req._id, "reject", req.requestedExtension || req.newDueDate)}
                              disabled={extensionActionLoading[req._id]}
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {req.taskId && req.status === "approved" && (
                          <button
                            onClick={() => {
                              navigate("/admin", {
                                state: {
                                  activeSection: "task",
                                  activeTab: "manage",
                                  filterMode: "extension-requests",
                                  taskId: req.taskId,
                                  openExtensionExecution: {
                                    taskId: req.taskId,
                                    requestId: req._id,
                                    requestedExtension: req.requestedExtension || req.newDueDate,
                                    reason: req.reason || ""
                                  }
                                }
                              });
                            }}
                            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                          >
                            Execute Extension
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Select a section from the sidebar</div>
      </div>
    );
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-black text-white flex flex-col">
      <header className="flex justify-between items-center px-8 py-4 bg-[#020617] border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold">EMS Admin Panel</h1>
          <p className="text-xs text-gray-400">Logged in as {user?.email}</p>
        </div>
        <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
          Logout
        </button>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-[#020617] p-6 space-y-2 border-r border-gray-800">
          {[
            ["overview", "Dashboard Overview"],
            ["employee", "Employee Management"],
            ["employeeInsights", "Employee Insights"],
            ["task", "Task Management"],
            ["oversight", "Task Oversight"],
            ["review", "Reviews & Approvals"],
            ["pendingRequests", `Pending Requests ${dashboardMetrics.totalPendingRequests > 0 ? `(${dashboardMetrics.totalPendingRequests})` : ''}`],
            ["meetings", "Meetings"],
            ["community", "Community"],
            ["notices", "Admin Notices"],
            ["analytics", "Analytics & Reports"],
            ["notifications", `Notifications${newNotificationCount > 0 ? ` (${newNotificationCount})` : ""}`],
            ["system", "System Details"],
          ].filter(([key]) => canAccessSection(key)).map(([key, label]) => (
            <button
              key={key}
              aria-label={`Open ${label}`}
              aria-keyshortcuts={key === "overview" ? "Alt+1" : key === "task" ? "Alt+2" : key === "review" ? "Alt+3" : key === "pendingRequests" ? "Alt+4" : key === "analytics" ? "Alt+5" : key === "system" ? "Alt+6" : undefined}
              onClick={() => {
                setActiveSectionGuarded(key);
                if (key === "pendingRequests") {
                  setActiveTab("modifications");
                } else if (key === "analytics") {
                  setActiveTab("performance");
                }
              }}
              className={`w-full text-left px-4 py-3 rounded transition-all ${
                activeSection === key 
                  ? "bg-blue-600 text-white shadow-lg" 
                  : "hover:bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-8 overflow-auto">
          {loadingCore ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-gray-400 animate-pulse mb-2">Loading dashboard...</div>
                <div className="text-xs text-gray-500">Fetching tasks, employees, and meetings</div>
              </div>
            </div>
          ) : (
            renderSection()
          )}
        </main>
      </div>
      <footer className="border-t border-gray-800 bg-[#0b1220] px-8 py-10 text-sm text-gray-400">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">
          <div>
            <div className="text-xs text-gray-500 mb-3">ONLINE SYSTEM</div>
            <div className="space-y-2 text-sm text-gray-300">
              <button onClick={() => { setActiveSection("task"); setActiveTab("manage"); }} className="hover:text-white">Tasks</button>
              <button onClick={() => { setActiveSection("pendingRequests"); setActiveTab("modifications"); }} className="hover:text-white">Requests</button>
              <button onClick={() => setActiveSection("meetings")} className="hover:text-white">Meetings</button>
              <button onClick={() => setActiveSection("notices")} className="hover:text-white">Notices</button>
              <button onClick={() => { setActiveSection("analytics"); setActiveTab("performance"); }} className="hover:text-white">Analytics</button>
              <button onClick={() => setActiveSection("community")} className="hover:text-white">Community</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">System Details</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-3">USEFUL LINKS</div>
            <div className="space-y-2 text-sm text-gray-300">
              <button onClick={() => setActiveSection("overview")} className="hover:text-white">Dashboard Overview</button>
              <button onClick={() => setActiveSection("employee")} className="hover:text-white">Employee Management</button>
              <button onClick={() => setActiveSection("oversight")} className="hover:text-white">Task Oversight</button>
              <button onClick={() => setActiveSection("review")} className="hover:text-white">Reviews & Approvals</button>
              <button onClick={() => { setActiveSection("task"); setActiveTab("history"); }} className="hover:text-white">History & Audit</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-3">POLICIES & COMPLIANCE</div>
            <div className="space-y-2 text-sm text-gray-300">
              <button onClick={() => setActiveSection("system")} className="hover:text-white">Security & Privacy</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">SLA & Compliance</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">Data Retention</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">Role Permissions</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">Incident Response</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-3">KEEP IN TOUCH</div>
            <div className="space-y-2 text-sm text-gray-300">
              <button onClick={() => setActiveSection("notices")} className="hover:text-white">Support: support@ems.com</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">System Owner: Jyoti</button>
              <button onClick={() => setActiveSection("system")} className="hover:text-white">Status: Enterprise Edition</button>
            </div>
            <div className="text-xs text-gray-500 mt-5">EXPERIENCE EMS APP ON MOBILE</div>
            <button onClick={() => setActiveSection("system")} className="text-sm text-gray-300 mt-2 hover:text-white">
              Mobile access coming soon
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-10 border-t border-gray-800 pt-6 space-y-3">
          <div className="text-xs text-gray-500">
            100% original audit trail guarantee for all task changes and approvals in EMS.
          </div>
          <div className="text-xs text-gray-500">
            Recoverable history within 14 days for critical task changes.
          </div>
          <div className="text-xs text-gray-500">
            POPULAR SEARCHES: Task Accepted  Task Declined  Extension Requested  Modification Approved  Reopen SLA 
            Activity Timeline  Work Submission  Employee Insights  Failure Analytics  Notice Comment  Meeting Scheduled
          </div>
          <button
            onClick={() => setActiveSection("notices")}
            className="text-xs text-gray-500 hover:text-white text-left"
          >
            In case of any concern, Contact Us.
          </button>
          <div className="text-xs text-gray-500">
             {new Date().getFullYear()} EMS Console. All rights reserved. Built by Jyoti.
          </div>
        </div>
      </footer>
    </div>
    <SmartNotifications
      role="admin"
      items={adminSmartNotifications}
      sessionKey={user?.token || ""}
      policy={{
        dedupeWindowMinutes: notificationPolicy.dedupeWindowMinutes,
        maxImportantToasts: notificationPolicy.maxImportantToasts,
        importantSnoozeMinutes: notificationPolicy.importantSnoozeMinutes,
        criticalOverdueHours: notificationPolicy.criticalOverdueHours,
        escalationAckRequired: notificationPolicy.escalationAckRequired,
        quietHoursStart: notificationPolicy.eveningQuietStart,
        quietHoursEnd: notificationPolicy.morningQuietEnd
      }}
    />
    <ChatbotWidget
      title="Admin Help Bot"
      context={{
        role: "admin",
        screen: activeSection,
        stats: {
          overdue: dashboardMetrics.overdueTasks.length,
          pendingReviews: dashboardMetrics.pendingReviews.length,
          pendingExtensions: dashboardMetrics.pendingExtensions,
          pendingModifications: dashboardMetrics.pendingModifications,
          pendingReopens: dashboardMetrics.pendingReopens
        }
      }}
    />
    </>
  );
};

export default AdminDashboard;
































