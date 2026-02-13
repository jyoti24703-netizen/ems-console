import { API_BASE_URL } from "../../config/api";
﻿import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthProvider";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";

const PerformanceSnapshot = () => {
  const { user, token } = useContext(AuthContext);
  const authToken = token || user?.token || localStorage.getItem("token");
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [timeframe, setTimeframe] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("overview");
  const [meetingsAll, setMeetingsAll] = useState([]);
  const [noticesAll, setNoticesAll] = useState([]);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ title: "", note: "" });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSavedAt, setReviewSavedAt] = useState("");
  const [reviewHistory, setReviewHistory] = useState([]);
  const [reviewActionLoadingId, setReviewActionLoadingId] = useState("");
  const [editingReviewId, setEditingReviewId] = useState("");
  const [editDraft, setEditDraft] = useState({ title: "", note: "" });
  const [reviewPublishStatus, setReviewPublishStatus] = useState("");
  const [reviewReplyDraftById, setReviewReplyDraftById] = useState({});
  const [reviewReplyLoadingById, setReviewReplyLoadingById] = useState({});
  const [expandedReviewIds, setExpandedReviewIds] = useState({});
  const [expandedThreadIds, setExpandedThreadIds] = useState({});
  const [failureViewMode, setFailureViewMode] = useState("combined");

  const syncEmployeeReviewPreview = (employeePayload) => {
    if (!employeePayload?._id) return;
    setEmployees((prev) =>
      (prev || []).map((emp) =>
        emp._id === employeePayload._id
          ? { ...emp, performanceReview: employeePayload.performanceReview || emp.performanceReview }
          : emp
      )
    );
  };

  const chartColors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#64748b"];

  const getTaskAssigneeId = (task) => {
    if (!task) return null;
    if (task.assignedTo?._id) return task.assignedTo._id;
    return task.assignedTo;
  };

  const getTimeframeStart = (tf) => {
    const now = new Date();
    if (tf === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
    if (tf === "quarter") {
      const quarter = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), quarter * 3, 1);
    }
    if (tf === "year") return new Date(now.getFullYear(), 0, 1);
    return null;
  };

  // Fetch employees
  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    setEmployeesError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store"
      });
      if (res.status === 304) {
        return;
      }
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || []);
      } else {
        setEmployees([]);
        setEmployeesError(data.error || "Failed to load employees");
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setEmployees([]);
      setEmployeesError("Failed to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  // Fetch performance data
  const fetchPerformanceData = async (employeeId, timeframeParam) => {
    if (!employeeId) return;
    
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tasks/performance/${employeeId}?timeframe=${timeframeParam}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        }
      );
      if (res.status === 304) {
        setLoading(false);
        return;
      }
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (data.success) {
        const metrics = data.metrics || data.performanceMetrics || {};
        setPerformanceData({
          ...data,
          metrics
        });
      } else {
        setPerformanceData(null);
        setError(data.error || "Failed to load performance data");
      }
    } catch (err) {
      console.error("Failed to fetch performance data:", err);
      setPerformanceData(null);
      setError(err.message || "Failed to load performance data");
    } finally {
      setLoading(false);
    }
  };

  const fetchExtras = async (employeeId, timeframeParam) => {
    if (!employeeId) return;
    setExtrasLoading(true);
    try {
      const [upcomingRes, pastRes, noticesRes, tasksRes, communityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/meetings/upcoming`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        }),
        fetch(`${API_BASE_URL}/api/meetings/past`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        }),
        fetch(`${API_BASE_URL}/api/notices?includeExpired=true`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        }),
        fetch(`${API_BASE_URL}/api/tasks`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        }),
        fetch(`${API_BASE_URL}/api/community/feed`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store"
        })
      ]);

      const [upcomingData, pastData, noticesData, tasksData, communityData] = await Promise.all([
        upcomingRes.json(),
        pastRes.json(),
        noticesRes.json(),
        tasksRes.json(),
        communityRes.json()
      ]);

      const meetingsCombined = [
        ...(upcomingData.meetings || []),
        ...(pastData.meetings || [])
      ];

      const notices = noticesData.notices || [];
      const tasks = tasksData.tasks || [];
      const posts = communityData.posts || [];

      const start = getTimeframeStart(timeframeParam);

      const filteredMeetings = meetingsCombined.filter(m => {
        const isAttendee = m.attendees?.some(a => a.employee?._id === employeeId || a.employee === employeeId);
        if (!isAttendee) return false;
        if (!start) return true;
        return new Date(m.meetingDateTime) >= start;
      });

      const filteredNotices = notices.filter(n => {
        const recipient = n.recipients?.find(r => r.user?._id === employeeId || r.user === employeeId);
        if (!recipient) return false;
        if (!start) return true;
        const ts = n.sendAt || n.createdAt;
        return ts ? new Date(ts) >= start : false;
      });

      const filteredTasks = tasks.filter(t => {
        const assigneeId = getTaskAssigneeId(t);
        if (assigneeId !== employeeId) return false;
        if (!start) return true;
        return new Date(t.createdAt) >= start;
      });

      const filteredPosts = posts.filter(p => {
        if (!start) return true;
        return new Date(p.createdAt) >= start;
      });

      setMeetingsAll(filteredMeetings);
      setNoticesAll(filteredNotices);
      setEmployeeTasks(filteredTasks);
      setAllTasks(tasks);
      setCommunityPosts(filteredPosts);
    } catch (err) {
      console.error("Failed to fetch performance extras:", err);
      setMeetingsAll([]);
      setNoticesAll([]);
      setEmployeeTasks([]);
      setAllTasks([]);
      setCommunityPosts([]);
    } finally {
      setExtrasLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchPerformanceData(selectedEmployee._id, timeframe);
      fetchExtras(selectedEmployee._id, timeframe);
    }
  }, [selectedEmployee, timeframe]);

  useEffect(() => {
    const pr = performanceData?.employee?.performanceReview;
    const rawHistory = performanceData?.employee?.performanceReviewHistory || [];
    const visibleHistory = rawHistory.filter((r) => !r?.isDeleted);
    const hasLegacyReview = Boolean(pr?.title || pr?.note);

    const mergedHistory = visibleHistory.length > 0
      ? visibleHistory
      : hasLegacyReview
        ? [{
            _id: "legacy-current-review",
            title: pr?.title || "Untitled review",
            note: pr?.note || "",
            publishedAt: pr?.updatedAt || pr?.createdAt || new Date().toISOString(),
            editedAt: pr?.updatedAt || null,
            employeeComments: Array.isArray(pr?.employeeComments) ? pr.employeeComments : []
          }]
        : [];

    setReviewSavedAt(pr?.updatedAt ? new Date(pr.updatedAt).toLocaleString() : "");
    setReviewHistory(
      mergedHistory.sort((a, b) =>
        new Date(b.publishedAt || b.updatedAt || 0) - new Date(a.publishedAt || a.updatedAt || 0)
      )
    );
  }, [performanceData]);

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setReviewDraft({ title: "", note: "" });
    setReviewPublishStatus("");
    setEditingReviewId("");
    setEditDraft({ title: "", note: "" });
  };

  const savePerformanceReview = async () => {
    if (!selectedEmployee) return;
    if (!authToken) {
      alert("Session expired. Please re-login.");
      return;
    }
    setReviewSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees/${selectedEmployee._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          performanceReviewTitle: reviewDraft.title,
          performanceReviewNote: reviewDraft.note
        })
      });
      const data = await res.json();
      if (data.success) {
        const updated = data.employee?.performanceReview || {
          title: reviewDraft.title,
          note: reviewDraft.note,
          updatedAt: new Date().toISOString()
        };
        setReviewDraft({ title: "", note: "" });
        setReviewSavedAt(updated.updatedAt ? new Date(updated.updatedAt).toLocaleString() : "");
        setReviewPublishStatus("Review published");
        setReviewHistory(
          (data.employee?.performanceReviewHistory || [])
            .filter((r) => !r.isDeleted)
            .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
        );
        setPerformanceData(prev => prev ? {
          ...prev,
          employee: {
            ...prev.employee,
            performanceReview: updated,
            performanceReviewHistory: (data.employee?.performanceReviewHistory || prev.employee?.performanceReviewHistory || [])
              .filter((r) => !r.isDeleted)
              .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
          }
        } : prev);
        syncEmployeeReviewPreview(data.employee);
      } else {
        alert(data.error || "Failed to save review");
      }
    } catch (err) {
      console.error("Failed to save performance review:", err);
      alert("Failed to save review");
    } finally {
      setReviewSaving(false);
    }
  };

  const REVIEW_EDIT_WINDOW_MINUTES = 60;
  const canModifyReview = (review) => {
    if (!review?.publishedAt) return false;
    const elapsed = Date.now() - new Date(review.publishedAt).getTime();
    return elapsed <= REVIEW_EDIT_WINDOW_MINUTES * 60 * 1000;
  };

  const startEditReview = (review) => {
    setEditingReviewId(review._id);
    setEditDraft({
      title: review.title || "",
      note: review.note || ""
    });
  };

  const cancelEditReview = () => {
    setEditingReviewId("");
    setEditDraft({ title: "", note: "" });
  };

  const submitEditReview = async (reviewId) => {
    if (!selectedEmployee?._id || !reviewId) return;
    setReviewActionLoadingId(reviewId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees/${selectedEmployee._id}/performance-reviews/${reviewId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: editDraft.title,
          note: editDraft.note
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update review");
        return;
      }
      const history = (data.employee?.performanceReviewHistory || [])
        .filter((r) => !r.isDeleted)
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      setReviewHistory(history);
      setReviewSavedAt(data.employee?.performanceReview?.updatedAt ? new Date(data.employee.performanceReview.updatedAt).toLocaleString() : "");
      setReviewPublishStatus("Review updated");
      setEditingReviewId("");
      setPerformanceData(prev => prev ? {
        ...prev,
        employee: {
          ...prev.employee,
          performanceReview: data.employee?.performanceReview || prev.employee?.performanceReview,
          performanceReviewHistory: history
        }
      } : prev);
      syncEmployeeReviewPreview(data.employee);
    } catch (err) {
      console.error("Failed to edit review:", err);
      alert("Failed to update review");
    } finally {
      setReviewActionLoadingId("");
    }
  };

  const deleteReview = async (reviewId) => {
    if (!selectedEmployee?._id || !reviewId) return;
    if (!window.confirm("Delete this review entry?")) return;
    setReviewActionLoadingId(reviewId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees/${selectedEmployee._id}/performance-reviews/${reviewId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete review");
        return;
      }
      const history = (data.employee?.performanceReviewHistory || [])
        .filter((r) => !r.isDeleted)
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      setReviewHistory(history);
      setReviewSavedAt(data.employee?.performanceReview?.updatedAt ? new Date(data.employee.performanceReview.updatedAt).toLocaleString() : "");
      setReviewPublishStatus("Review deleted");
      setPerformanceData(prev => prev ? {
        ...prev,
        employee: {
          ...prev.employee,
          performanceReview: data.employee?.performanceReview || null,
          performanceReviewHistory: history
        }
      } : prev);
      syncEmployeeReviewPreview(data.employee);
    } catch (err) {
      console.error("Failed to delete review:", err);
      alert("Failed to delete review");
    } finally {
      setReviewActionLoadingId("");
    }
  };

  const postAdminReviewReply = async (reviewId) => {
    if (!selectedEmployee?._id || !reviewId) return;
    const text = String(reviewReplyDraftById[reviewId] || "").trim();
    if (!text) return;

    setReviewReplyLoadingById((prev) => ({ ...prev, [reviewId]: true }));
    try {
      const isLegacyReview = String(reviewId).startsWith("legacy-");
      const replyUrl = isLegacyReview
        ? `${API_BASE_URL}/api/admin/employees/${selectedEmployee._id}/performance-review/comment`
        : `${API_BASE_URL}/api/admin/employees/${selectedEmployee._id}/performance-reviews/${reviewId}/comment`;
      const res = await fetch(replyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to post reply");
        return;
      }

      const history = (data.employee?.performanceReviewHistory || [])
        .filter((r) => !r.isDeleted)
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

      setReviewHistory(history);
      setPerformanceData((prev) => prev ? {
        ...prev,
        employee: {
          ...prev.employee,
          performanceReview: data.employee?.performanceReview || prev.employee?.performanceReview,
          performanceReviewHistory: history
        }
      } : prev);
      syncEmployeeReviewPreview(data.employee);
      setReviewReplyDraftById((prev) => ({ ...prev, [reviewId]: "" }));
    } catch (err) {
      console.error("Failed to post admin review reply:", err);
      alert("Failed to post reply");
    } finally {
      setReviewReplyLoadingById((prev) => ({ ...prev, [reviewId]: false }));
    }
  };

  const toggleReviewExpanded = (reviewId) => {
    setExpandedReviewIds((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  const toggleThreadExpanded = (reviewId) => {
    setExpandedThreadIds((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  const getPerformanceGrade = (rate) => {
    const percentage = Number.isFinite(parseFloat(rate)) ? parseFloat(rate) : 0;
    if (percentage >= 90) return { grade: "A+", color: "text-green-400", bg: "bg-green-900/30" };
    if (percentage >= 80) return { grade: "A", color: "text-green-400", bg: "bg-green-900/30" };
    if (percentage >= 70) return { grade: "B", color: "text-blue-400", bg: "bg-blue-900/30" };
    if (percentage >= 60) return { grade: "C", color: "text-yellow-400", bg: "bg-yellow-900/30" };
    return { grade: "D", color: "text-red-400", bg: "bg-red-900/30" };
  };

  const getMetricColor = (value, threshold) => {
    if (!Number.isFinite(value)) return "text-gray-400";
    if (value >= threshold) return "text-green-400";
    if (value >= threshold * 0.7) return "text-yellow-400";
    return "text-red-400";
  };

  
  const activeEmployeeList = useMemo(() => {
    return employees.filter(e => (e.status || "active") === "active");
  }, [employees]);

  const displayEmployees = useMemo(() => {
    return activeEmployeeList.length > 0 ? activeEmployeeList : employees;
  }, [activeEmployeeList, employees]);

  const reviewAcknowledgementTracker = useMemo(() => {
    const rows = (displayEmployees || []).map((emp) => {
      const pr = emp?.performanceReview || {};
      const title = String(pr.title || "").trim();
      const note = String(pr.note || "").trim();
      const hasPublishedReview = Boolean(title || note);
      const commentsCount = Array.isArray(pr.employeeComments) ? pr.employeeComments.length : 0;
      const acknowledged = Boolean(pr.acknowledgedByEmployee);
      const hidden = Boolean(pr.hiddenByEmployee);

      return {
        employeeId: emp._id,
        employeeName: emp.name || "Unknown",
        employeeEmail: emp.email || "-",
        hasPublishedReview,
        reviewTitle: title || "No published review",
        reviewUpdatedAt: pr.updatedAt || null,
        acknowledged,
        acknowledgedAt: pr.acknowledgedAt || null,
        commentsCount,
        commented: commentsCount > 0,
        hidden
      };
    });

    return rows.sort((a, b) => {
      if (a.hasPublishedReview !== b.hasPublishedReview) return a.hasPublishedReview ? -1 : 1;
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      return new Date(b.reviewUpdatedAt || 0) - new Date(a.reviewUpdatedAt || 0);
    });
  }, [displayEmployees]);

const meetingStats = useMemo(() => {
    const total = meetingsAll.length;
    const attended = meetingsAll.filter(m =>
      m.attendees?.some(a => (a.employee?._id === selectedEmployee?._id || a.employee === selectedEmployee?._id) && a.attended)
    ).length;
    const rsvpPending = meetingsAll.filter(m =>
      m.attendees?.some(a => (a.employee?._id === selectedEmployee?._id || a.employee === selectedEmployee?._id) && a.rsvpStatus === "pending")
    ).length;
    const declined = meetingsAll.filter(m =>
      m.attendees?.some(a => (a.employee?._id === selectedEmployee?._id || a.employee === selectedEmployee?._id) && a.rsvpStatus === "declined")
    ).length;
    const attendanceRate = total > 0 ? ((attended / total) * 100).toFixed(1) : 0;
    return { total, attended, rsvpPending, declined, attendanceRate };
  }, [meetingsAll, selectedEmployee]);

  const noticeStats = useMemo(() => {
    const total = noticesAll.length;
    const read = noticesAll.filter(n =>
      n.recipients?.some(r => (r.user?._id === selectedEmployee?._id || r.user === selectedEmployee?._id) && r.read)
    ).length;
    const acknowledged = noticesAll.filter(n =>
      n.recipients?.some(r => (r.user?._id === selectedEmployee?._id || r.user === selectedEmployee?._id) && r.acknowledged)
    ).length;
    const unread = Math.max(total - read, 0);
    const readRate = total > 0 ? ((read / total) * 100).toFixed(1) : 0;
    return { total, read, unread, acknowledged, readRate };
  }, [noticesAll, selectedEmployee]);

  const requestStats = useMemo(() => {
    const adminRequests = employeeTasks.flatMap(t => t.modificationRequests || []);
    const total = adminRequests.length;
    const responded = adminRequests.filter(r => r.response?.respondedAt).length;
    const pending = adminRequests.filter(r => r.status === "pending").length;
    const expired = adminRequests.filter(r => r.status === "expired").length;
    const responseRate = total > 0 ? ((responded / total) * 100).toFixed(1) : 0;
    return { total, responded, pending, expired, responseRate };
  }, [employeeTasks]);

  const complianceStats = useMemo(() => {
    const declined = employeeTasks.filter(t => t.status === "declined_by_employee").length;
    const failed = employeeTasks.filter(t => t.status === "failed").length;
    const reopened = employeeTasks.filter(t => t.status === "reopened").length;
    const withdrawn = employeeTasks.filter(t => t.status === "withdrawn").length;
    return { declined, failed, reopened, withdrawn };
  }, [employeeTasks]);

  const weightedMetrics = useMemo(() => {
    const weightMap = { low: 1, medium: 1.2, high: 1.5, critical: 2 };
    if (employeeTasks.length === 0) return { weightedVerification: 0, weightedOnTime: 0 };
    const totals = employeeTasks.reduce((acc, task) => {
      const weight = weightMap[task.priority] || 1;
      acc.total += weight;
      if (task.status === "verified") acc.verified += weight;
      if (task.completedAt && task.dueDate && new Date(task.completedAt) <= new Date(task.dueDate)) {
        acc.onTime += weight;
      }
      return acc;
    }, { total: 0, verified: 0, onTime: 0 });

    return {
      weightedVerification: totals.total > 0 ? ((totals.verified / totals.total) * 100).toFixed(1) : 0,
      weightedOnTime: totals.total > 0 ? ((totals.onTime / totals.total) * 100).toFixed(1) : 0
    };
  }, [employeeTasks]);

  const priorityMixData = useMemo(() => {
    const counts = employeeTasks.reduce((acc, t) => {
      const key = (t.priority || "unspecified").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value
    })).filter(item => item.value > 0);
  }, [employeeTasks]);

  const workloadMixData = useMemo(() => {
    const counts = employeeTasks.reduce((acc, t) => {
      const status = (t.status || "active").toLowerCase();
      if (status === "verified") acc.verified += 1;
      else if (status === "failed") acc.failed += 1;
      else if (status === "reopened") acc.reopened += 1;
      else if (status === "declined_by_employee") acc.declined += 1;
      else if (status === "withdrawn") acc.withdrawn += 1;
      else if (status === "completed" || status === "submitted") acc.completed += 1;
      else acc.active += 1;
      return acc;
    }, { active: 0, completed: 0, verified: 0, failed: 0, reopened: 0, declined: 0, withdrawn: 0 });
    return [
      { name: "Active", value: counts.active },
      { name: "Completed", value: counts.completed },
      { name: "Verified", value: counts.verified },
      { name: "Failed", value: counts.failed },
      { name: "Reopened", value: counts.reopened },
      { name: "Declined", value: counts.declined },
      { name: "Withdrawn", value: counts.withdrawn }
    ].filter(item => item.value > 0);
  }, [employeeTasks]);

  const slaStats = useMemo(() => {
    const now = new Date();
    const withDue = employeeTasks.filter(t => t.dueDate);
    const completed = withDue.filter(t => t.completedAt);
    const onTime = completed.filter(t => new Date(t.completedAt) <= new Date(t.dueDate));
    const late = completed.filter(t => new Date(t.completedAt) > new Date(t.dueDate));
    const overdueOpen = withDue.filter(t => !t.completedAt && new Date(t.dueDate) < now);
    const onTimeRate = completed.length > 0 ? ((onTime.length / completed.length) * 100).toFixed(1) : 0;
    return {
      withDue: withDue.length,
      completed: completed.length,
      onTime: onTime.length,
      late: late.length,
      overdueOpen: overdueOpen.length,
      onTimeRate
    };
  }, [employeeTasks]);

  const slaMixData = useMemo(() => {
    return [
      { name: "On Time", value: slaStats.onTime },
      { name: "Late", value: slaStats.late },
      { name: "Overdue Open", value: slaStats.overdueOpen }
    ].filter(item => item.value > 0);
  }, [slaStats]);

  const requestTypeMix = useMemo(() => {
    const requests = employeeTasks.flatMap(t => t.modificationRequests || []);
    const counts = requests.reduce((acc, r) => {
      const key = (r.requestType || "other").replace(/_/g, " ");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employeeTasks]);

  const teamBaseline = useMemo(() => {
    const start = getTimeframeStart(timeframe);
    const teamTasks = allTasks.filter(t => {
      if (!t.assignedTo) return false;
      if (t.assignedTo?.role && t.assignedTo.role !== "employee") return false;
      if (!start) return true;
      return new Date(t.createdAt) >= start;
    });
    const total = teamTasks.length;
    const verified = teamTasks.filter(t => t.status === "verified").length;
    const onTime = teamTasks.filter(t => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)).length;
    const reopen = teamTasks.filter(t => t.status === "reopened").length;
    return {
      total,
      verificationRate: total > 0 ? ((verified / total) * 100).toFixed(1) : 0,
      onTimeRate: total > 0 ? ((onTime / total) * 100).toFixed(1) : 0,
      reopenRate: total > 0 ? ((reopen / total) * 100).toFixed(1) : 0
    };
  }, [allTasks, timeframe]);

  const teamBenchmarkData = useMemo(() => {
    const verificationRate = parseFloat(performanceData?.metrics?.verificationRate || 0);
    const onTimeRate = parseFloat(performanceData?.metrics?.onTimeRate || 0);
    const reopenRate = parseFloat(performanceData?.metrics?.reopenRate || 0);
    return [
      { name: "Verification", employee: verificationRate, team: parseFloat(teamBaseline.verificationRate || 0) },
      { name: "On Time", employee: onTimeRate, team: parseFloat(teamBaseline.onTimeRate || 0) },
      { name: "Reopen", employee: reopenRate, team: parseFloat(teamBaseline.reopenRate || 0) }
    ];
  }, [performanceData, teamBaseline]);

  const responseTimeliness = useMemo(() => {
    const requests = employeeTasks.flatMap(t => t.modificationRequests || []);
    const responded = requests.filter(r => r.response?.respondedAt && r.requestedAt);
    const avgHours = responded.length > 0
      ? responded.reduce((sum, r) => sum + (new Date(r.response.respondedAt) - new Date(r.requestedAt)) / (1000 * 60 * 60), 0) / responded.length
      : 0;
    return avgHours.toFixed(1);
  }, [employeeTasks]);

  const trendData = useMemo(() => {
    const days = 30;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const buckets = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { date: label, completed: 0, onTime: 0, verified: 0 };
    });

    employeeTasks.forEach(t => {
      if (!t.completedAt) return;
      const completedDate = new Date(t.completedAt);
      const diffDays = Math.floor((completedDate - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays >= days) return;
      const bucket = buckets[diffDays];
      bucket.completed += 1;
      if (t.status === "verified") bucket.verified += 1;
      if (t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)) bucket.onTime += 1;
    });

    return buckets.map(b => ({
      date: b.date,
      onTimeRate: b.completed > 0 ? Math.round((b.onTime / b.completed) * 100) : 0,
      verificationRate: b.completed > 0 ? Math.round((b.verified / b.completed) * 100) : 0
    }));
  }, [employeeTasks]);

  const compositeScore = useMemo(() => {
    const verificationRate = parseFloat(performanceData?.metrics?.verificationRate || 0);
    const onTimeRate = parseFloat(performanceData?.metrics?.onTimeRate || 0);
    const attendanceRate = parseFloat(meetingStats.attendanceRate || 0);
    const noticeReadRate = parseFloat(noticeStats.readRate || 0);
    const responseRate = parseFloat(requestStats.responseRate || 0);
    const score = (verificationRate * 0.35) +
      (onTimeRate * 0.3) +
      (attendanceRate * 0.1) +
      (noticeReadRate * 0.1) +
      (responseRate * 0.15);
    return Math.round(score);
  }, [performanceData, meetingStats, noticeStats, requestStats]);

  const riskFlags = useMemo(() => {
    const flags = [];
    const verificationRate = parseFloat(performanceData?.metrics?.verificationRate || 0);
    const onTimeRate = parseFloat(performanceData?.metrics?.onTimeRate || 0);
    const reopenRate = parseFloat(performanceData?.metrics?.reopenRate || 0);
    const failureRate = performanceData?.metrics?.totalTasks
      ? (performanceData.metrics.failed / performanceData.metrics.totalTasks) * 100
      : 0;

    if (verificationRate < 70) flags.push("Low verification rate");
    if (onTimeRate < 60) flags.push("On-time delivery below target");
    if (reopenRate > 20) flags.push("High reopen rate");
    if (failureRate > 10) flags.push("Failure rate above threshold");
    if (requestStats.pending > 0) flags.push("Pending modification responses");
    return flags;
  }, [performanceData, requestStats]);

  const taskStatusData = useMemo(() => {
    const counts = employeeTasks.reduce((acc, t) => {
      const key = t.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value
    })).filter(item => item.value > 0);
  }, [employeeTasks]);

  const reviewStats = useMemo(() => {
    const submittedTasks = employeeTasks.filter(t => t.completedAt || t.workSubmission?.submittedAt);
    const verified = employeeTasks.filter(t => t.status === "verified").length;
    const failed = employeeTasks.filter(t => t.status === "failed").length;
    const pendingReview = employeeTasks.filter(t => t.status === "completed").length;
    const reviewedTasks = employeeTasks.filter(t => t.reviewedAt && (t.completedAt || t.workSubmission?.submittedAt));
    const avgReviewHours = reviewedTasks.length > 0
      ? (reviewedTasks.reduce((sum, t) => {
          const submittedAt = new Date(t.completedAt || t.workSubmission?.submittedAt);
          const reviewedAt = new Date(t.reviewedAt);
          return sum + (reviewedAt - submittedAt) / (1000 * 60 * 60);
        }, 0) / reviewedTasks.length).toFixed(1)
      : 0;
    const reviewPassRate = (verified + failed) > 0 ? ((verified / (verified + failed)) * 100).toFixed(1) : 0;
    return {
      submitted: submittedTasks.length,
      verified,
      failed,
      pendingReview,
      avgReviewHours,
      reviewPassRate
    };
  }, [employeeTasks]);

  const reviewOutcomeData = useMemo(() => {
    return [
      { name: "Verified", value: reviewStats.verified },
      { name: "Failed", value: reviewStats.failed },
      { name: "Pending Review", value: reviewStats.pendingReview }
    ].filter(item => item.value > 0);
  }, [reviewStats]);

  const reviewLagData = useMemo(() => {
    const buckets = [
      { name: "<24h", value: 0 },
      { name: "24-48h", value: 0 },
      { name: "48-72h", value: 0 },
      { name: ">72h", value: 0 }
    ];
    employeeTasks.forEach(t => {
      if (!t.reviewedAt) return;
      const submittedAt = t.completedAt || t.workSubmission?.submittedAt;
      if (!submittedAt) return;
      const hours = (new Date(t.reviewedAt) - new Date(submittedAt)) / (1000 * 60 * 60);
      if (hours < 24) buckets[0].value += 1;
      else if (hours < 48) buckets[1].value += 1;
      else if (hours < 72) buckets[2].value += 1;
      else buckets[3].value += 1;
    });
    return buckets.filter(b => b.value > 0);
  }, [employeeTasks]);

  const pollStats = useMemo(() => {
    const polls = communityPosts.filter(p => (p.postType || p.type) === "poll");
    const votedPolls = polls.filter(p =>
      p.pollOptions?.some(opt => opt.voters?.some(v => (v?._id || v).toString() === selectedEmployee?._id))
    );
    const pendingPolls = polls.filter(p =>
      !p.pollOptions?.some(opt => opt.voters?.some(v => (v?._id || v).toString() === selectedEmployee?._id))
    );
    const participationRate = polls.length > 0
      ? ((votedPolls.length / polls.length) * 100).toFixed(1)
      : 0;
    return {
      total: polls.length,
      voted: votedPolls.length,
      pending: pendingPolls.length,
      participationRate
    };
  }, [communityPosts, selectedEmployee]);

  const requestResponseData = useMemo(() => {
    return [
      { name: "Responded", value: requestStats.responded },
      { name: "Pending", value: requestStats.pending },
      { name: "Expired", value: requestStats.expired }
    ].filter(item => item.value > 0);
  }, [requestStats]);

  const taskOutcomeData = useMemo(() => {
    if (!performanceData?.metrics) return [];
    if (!(performanceData.metrics.totalTasks ?? 0)) return [];
    return [
      { name: "Verified", value: performanceData.metrics.verified ?? 0 },
      { name: "Failed", value: performanceData.metrics.failed ?? 0 },
      { name: "Reopened (Current)", value: performanceData.metrics.reopenedCurrentCount ?? 0 },
      { name: "Declined", value: complianceStats.declined },
      { name: "Withdrawn", value: complianceStats.withdrawn }
    ].filter(item => item.value > 0);
  }, [performanceData, complianceStats]);

  const failureBarData = useMemo(() => {
    const fb = performanceData?.failureBreakdown;
    if (!fb) return [];
    const all = [
      { name: "Late (Hist)", value: fb.lateHistorical ?? fb.lateSubmissions ?? 0 },
      { name: "Late (Now)", value: fb.lateCurrentOpen || 0 },
      { name: "No Response", value: fb.noResponse || 0 },
      { name: "Reopen Events", value: fb.reopensHistorical ?? fb.reopens ?? 0 },
      { name: "Reopened Now", value: fb.reopensCurrent || 0 },
      { name: "Declined (Hist)", value: fb.declinesHistorical ?? fb.declines ?? 0 },
      { name: "Declined (Now)", value: fb.declinesCurrent ?? fb.declines ?? 0 },
      { name: "SLA (Hist)", value: fb.slaBreachesHistorical ?? fb.slaBreaches ?? 0 },
      { name: "SLA (Now)", value: fb.slaBreachesCurrent || 0 },
      { name: "Ext Breach", value: fb.extensionBreaches || 0 }
    ];
    if (failureViewMode === "current") {
      return all.filter((x) =>
        ["Late (Now)", "Reopened Now", "Declined (Now)", "SLA (Now)", "Ext Breach", "No Response"].includes(x.name)
      );
    }
    if (failureViewMode === "historical") {
      return all.filter((x) =>
        ["Late (Hist)", "Reopen Events", "Declined (Hist)", "SLA (Hist)", "No Response"].includes(x.name)
      );
    }
    return all;
  }, [performanceData, failureViewMode]);

  const slaCompositionData = useMemo(() => {
    const fb = performanceData?.failureBreakdown;
    if (!fb) return [];
    return [
      { name: "Standard SLA Breach", value: fb.standardSlaBreaches || 0 },
      { name: "Post-Extension Breach", value: fb.extensionBreaches || 0 }
    ].filter((item) => item.value > 0);
  }, [performanceData]);

  const showFailureMetric = (type) => {
    if (failureViewMode === "combined") return true;
    if (failureViewMode === "current") {
      return ["late_now", "no_response", "reopen_now", "decline_now", "sla_now", "ext_breach"].includes(type);
    }
    return ["late_hist", "no_response", "reopen_hist", "decline_hist", "sla_hist"].includes(type);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold">Employee Performance Snapshots</h3>
          <p className="text-sm text-gray-400">Fair evaluation across tasks, meetings, notices, and response behavior.</p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {["all", "month", "quarter", "year"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm ${
                timeframe === tf
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              {tf === "all" ? "All Time" : tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["overview", "Overview"],
          ["engagement", "Engagement"],
          ["compliance", "Compliance"],
          ["communication", "Communication"]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`px-3 py-2 rounded text-sm border ${
              activeView === key
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={selectedEmployee ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-6"}>
        {!selectedEmployee && (
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-4">Select Employee</h4>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {employeesLoading ? (
                <div className="text-sm text-gray-400">Loading employees...</div>
              ) : employeesError ? (
                <div className="text-sm text-red-400">
                  {employeesError}
                  <button
                    onClick={fetchEmployees}
                    className="ml-2 text-xs text-blue-300 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : displayEmployees.length === 0 ? (
                <div className="text-sm text-gray-400">No employees found.</div>
              ) : (
                displayEmployees.map((emp) => (
                  <button
                    key={emp._id}
                    onClick={() => handleEmployeeSelect(emp)}
                    className="w-full text-left p-3 rounded transition bg-gray-700 hover:bg-gray-600 text-gray-300"
                  >
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs opacity-75">{emp.email}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className={selectedEmployee ? "space-y-6" : "lg:col-span-2 space-y-6"}>
          {!selectedEmployee ? (
            <div className="space-y-4">
              <div className="bg-gray-800 p-8 rounded-lg text-center">
                <span className="text-6xl text-blue-400">{"\uD83D\uDCCA"}</span>
                <h3 className="text-xl font-semibold mt-4">
                  Select an Employee
                </h3>
                <p className="text-gray-400 mt-2">
                  Choose an employee from the list to view detailed performance metrics and review history.
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="font-semibold text-white">Review Acknowledgement Tracker</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Governance view of published reviews, acknowledgement state, comments, and employee visibility status.
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {reviewAcknowledgementTracker.length} employee records
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-900 text-gray-300">
                      <tr>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Employee</th>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Review</th>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Published/Updated</th>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Acknowledged</th>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Comments</th>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Dashboard Visibility</th>
                        <th className="text-left px-4 py-2 border-b border-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewAcknowledgementTracker.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-gray-400">No employee records available.</td>
                        </tr>
                      ) : (
                        reviewAcknowledgementTracker.map((row) => (
                          <tr key={row.employeeId} className="border-t border-gray-700">
                            <td className="px-4 py-3">
                              <div className="font-medium text-white">{row.employeeName}</div>
                              <div className="text-xs text-gray-500">{row.employeeEmail}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              <div className="truncate max-w-[260px]" title={row.reviewTitle}>
                                {row.reviewTitle}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {row.reviewUpdatedAt ? new Date(row.reviewUpdatedAt).toLocaleString() : "-"}
                            </td>
                            <td className="px-4 py-3">
                              {row.hasPublishedReview ? (
                                row.acknowledged ? (
                                  <div className="text-xs">
                                    <span className="px-2 py-1 rounded bg-green-900/40 text-green-300">Yes</span>
                                    <div className="text-gray-500 mt-1">{row.acknowledgedAt ? new Date(row.acknowledgedAt).toLocaleString() : "-"}</div>
                                  </div>
                                ) : (
                                  <span className="px-2 py-1 rounded bg-yellow-900/40 text-yellow-300 text-xs">Pending</span>
                                )
                              ) : (
                                <span className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs">No review</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${row.commented ? "bg-blue-900/40 text-blue-300" : "bg-gray-700 text-gray-300"}`}>
                                {row.commentsCount} {row.commentsCount === 1 ? "comment" : "comments"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${row.hidden ? "bg-indigo-900/40 text-indigo-300" : "bg-green-900/40 text-green-300"}`}>
                                {row.hidden ? "Hidden by employee" : "Visible"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  const emp = displayEmployees.find((e) => e._id === row.employeeId);
                                  if (emp) handleEmployeeSelect(emp);
                                }}
                                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
                              >
                                Open Snapshot
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="bg-gray-800 p-12 rounded-lg text-center">
              <div className="text-gray-400 animate-pulse">
                Loading performance data...
              </div>
            </div>
          ) : performanceData && performanceData.metrics ? (
            <>
              {extrasLoading && (
                <div className="bg-gray-800/60 border border-gray-700 p-4 rounded-lg text-sm text-gray-400">
                  Loading meetings, notices, and request analytics...
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="px-3 py-2 rounded-full text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
                >
                 Change Employee
                </button>
              </div>

              {/* Employee Header */}
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {performanceData.employee.name}
                    </h3>
                    <p className="text-gray-400">{performanceData.employee.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Overall Performance</div>
                    <div className={`text-4xl font-bold ${getPerformanceGrade(performanceData.metrics.verificationRate).color}`}>
                      {getPerformanceGrade(performanceData.metrics.verificationRate).grade}
                    </div>
                  </div>
                </div>
              </div>

              {activeView === "overview" && (
                <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                {/* Verification Rate */}
                <div className={`p-6 rounded-lg border-l-4 ${getPerformanceGrade(performanceData.metrics.verificationRate).bg} border-green-500`}>
                  <div className="text-sm text-gray-400">Verification Rate</div>
                  <div className={`text-3xl font-bold mt-2 ${getMetricColor(parseFloat(performanceData.metrics.verificationRate), 80)}`}>
                    {performanceData.metrics.verificationRate ?? 0}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {performanceData.metrics.verified ?? 0} of {performanceData.metrics.totalTasks ?? 0} tasks
                  </div>
                  <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${performanceData.metrics.verificationRate ?? 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* On-Time Rate */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-blue-500">
                  <div className="text-sm text-gray-400">On-Time Delivery</div>
                  <div className={`text-3xl font-bold mt-2 ${getMetricColor(parseFloat(performanceData.metrics.onTimeRate), 75)}`}>
                    {performanceData.metrics.onTimeRate ?? 0}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {performanceData.metrics.onTime ?? 0} on-time submissions
                  </div>
                  <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${performanceData.metrics.onTimeRate ?? 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Avg Acceptance Time */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-yellow-500">
                  <div className="text-sm text-gray-400">Avg Response Time</div>
                  <div className="text-3xl font-bold mt-2 text-yellow-400">
                    {performanceData.metrics.avgAcceptanceTime ?? 0}h
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Time to accept tasks
                  </div>
                </div>

                {/* Avg Completion Time */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-purple-500">
                  <div className="text-sm text-gray-400">Avg Completion Time</div>
                  <div className="text-3xl font-bold mt-2 text-purple-400">
                    {performanceData.metrics.avgCompletionTime ?? 0}h
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Time to complete tasks
                  </div>
                </div>

                {/* Composite Score */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-emerald-500">
                  <div className="text-sm text-gray-400">Composite Score</div>
                  <div className={`text-3xl font-bold mt-2 ${getMetricColor(compositeScore, 80)}`}>
                    {compositeScore}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Weighted: quality, timeliness, engagement, response
                  </div>
                </div>

                {/* Request Response Time */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-cyan-500">
                  <div className="text-sm text-gray-400">Request Response Time</div>
                  <div className="text-3xl font-bold mt-2 text-cyan-400">
                    {responseTimeliness}h
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Avg time to respond to requests
                  </div>
                </div>

                {/* Pending Reviews */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-amber-500">
                  <div className="text-sm text-gray-400">Pending Reviews</div>
                  <div className="text-3xl font-bold mt-2 text-amber-400">
                    {reviewStats.pendingReview}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Submitted tasks awaiting admin review
                  </div>
                </div>

                {/* Avg Review Time */}
                <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-lime-500">
                  <div className="text-sm text-gray-400">Avg Review Time</div>
                  <div className="text-3xl font-bold mt-2 text-lime-400">
                    {reviewStats.avgReviewHours}h
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    From submission to decision
                  </div>
                </div>
                </div>

              {/* Visual Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Task Outcomes</h4>
                  {taskOutcomeData.length === 0 ? (
                    <div className="text-sm text-gray-400">No task outcome data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={taskOutcomeData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {taskOutcomeData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[idx % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {taskOutcomeData.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                      {taskOutcomeData.map((item, idx) => (
                        <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                          <span className="mr-1" style={{ color: chartColors[idx % chartColors.length] }}>&bull;</span>
                          {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
                    <h4 className="font-semibold">Failure Pattern</h4>
                    <div className="flex gap-2">
                      {[
                        { key: "current", label: "Current Only" },
                        { key: "historical", label: "Historical Only" },
                        { key: "combined", label: "Combined" }
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setFailureViewMode(opt.key)}
                          className={`px-2.5 py-1 rounded text-xs ${
                            failureViewMode === opt.key
                              ? "bg-blue-600 text-white"
                              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Shows current vs historical for reopen, decline, late submissions, and SLA breaches.
                  </p>
                  {failureBarData.length === 0 ? (
                    <div className="text-sm text-gray-400">No failure data to display.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={failureBarData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">SLA Breach Composition</h4>
                <p className="text-xs text-gray-400 mb-3">
                  Breaches are split into normal SLA misses and misses after approved extension.
                </p>
                {slaCompositionData.length === 0 ? (
                  <div className="text-sm text-gray-400">No SLA breach data for selected timeframe.</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={slaCompositionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {slaCompositionData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[idx % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                      {slaCompositionData.map((item, idx) => (
                        <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                          <span className="mr-1" style={{ color: chartColors[idx % chartColors.length] }}>●</span>
                          {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Task Status Distribution</h4>
                  {taskStatusData.length === 0 ? (
                    <div className="text-sm text-gray-400">No task status data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={taskStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {taskStatusData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[(idx + 2) % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {taskStatusData.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                      {taskStatusData.map((item, idx) => (
                        <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                          <span className="mr-1" style={{ color: chartColors[(idx + 2) % chartColors.length] }}>&bull;</span>
                          {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Request Response Mix</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Includes modification + reopen responses (edit, delete, extension, reassign, scope change). Status: responded, pending, expired.
                  </p>
                  {requestResponseData.length === 0 ? (
                    <div className="text-sm text-gray-400">No request data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={requestResponseData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {requestResponseData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[(idx + 4) % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {requestResponseData.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                      {requestResponseData.map((item, idx) => (
                        <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                          <span className="mr-1" style={{ color: chartColors[(idx + 4) % chartColors.length] }}>&bull;</span>
                          {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  )}
                  {requestTypeMix.length > 0 && (
                    <div className="mt-3 text-xs text-gray-400">
                      <div className="font-medium text-gray-300 mb-1">Request types (count):</div>
                      <div className="flex flex-wrap gap-2">
                        {requestTypeMix.slice(0, 6).map((item) => (
                          <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                            {item.name}: {item.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Review Outcomes</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Admin review decisions for submitted work: verified, failed, pending.
                  </p>
                  {reviewOutcomeData.length === 0 ? (
                    <div className="text-sm text-gray-400">No review data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={reviewOutcomeData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {reviewOutcomeData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[(idx + 5) % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Review Turnaround</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Time from submission to admin decision.
                  </p>
                  {reviewLagData.length === 0 ? (
                    <div className="text-sm text-gray-400">No review turnaround data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reviewLagData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">SLA Compliance Mix</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Based on tasks with due dates: on time, late, and overdue open.
                  </p>
                  {slaMixData.length === 0 ? (
                    <div className="text-sm text-gray-400">No SLA data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={slaMixData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {slaMixData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[(idx + 1) % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {slaMixData.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                      {slaMixData.map((item, idx) => (
                        <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                          <span className="mr-1" style={{ color: chartColors[(idx + 1) % chartColors.length] }}>&bull;</span>
                          {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Priority Mix</h4>
                  {priorityMixData.length === 0 ? (
                    <div className="text-sm text-gray-400">No priority data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={priorityMixData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          labelLine
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {priorityMixData.map((entry, idx) => (
                            <Cell key={entry.name} fill={chartColors[(idx + 3) % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {priorityMixData.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                      {priorityMixData.map((item, idx) => (
                        <span key={item.name} className="px-2 py-1 bg-gray-700 rounded">
                          <span className="mr-1" style={{ color: chartColors[(idx + 3) % chartColors.length] }}>&bull;</span>
                          {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">30-Day Quality Trend</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    On-time and verification rates by day (last 30 days).
                  </p>
                  {trendData.length === 0 ? (
                    <div className="text-sm text-gray-400">No trend data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Line type="monotone" dataKey="onTimeRate" stroke="#38bdf8" strokeWidth={2} />
                        <Line type="monotone" dataKey="verificationRate" stroke="#22c55e" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Team Benchmark</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Employee vs team averages for verification, on-time, and reopen rates.
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={teamBenchmarkData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip />
                      <Bar dataKey="employee" fill="#60a5fa" name="Employee" />
                      <Bar dataKey="team" fill="#94a3b8" name="Team" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="bg-gray-800 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">Additional Metrics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-700 rounded">
                    <div className="text-2xl font-bold">{performanceData.metrics.totalTasks ?? 0}</div>
                    <div className="text-sm text-gray-400">Total Tasks</div>
                  </div>
                  <div className="text-center p-4 bg-gray-700 rounded">
                    <div className="text-2xl font-bold text-orange-400">
                      {performanceData.metrics.reopenRate ?? 0}%
                    </div>
                    <div className="text-sm text-gray-400">Current Reopen Rate</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Events: {performanceData.metrics.reopenedHistoricalCount ?? 0}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-700 rounded">
                    <div className="text-2xl font-bold text-blue-400">
                      {performanceData.metrics.extended ?? 0}
                    </div>
                    <div className="text-sm text-gray-400">Extensions</div>
                  </div>
                </div>
              </div>

              {/* Failure Breakdown */}
              {performanceData.failureBreakdown && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Failure Analysis</h4>
                  <div className="grid grid-cols-2 md:grid-cols-9 gap-3">
                    {showFailureMetric("late_hist") && <div className="text-center p-3 bg-red-900/20 border border-red-800 rounded">
                      <div className="text-xl font-bold text-red-400">
                        {performanceData.failureBreakdown.lateHistorical ?? performanceData.failureBreakdown.lateSubmissions}
                      </div>
                      <div className="text-xs text-gray-400">Late Hist</div>
                    </div>}
                    {showFailureMetric("late_now") && <div className="text-center p-3 bg-red-900/10 border border-red-700 rounded">
                      <div className="text-xl font-bold text-red-300">
                        {performanceData.failureBreakdown.lateCurrentOpen ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">Late Now</div>
                    </div>}
                    {showFailureMetric("no_response") && <div className="text-center p-3 bg-yellow-900/20 border border-yellow-800 rounded">
                      <div className="text-xl font-bold text-yellow-400">
                        {performanceData.failureBreakdown.noResponse}
                      </div>
                      <div className="text-xs text-gray-400">No Response</div>
                    </div>}
                    {showFailureMetric("reopen_hist") && <div className="text-center p-3 bg-orange-900/20 border border-orange-800 rounded">
                      <div className="text-xl font-bold text-orange-400">
                        {performanceData.failureBreakdown.reopensHistorical ?? performanceData.failureBreakdown.reopens}
                      </div>
                      <div className="text-xs text-gray-400">Reopen Events</div>
                    </div>}
                    {showFailureMetric("reopen_now") && <div className="text-center p-3 bg-orange-900/10 border border-orange-700 rounded">
                      <div className="text-xl font-bold text-orange-300">
                        {performanceData.failureBreakdown.reopensCurrent ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">Reopened Now</div>
                    </div>}
                    {showFailureMetric("decline_hist") && <div className="text-center p-3 bg-gray-700 rounded">
                      <div className="text-xl font-bold text-gray-400">
                        {performanceData.failureBreakdown.declinesHistorical ?? performanceData.failureBreakdown.declines}
                      </div>
                      <div className="text-xs text-gray-400">Declined Hist</div>
                    </div>}
                    {showFailureMetric("decline_now") && <div className="text-center p-3 bg-gray-700/60 rounded">
                      <div className="text-xl font-bold text-gray-300">
                        {performanceData.failureBreakdown.declinesCurrent ?? performanceData.failureBreakdown.declines ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">Declined Now</div>
                    </div>}
                    {showFailureMetric("sla_hist") && <div className="text-center p-3 bg-red-900/20 border border-red-800 rounded">
                      <div className="text-xl font-bold text-red-400">
                        {performanceData.failureBreakdown.slaBreachesHistorical ?? performanceData.failureBreakdown.slaBreaches}
                      </div>
                      <div className="text-xs text-gray-400">SLA Hist</div>
                    </div>}
                    {showFailureMetric("sla_now") && <div className="text-center p-3 bg-red-900/10 border border-red-700 rounded">
                      <div className="text-xl font-bold text-red-300">
                        {performanceData.failureBreakdown.slaBreachesCurrent ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">SLA Now</div>
                    </div>}
                    {showFailureMetric("ext_breach") && <div className="text-center p-3 bg-orange-900/20 border border-orange-800 rounded">
                      <div className="text-xl font-bold text-orange-300">
                        {performanceData.failureBreakdown.extensionBreaches ?? 0}
                      </div>
                      <div className="text-xs text-gray-400">Ext Breach</div>
                    </div>}
                  </div>
                </div>
              )}

              {/* Recent Task History */}
              {performanceData.taskHistory && performanceData.taskHistory.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Recent Task History</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {performanceData.taskHistory.slice(0, 10).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded hover:bg-gray-600"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{task.title}</div>
                          <div className="text-xs text-gray-400">
                            Created: {new Date(task.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs px-2 py-1 rounded ${
                            task.status === "verified" ? "bg-green-600" :
                            task.status === "failed" ? "bg-red-600" :
                            "bg-gray-600"
                          }`}>
                            {task.status}
                          </div>
                          {task.completedAt && (
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(task.completedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}

                            {activeView === "overview" && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="font-semibold text-lg">Performance Evaluation Review</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        Confidential manager feedback. Visible only to this employee in their Performance section.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">Review State</div>
                      <div className="text-xs text-gray-300 mt-1">
                        {reviewSavedAt ? `Last updated: ${reviewSavedAt}` : "Draft only"}
                      </div>
                    </div>
                  </div>

                  {reviewPublishStatus && (
                    <div className="mt-4 text-xs text-green-300 bg-green-900/20 border border-green-800 rounded px-3 py-2">
                      {reviewPublishStatus}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                      <div>
                        <label className="text-xs text-gray-400">Review Title</label>
                        <input
                          value={reviewDraft.title}
                          onChange={(e) => setReviewDraft((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200"
                          placeholder="Exceeds Expectations - Q1 Performance Review"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-400">Review Note</label>
                        <textarea
                          value={reviewDraft.note}
                          onChange={(e) => setReviewDraft((prev) => ({ ...prev, note: e.target.value }))}
                          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 min-h-[140px]"
                          placeholder="Summarize delivery quality, ownership, consistency, communication, and next-step improvement areas."
                        />
                        <div className="mt-1 text-[11px] text-gray-500">
                          {reviewDraft.note?.trim()?.length || 0} characters
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-700 rounded p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Publishing Rules</div>
                      <div className="mt-3 space-y-2 text-xs text-gray-300">
                        <div className="flex items-center justify-between">
                          <span>Visibility</span>
                          <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700">Employee Only</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Edit window</span>
                          <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700">{REVIEW_EDIT_WINDOW_MINUTES} min</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Records kept</span>
                          <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700">{reviewHistory.length}</span>
                        </div>
                      </div>
                      <button
                        onClick={savePerformanceReview}
                        disabled={reviewSaving}
                        className="w-full mt-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-60"
                      >
                        {reviewSaving ? "Publishing..." : "Publish Review"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold">Published Review History</h5>
                      <span className="text-xs text-gray-500">{reviewHistory.length} record(s)</span>
                    </div>
                    {reviewHistory.length === 0 ? (
                      <div className="text-sm text-gray-400">No published review history yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {reviewHistory.map((review) => {
                          const editable = canModifyReview(review);
                          const isEditing = editingReviewId === review._id;
                          const isExpanded = Boolean(expandedReviewIds[review._id] || isEditing);
                          const isThreadExpanded = Boolean(expandedThreadIds[review._id]);
                          return (
                            <div key={review._id} className="bg-gray-900 border border-gray-700 rounded p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium text-sm text-white">{review.title || "Untitled review"}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Published: {review.publishedAt ? new Date(review.publishedAt).toLocaleString() : "-"}
                                    {review.editedAt ? ` | Edited: ${new Date(review.editedAt).toLocaleString()}` : ""}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => toggleReviewExpanded(review._id)}
                                    className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                                  >
                                    {isExpanded ? "Collapse" : "Open"}
                                  </button>
                                  <button
                                    onClick={() => (isEditing ? cancelEditReview() : startEditReview(review))}
                                    disabled={!editable || reviewActionLoadingId === review._id}
                                    className="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50"
                                  >
                                    {isEditing ? "Cancel" : "Edit"}
                                  </button>
                                  <button
                                    onClick={() => deleteReview(review._id)}
                                    disabled={!editable || reviewActionLoadingId === review._id}
                                    className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              {isExpanded && isEditing ? (
                                <div className="mt-3 space-y-2">
                                  <input
                                    value={editDraft.title}
                                    onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                                    placeholder="Review title"
                                  />
                                  <textarea
                                    value={editDraft.note}
                                    onChange={(e) => setEditDraft((prev) => ({ ...prev, note: e.target.value }))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm min-h-[100px]"
                                    placeholder="Review note"
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => submitEditReview(review._id)}
                                      disabled={reviewActionLoadingId === review._id}
                                      className="text-xs px-3 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50"
                                    >
                                      {reviewActionLoadingId === review._id ? "Saving..." : "Save Edit"}
                                    </button>
                                  </div>
                                </div>
                              ) : isExpanded ? (
                                <>
                                  <div className="mt-2 text-sm text-gray-300 whitespace-pre-line">{review.note || "-"}</div>
                                  <div className="mt-3 bg-gray-800 border border-gray-700 rounded p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs font-semibold text-gray-300">Employee Comment Thread</div>
                                      <span className="text-[11px] px-2 py-1 rounded bg-gray-900 text-gray-400 border border-gray-700">
                                        {(review.employeeComments || []).length} comment(s)
                                      </span>
                                    </div>
                                    <div className="mt-2">
                                      <button
                                        onClick={() => toggleThreadExpanded(review._id)}
                                        className="text-xs px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-700"
                                      >
                                        {isThreadExpanded ? "Hide Discussion" : "Open Discussion"}
                                      </button>
                                    </div>
                                    {isThreadExpanded && (review.employeeComments || []).length === 0 ? (
                                      <div className="mt-2 text-xs text-gray-500">No employee comments added yet.</div>
                                    ) : isThreadExpanded ? (
                                      <div className="mt-2 space-y-2">
                                        {(review.employeeComments || []).map((comment, idx) => (
                                          <div key={`${comment.commentedAt || idx}`} className="bg-gray-900 border border-gray-700 rounded px-3 py-2">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="text-[11px] text-gray-400">
                                                {comment.commentedByName || "User"}
                                              </div>
                                              <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                (comment.commentedByRole || "employee") === "employee"
                                                  ? "bg-blue-900/40 text-blue-300"
                                                  : "bg-green-900/40 text-green-300"
                                              }`}>
                                                {comment.commentedByRole || "employee"}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-200 whitespace-pre-line mt-1">{comment.text || "-"}</div>
                                            <div className="text-[11px] text-gray-500 mt-1">
                                              {comment.commentedAt ? new Date(comment.commentedAt).toLocaleString() : "-"}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                    {isThreadExpanded && (
                                      <div className="mt-3 flex gap-2">
                                        <input
                                          type="text"
                                          value={reviewReplyDraftById[review._id] || ""}
                                          onChange={(e) => setReviewReplyDraftById((prev) => ({ ...prev, [review._id]: e.target.value }))}
                                          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
                                          placeholder="Reply to this review thread..."
                                        />
                                        <button
                                          onClick={() => postAdminReviewReply(review._id)}
                                          disabled={reviewReplyLoadingById[review._id] || !String(reviewReplyDraftById[review._id] || "").trim()}
                                          className={`px-3 py-2 rounded text-sm ${
                                            reviewReplyLoadingById[review._id] || !String(reviewReplyDraftById[review._id] || "").trim()
                                              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                              : "bg-indigo-700 hover:bg-indigo-600 text-white"
                                          }`}
                                        >
                                          {reviewReplyLoadingById[review._id] ? "Posting..." : "Reply"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : null}
                              {!isExpanded && !isEditing && (
                                <div className="mt-2 text-xs text-gray-500">
                                  {String(review.note || "").slice(0, 120)}{String(review.note || "").length > 120 ? "..." : ""}
                                </div>
                              )}

                              {!editable && (
                                <div className="mt-2 text-xs text-amber-300">
                                  Edit/Delete window closed (allowed for {REVIEW_EDIT_WINDOW_MINUTES} minutes after publish).
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeView === "engagement" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Meeting Attendance</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Meetings Invited</span><span className="font-semibold">{meetingStats.total}</span></div>
                      <div className="flex justify-between"><span>Attended</span><span className="font-semibold text-green-400">{meetingStats.attended}</span></div>
                      <div className="flex justify-between"><span>Declined</span><span className="font-semibold text-red-400">{meetingStats.declined}</span></div>
                      <div className="flex justify-between"><span>RSVP Pending</span><span className="font-semibold text-yellow-400">{meetingStats.rsvpPending}</span></div>
                      <div className="flex justify-between"><span>Attendance Rate</span><span className="font-semibold">{meetingStats.attendanceRate}%</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Notice Engagement</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Notices Received</span><span className="font-semibold">{noticeStats.total}</span></div>
                      <div className="flex justify-between"><span>Read</span><span className="font-semibold text-green-400">{noticeStats.read}</span></div>
                      <div className="flex justify-between"><span>Unread</span><span className="font-semibold text-yellow-400">{noticeStats.unread}</span></div>
                      <div className="flex justify-between"><span>Acknowledged</span><span className="font-semibold">{noticeStats.acknowledged}</span></div>
                      <div className="flex justify-between"><span>Read Rate</span><span className="font-semibold">{noticeStats.readRate}%</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Poll Participation</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Polls Received</span><span className="font-semibold">{pollStats.total}</span></div>
                      <div className="flex justify-between"><span>Voted</span><span className="font-semibold text-green-400">{pollStats.voted}</span></div>
                      <div className="flex justify-between"><span>Pending</span><span className="font-semibold text-yellow-400">{pollStats.pending}</span></div>
                      <div className="flex justify-between"><span>Participation Rate</span><span className="font-semibold">{pollStats.participationRate}%</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Engagement Mix</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={[
                        { name: "Meetings", value: meetingStats.attended },
                        { name: "Notices Read", value: noticeStats.read },
                        { name: "Polls Voted", value: pollStats.voted }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Bar dataKey="value" fill="#38bdf8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeView === "compliance" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Reliability Factors</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Declined Tasks</span><span className="font-semibold">{complianceStats.declined}</span></div>
                      <div className="flex justify-between"><span>Failed Tasks</span><span className="font-semibold text-red-400">{complianceStats.failed}</span></div>
                      <div className="flex justify-between"><span>Reopened Tasks</span><span className="font-semibold text-orange-400">{complianceStats.reopened}</span></div>
                      <div className="flex justify-between"><span>Withdrawn Tasks</span><span className="font-semibold text-yellow-400">{complianceStats.withdrawn}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Task Quality & SLA</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Verification Rate</span><span className="font-semibold">{performanceData.metrics.verificationRate ?? 0}%</span></div>
                      <div className="flex justify-between"><span>On-Time Rate</span><span className="font-semibold">{performanceData.metrics.onTimeRate ?? 0}%</span></div>
                      <div className="flex justify-between"><span>Late Submissions</span><span className="font-semibold text-red-400">{performanceData.failureBreakdown?.lateSubmissions ?? 0}</span></div>
                      <div className="flex justify-between"><span>SLA Breaches</span><span className="font-semibold text-red-400">{performanceData.failureBreakdown?.slaBreaches ?? 0}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">SLA Health</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Tasks With Due Dates</span><span className="font-semibold">{slaStats.withDue}</span></div>
                      <div className="flex justify-between"><span>Completed</span><span className="font-semibold">{slaStats.completed}</span></div>
                      <div className="flex justify-between"><span>On Time</span><span className="font-semibold text-green-400">{slaStats.onTime}</span></div>
                      <div className="flex justify-between"><span>Late</span><span className="font-semibold text-red-400">{slaStats.late}</span></div>
                      <div className="flex justify-between"><span>Overdue (Open)</span><span className="font-semibold text-red-400">{slaStats.overdueOpen}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Workload Mix</h4>
                    {workloadMixData.length === 0 ? (
                      <div className="text-sm text-gray-400">No workload data yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={workloadMixData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" stroke="#9ca3af" />
                          <YAxis stroke="#9ca3af" />
                          <Tooltip />
                          <Bar dataKey="value" fill="#a855f7" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}

              {activeView === "communication" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Modification Requests</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between"><span>Total Requests</span><span className="font-semibold">{requestStats.total}</span></div>
                      <div className="flex justify-between"><span>Responded</span><span className="font-semibold text-green-400">{requestStats.responded}</span></div>
                      <div className="flex justify-between"><span>Pending</span><span className="font-semibold text-yellow-400">{requestStats.pending}</span></div>
                      <div className="flex justify-between"><span>Expired</span><span className="font-semibold text-red-400">{requestStats.expired}</span></div>
                      <div className="flex justify-between"><span>Response Rate</span><span className="font-semibold">{requestStats.responseRate}%</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Response Discipline</h4>
                    <div className="text-sm text-gray-300 space-y-2">
                      <div>Time to accept tasks: <span className="font-semibold text-yellow-400">{performanceData.metrics.avgAcceptanceTime ?? 0}h</span></div>
                      <div>Time to complete tasks: <span className="font-semibold text-purple-400">{performanceData.metrics.avgCompletionTime ?? 0}h</span></div>
                      <div>Extensions approved: <span className="font-semibold">{performanceData.metrics.extended ?? 0}</span></div>
                      <div>No response tasks: <span className="font-semibold text-red-400">{performanceData.failureBreakdown?.noResponse ?? 0}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700 p-6 rounded-lg text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : (
            <div className="bg-gray-800 p-12 rounded-lg text-center">
              <p className="text-gray-400">No performance data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceSnapshot;





