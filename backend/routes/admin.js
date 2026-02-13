import express from "express";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Task from "../models/Task.js";
import Meeting from "../models/Meeting.js";
import Notice from "../models/Notice.js";
import { verifyJWT, requireAdmin, ADMIN_CAPABILITIES, getCapabilitiesForUser, requireCapability } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();
const REVIEW_EDIT_WINDOW_MINUTES = Number(process.env.REVIEW_EDIT_WINDOW_MINUTES || 60);

const canEditOrDeleteReview = (review) => {
  if (!review?.publishedAt) return false;
  const elapsedMs = Date.now() - new Date(review.publishedAt).getTime();
  return elapsedMs <= REVIEW_EDIT_WINDOW_MINUTES * 60 * 1000;
};

const backfillReviewHistoryFromCurrent = (employee, actorId) => {
  const current = employee?.performanceReview || {};
  const hasCurrent = Boolean(String(current.title || "").trim() || String(current.note || "").trim());
  if (!hasCurrent) return null;

  const synthesized = {
    title: current.title || "Published Review",
    note: current.note || "",
    publishedAt: current.updatedAt || new Date(),
    publishedBy: current.updatedBy || actorId || null,
    acknowledgedByEmployee: !!current.acknowledgedByEmployee,
    acknowledgedAt: current.acknowledgedAt || null,
    hiddenByEmployee: !!current.hiddenByEmployee,
    hiddenAt: current.hiddenAt || null,
    employeeComments: Array.isArray(current.employeeComments) ? current.employeeComments : []
  };

  employee.performanceReviewHistory.push(synthesized);
  return employee.performanceReviewHistory[employee.performanceReviewHistory.length - 1];
};

const TERMINAL_TASK_STATUSES = [
  "completed",
  "verified",
  "failed",
  "declined_by_employee",
  "deleted",
  "withdrawn"
];

const computeAdminLiveCounters = async (viewer = null) => {
  const now = new Date();
  const nowTs = now.getTime();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const taskScope = viewer?.role === "superadmin" ? {} : { createdBy: viewer?._id || viewer?.id };
  const meetingScope = viewer?.role === "superadmin" ? {} : { organizer: viewer?._id || viewer?.id };

  const [overdueTasks, pendingReviews, activeTasks, meetingsToday, upcomingMeetings, tasks] = await Promise.all([
    Task.countDocuments({
      ...taskScope,
      dueDate: { $lt: now },
      status: { $nin: TERMINAL_TASK_STATUSES }
    }),
    Task.countDocuments({ ...taskScope, status: "completed" }),
    Task.countDocuments({ ...taskScope, status: { $in: ["assigned", "accepted", "in_progress", "reopened"] } }),
    Meeting.countDocuments({
      ...meetingScope,
      meetingDateTime: { $gte: startOfToday, $lte: endOfToday },
      status: { $in: ["scheduled", "in_progress"] }
    }),
    Meeting.countDocuments({
      ...meetingScope,
      meetingDateTime: { $gte: now },
      status: { $in: ["scheduled", "in_progress"] }
    }),
    Task.find(taskScope)
      .select("status reopenDueAt reopenSlaStatus extensionRequests modificationRequests employeeModificationRequests")
      .lean()
  ]);

  let pendingExtensions = 0;
  let pendingModifications = 0;
  let pendingReopens = 0;
  let slaBreached = overdueTasks;

  for (const task of tasks) {
    for (const ext of task.extensionRequests || []) {
      if (ext.status === "pending") pendingExtensions += 1;
    }
    for (const mod of task.modificationRequests || []) {
      if (mod.status === "pending") {
        const isExpired = mod.expiresAt ? new Date(mod.expiresAt).getTime() <= nowTs : false;
        if (!isExpired) pendingModifications += 1;
        if (isExpired) slaBreached += 1;
      }
    }
    for (const mod of task.employeeModificationRequests || []) {
      if (mod.status === "pending") {
        const isExpired = mod.expiresAt ? new Date(mod.expiresAt).getTime() <= nowTs : false;
        if (!isExpired) pendingModifications += 1;
        if (isExpired) slaBreached += 1;
      }
    }
    if (
      task.status === "reopened" &&
      (task.reopenSlaStatus || "pending") === "pending" &&
      task.reopenDueAt &&
      new Date(task.reopenDueAt).getTime() > nowTs
    ) {
      pendingReopens += 1;
    }
  }

  return {
    overdueTasks,
    pendingReviews,
    activeTasks,
    pendingExtensions,
    pendingModifications,
    pendingReopens,
    totalPendingRequests: pendingExtensions + pendingModifications + pendingReopens,
    meetingsToday,
    upcomingMeetings,
    slaBreached,
    updatedAt: new Date().toISOString()
  };
};

const authenticateSseAdmin = async (req) => {
  const token = req.query?.token;
  if (!token || typeof token !== "string") {
    return { ok: false, status: 401, error: "Missing token" };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_err) {
    return { ok: false, status: 401, error: "Invalid token" };
  }

  const user = await User.findById(decoded.id).select("_id role adminCapabilities").lean();
  if (!user || !["admin", "superadmin"].includes(user.role)) {
    return { ok: false, status: 403, error: "Admin access required" };
  }

  const capabilities = getCapabilitiesForUser(user);
  if (!capabilities.includes("view_analytics")) {
    return { ok: false, status: 403, error: "Missing capability: view_analytics" };
  }

  return { ok: true, user };
};

/* =====================================================
   GET ADMIN CAPABILITIES (RBAC)
===================================================== */
router.get("/capabilities", verifyJWT, requireAdmin, async (req, res) => {
  try {
    return res.json({
      success: true,
      role: req.user.role,
      capabilities: req.user.capabilities || getCapabilitiesForUser(req.user),
      availableCapabilities: ADMIN_CAPABILITIES
    });
  } catch (err) {
    console.error("Get capabilities error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   CLAIM LEGACY DATA FOR CURRENT ADMIN (ONE-TIME MIGRATION HELP)
===================================================== */
router.post("/claim-legacy-data", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (String(process.env.ENABLE_LEGACY_CLAIM || "false").toLowerCase() !== "true") {
      return res.status(403).json({ success: false, error: "Legacy claim is disabled" });
    }

    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Admin only" });
    }

    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Superadmin only" });
    }

    const legacyEmployeeFilter = {
      role: "employee",
      $or: [{ createdBy: { $exists: false } }, { createdBy: null }]
    };

    const legacyEmployees = await User.find(legacyEmployeeFilter).select("_id");
    const employeeIds = legacyEmployees.map((e) => e._id);

    let employeesClaimed = 0;
    let tasksClaimed = 0;
    let meetingsClaimed = 0;
    let noticesClaimed = 0;

    if (employeeIds.length > 0) {
      const employeeUpdate = await User.updateMany(
        { _id: { $in: employeeIds } },
        {
          $set: {
            createdBy: req.user.id,
            lastModifiedBy: req.user.id,
            lastModifiedAt: new Date()
          }
        }
      );
      employeesClaimed = employeeUpdate.modifiedCount || 0;

      const taskUpdate = await Task.updateMany(
        {
          assignedTo: { $in: employeeIds },
          $or: [{ createdBy: { $exists: false } }, { createdBy: null }]
        },
        { $set: { createdBy: req.user.id } }
      );
      tasksClaimed = taskUpdate.modifiedCount || 0;

      // Keep meeting/notice ownership untouched in auto-claim to avoid cross-domain takeover.
      meetingsClaimed = 0;
      noticesClaimed = 0;
    }

    return res.json({
      success: true,
      message: "Legacy data claim completed",
      claimed: {
        employees: employeesClaimed,
        tasks: tasksClaimed,
        meetings: meetingsClaimed,
        notices: noticesClaimed
      }
    });
  } catch (err) {
    console.error("Claim legacy data error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   LIVE ADMIN COUNTERS (SSE + SNAPSHOT)
===================================================== */
router.get("/live-counters", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    const counters = await computeAdminLiveCounters(req.user);
    return res.json({ success: true, counters });
  } catch (err) {
    console.error("Live counters error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.get("/live-counters/stream", async (req, res) => {
  const auth = await authenticateSseAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  const send = async () => {
    if (closed) return;
    try {
      const counters = await computeAdminLiveCounters(auth.user);
      res.write(`event: counters\n`);
      res.write(`data: ${JSON.stringify(counters)}\n\n`);
    } catch (err) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: "Failed to compute counters" })}\n\n`);
      console.error("SSE live-counters tick error:", err);
    }
  };

  const heartbeat = setInterval(() => {
    if (closed) return;
    res.write(`event: ping\ndata: {"ts":"${new Date().toISOString()}"}\n\n`);
  }, 15000);

  const interval = setInterval(send, 10000);
  send();

  req.on("close", () => {
    closed = true;
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

router.get("/audit-log", verifyJWT, requireCapability("view_audit_log"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Admin only" });
    }

    const {
      search = "",
      source = "all",
      severity = "all",
      workflow = "all",
      employeeId = "all",
      taskId = "all",
      dateFrom,
      dateTo,
      limit = 500
    } = req.query;

    const maxLimit = Math.min(Number(limit) || 500, 2000);
    const scopeQuery = req.user.role === "superadmin"
      ? {}
      : { createdBy: req.user.id };

    const [tasks, meetings, notices] = await Promise.all([
      Task.find(scopeQuery)
        .select("title createdAt updatedAt assignedTo activityTimeline")
        .populate("assignedTo", "name email")
        .lean(),
      Meeting.find(req.user.role === "superadmin" ? {} : { organizer: req.user.id })
        .select("title description status isExpired meetingDateTime createdAt updatedAt attendees organizer")
        .populate("organizer", "name email")
        .populate("attendees.employee", "name email")
        .lean(),
      Notice.find(req.user.role === "superadmin" ? {} : { createdBy: req.user.id })
        .select("title content createdAt updatedAt sendAt createdBy senderName severity")
        .populate("createdBy", "name email")
        .lean()
    ]);

    const classifyWorkflow = (evtSource, actionText) => {
      const text = String(actionText || "").toLowerCase();
      if (evtSource === "meeting") return "meeting";
      if (evtSource === "notice") return "notice";
      if (text.includes("modification")) return "modification";
      if (text.includes("extension")) return "extension";
      if (text.includes("reopen")) return "reopen";
      return "task";
    };

    const inferSeverity = (actionText = "") => {
      const text = String(actionText).toLowerCase();
      if (text.includes("failed") || text.includes("declined") || text.includes("expired")) return "high";
      if (text.includes("reopen") || text.includes("overdue") || text.includes("warning")) return "medium";
      return "low";
    };

    const events = [];

    tasks.forEach((task) => {
      const assigneeId = task?.assignedTo?._id ? String(task.assignedTo._id) : "";
      const assigneeName = task?.assignedTo?.name || task?.assignedTo?.email || "";
      (task.activityTimeline || []).forEach((evt) => {
        const action = String(evt.action || "UPDATED");
        events.push({
          id: `task-${task._id}-${evt._id || evt.timestamp || Math.random()}`,
          source: "task",
          workflow: classifyWorkflow("task", action),
          severity: inferSeverity(action),
          action,
          entity: task.title || "Task",
          actor: evt.actorName || evt.by || evt.role || "system",
          details: evt.details || evt.note || "",
          timestamp: evt.timestamp || evt.createdAt || task.updatedAt || task.createdAt,
          taskId: String(task._id),
          employeeId: assigneeId,
          employeeName: assigneeName,
          participantIds: []
        });
      });
    });

    meetings.forEach((meeting) => {
      const participantIds = (meeting.attendees || [])
        .map((att) => att?.employee?._id || att?.employee)
        .filter(Boolean)
        .map((id) => String(id));
      const action = `MEETING_${String(meeting.status || "scheduled").toUpperCase()}`;
      events.push({
        id: `meeting-${meeting._id}`,
        source: "meeting",
        workflow: "meeting",
        severity: meeting.isExpired ? "medium" : "low",
        action,
        entity: meeting.title || "Meeting",
        actor: meeting.organizer?.name || "admin",
        details: meeting.description || "",
        timestamp: meeting.updatedAt || meeting.meetingDateTime || meeting.createdAt,
        taskId: "",
        employeeId: "",
        employeeName: "",
        participantIds
      });
    });

    notices.forEach((notice) => {
      events.push({
        id: `notice-${notice._id}`,
        source: "notice",
        workflow: "notice",
        severity: notice.severity === "error" || notice.severity === "alert" ? "high" : "low",
        action: "NOTICE_PUBLISHED",
        entity: notice.title || "Notice",
        actor: notice.createdBy?.name || notice.senderName || "admin",
        details: notice.content || "",
        timestamp: notice.sendAt || notice.updatedAt || notice.createdAt,
        taskId: "",
        employeeId: "",
        employeeName: "",
        participantIds: []
      });
    });

    const hasDateFrom = Boolean(dateFrom);
    const hasDateTo = Boolean(dateTo);
    const fromTs = hasDateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = hasDateTo ? new Date(dateTo).getTime() : null;
    const q = String(search || "").trim().toLowerCase();

    let filtered = events.filter((evt) => {
      if (!evt.timestamp) return false;
      const ts = new Date(evt.timestamp).getTime();
      if (Number.isNaN(ts)) return false;
      if (hasDateFrom && ts < fromTs) return false;
      if (hasDateTo && ts > toTs) return false;
      if (source !== "all" && evt.source !== source) return false;
      if (severity !== "all" && evt.severity !== severity) return false;
      if (workflow !== "all" && evt.workflow !== workflow) return false;
      if (employeeId !== "all") {
        const isMatchTaskEmp = evt.employeeId && evt.employeeId === String(employeeId);
        const isMatchMeetingEmp = Array.isArray(evt.participantIds) && evt.participantIds.includes(String(employeeId));
        if (!isMatchTaskEmp && !isMatchMeetingEmp) return false;
      }
      if (taskId !== "all" && evt.taskId !== String(taskId)) return false;
      if (q) {
        const hay = `${evt.entity} ${evt.action} ${evt.actor} ${evt.details}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxLimit);

    return res.json({
      success: true,
      events: filtered,
      meta: {
        total: filtered.length,
        filters: {
          source,
          severity,
          workflow,
          employeeId,
          taskId,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          search: q
        }
      }
    });
  } catch (err) {
    console.error("Get audit log error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   UPDATE ADMIN CAPABILITIES (SUPERADMIN ONLY)
===================================================== */
router.patch("/admins/:id/capabilities", verifyJWT, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Superadmin only" });
    }

    const { capabilities } = req.body;
    if (!Array.isArray(capabilities)) {
      return res.status(400).json({ success: false, error: "capabilities must be an array" });
    }

    const sanitized = capabilities.filter((cap) => ADMIN_CAPABILITIES.includes(cap));
    const adminUser = await User.findById(req.params.id);
    if (!adminUser || !["admin", "superadmin"].includes(adminUser.role)) {
      return res.status(404).json({ success: false, error: "Admin user not found" });
    }

    if (adminUser.role === "superadmin") {
      return res.status(400).json({ success: false, error: "Superadmin capabilities are implicit and cannot be reduced" });
    }

    adminUser.adminCapabilities = sanitized;
    adminUser.lastModifiedBy = req.user.id;
    adminUser.lastModifiedAt = new Date();
    await adminUser.save();

    return res.json({
      success: true,
      message: "Admin capabilities updated",
      admin: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        adminCapabilities: adminUser.adminCapabilities
      }
    });
  } catch (err) {
    console.error("Update admin capabilities error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET ALL EMPLOYEES (With Pagination & Caching)
===================================================== */
router.get("/employees", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    // âœ… Add pagination support
    const { page = 1, limit = 50, status, search } = req.query;
    
    const query = { role: "employee" };
    if (req.user.role !== "superadmin") {
      // Strict admin isolation: only employees created by this admin.
      query.createdBy = req.user.id;
    }
    
    // âœ… Add filters
    if (status && status !== "all") {
      query.status = status;
    }
    
    if (search) {
      query.$and = [
        { $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ] }
      ];
    }

    // âœ… Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // âœ… Execute query with pagination
    const employees = await User.find(query)
      .select("_id name email role status createdAt department position performanceReview performanceReviewHistory")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(); // âœ… Use lean() for better performance

    // Get total count for pagination
    const total = await User.countDocuments(query);

    return res.json({
      success: true,
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Get employees error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   GET EMPLOYEE BY ID
===================================================== */
router.get("/employees/:id", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const employee = await User.findById(req.params.id)
      .select("-password")
      .lean();

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    // Get employee's task statistics
    const taskFilter = { assignedTo: req.params.id };
    if (req.user.role !== "superadmin") {
      taskFilter.createdBy = req.user.id;
    }
    const tasks = await Task.find(taskFilter);
    
    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === "verified").length,
      inProgress: tasks.filter(t => ["accepted", "in_progress"].includes(t.status)).length,
      pending: tasks.filter(t => t.status === "pending").length,
      failed: tasks.filter(t => t.status === "failed").length
    };

    return res.json({
      success: true,
      employee,
      stats
    });
  } catch (err) {
    console.error("Get employee error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   EMPLOYEE INSIGHTS (EMPLOYEE + TASKS)
   GET /api/admin/employee-insights/:employeeId
===================================================== */
router.get("/employee-insights/:employeeId", verifyJWT, requireCapability("view_employee_insights"), async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID required" });
    }

    const employee = await User.findById(employeeId)
      .select("_id name email role status createdAt createdBy")
      .lean();

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    const insightTaskFilter = { assignedTo: employeeId };
    if (req.user.role !== "superadmin") {
      insightTaskFilter.createdBy = req.user.id;
    }

    const tasks = await Task.find(insightTaskFilter)
      .select([
        "title",
        "status",
        "priority",
        "category",
        "description",
        "createdAt",
        "updatedAt",
        "dueDate",
        "completedAt",
        "activityTimeline",
        "discussion",
        "modificationRequests",
        "employeeModificationRequests",
        "extensionRequests",
        "reopenReason",
        "reopenDueAt",
        "reopenSlaStatus",
        "reopenAcceptedAt",
        "reopenViewedAt",
        "declineReason",
        "declineType",
        "isArchived",
        "createdBy",
        "assignedTo",
      ].join(" "))
      .populate("createdBy", "_id name email role")
      .populate("assignedTo", "_id name email role")
      .populate("modificationRequests.requestedBy", "_id name email role")
      .populate("modificationRequests.reviewedBy", "_id name email role")
      .populate("modificationRequests.discussion.sender", "_id name email role")
      .populate("employeeModificationRequests.requestedBy", "_id name email role")
      .populate("employeeModificationRequests.reviewedBy", "_id name email role")
      .populate("employeeModificationRequests.discussion.sender", "_id name email role")
      .populate("extensionRequests.requestedBy", "_id name email role")
      .populate("extensionRequests.reviewedBy", "_id name email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      employee,
      tasks
    });
  } catch (err) {
    console.error("Employee insights error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   CREATE EMPLOYEE
===================================================== */
router.post("/employees", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { name, email, password, department, position } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: "Name, email, and password are required" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "employee",
      status: "active",
      department,
      position,
      createdBy: req.user.id
    });

    const employeeData = employee.toObject();
    delete employeeData.password;

    return res.status(201).json({
      success: true,
      message: "Employee created successfully",
      employee: employeeData
    });
  } catch (err) {
    console.error("Create employee error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   UPDATE EMPLOYEE
===================================================== */
router.put("/employees/:id", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const {
      name,
      email,
      department,
      position,
      status,
      performanceReviewTitle,
      performanceReviewNote
    } = req.body;

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    if (employee.role !== "employee") {
      return res.status(400).json({ error: "Can only update employees" });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== employee.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    // Update fields
    if (name) employee.name = name;
    if (email) employee.email = email;
    if (department) employee.department = department;
    if (position) employee.position = position;
    if (status) employee.status = status;

    if (performanceReviewTitle !== undefined || performanceReviewNote !== undefined) {
      const existing = employee.performanceReview || {};
      const title = performanceReviewTitle ?? existing.title ?? "";
      const note = performanceReviewNote ?? existing.note ?? "";
      const now = new Date();

      employee.performanceReview = {
        title,
        note,
        updatedAt: now,
        updatedBy: req.user.id,
        acknowledgedByEmployee: false,
        acknowledgedAt: null,
        hiddenByEmployee: false,
        hiddenAt: null,
        employeeComments: []
      };

      employee.performanceReviewHistory.push({
        title,
        note,
        publishedAt: now,
        publishedBy: req.user.id,
        acknowledgedByEmployee: false,
        acknowledgedAt: null,
        hiddenByEmployee: false,
        hiddenAt: null,
        employeeComments: []
      });
    }

    await employee.save();

    try {
      await Notification.createNotification({
        user: employee._id,
        type: "general",
        title: "Performance review published",
        message: `A performance review was published by ${req.user.name || "Admin"}.`,
        priority: "medium",
        data: { extra: { kind: "performance_review", employeeId: employee._id } },
        metadata: { source: "performance_review" }
      });
    } catch (notifyErr) {
      console.error("Performance review notification error:", notifyErr);
    }

    const employeeData = employee.toObject();
    delete employeeData.password;

    return res.json({
      success: true,
      message: "Employee updated successfully",
      employee: employeeData
    });
  } catch (err) {
    console.error("Update employee error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   UPDATE A PUBLISHED PERFORMANCE REVIEW (time-limited)
===================================================== */
router.patch("/employees/:id/performance-reviews/:reviewId", verifyJWT, requireCapability("manage_reviews"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { title, note } = req.body;
    if (title === undefined && note === undefined) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const employee = await User.findById(req.params.id);
    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    const review = employee.performanceReviewHistory.id(req.params.reviewId);
    if (!review || review.isDeleted) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (!canEditOrDeleteReview(review)) {
      return res.status(400).json({
        error: `Edit window expired. Reviews can only be edited within ${REVIEW_EDIT_WINDOW_MINUTES} minute(s).`
      });
    }

    if (title !== undefined) review.title = String(title);
    if (note !== undefined) review.note = String(note);
    review.editedAt = new Date();
    review.editedBy = req.user.id;

    employee.performanceReview = {
      title: review.title,
      note: review.note,
      updatedAt: review.editedAt,
      updatedBy: req.user.id
    };

    await employee.save();

    try {
      await Notification.createNotification({
        user: employee._id,
        type: "general",
        title: "Performance review updated",
        message: `Your performance review was updated by ${req.user.name || "Admin"}.`,
        priority: "medium",
        data: { extra: { kind: "performance_review_updated", employeeId: employee._id, reviewId: req.params.reviewId } },
        metadata: { source: "performance_review" }
      });
    } catch (notifyErr) {
      console.error("Performance review update notification error:", notifyErr);
    }

    const employeeData = employee.toObject();
    delete employeeData.password;
    return res.json({ success: true, message: "Review updated", employee: employeeData, review });
  } catch (err) {
    console.error("Update performance review entry error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ADMIN REPLY TO PERFORMANCE REVIEW THREAD
===================================================== */
router.post("/employees/:id/performance-reviews/:reviewId/comment", verifyJWT, requireCapability("manage_reviews"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const employee = await User.findById(req.params.id);
    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    let review = employee.performanceReviewHistory.id(req.params.reviewId);
    if ((!review || review.isDeleted) && String(req.params.reviewId || "").startsWith("legacy-")) {
      review = backfillReviewHistoryFromCurrent(employee, req.user.id);
    }
    if (!review || review.isDeleted) {
      return res.status(404).json({ error: "Review not found" });
    }

    const comment = {
      text,
      commentedAt: new Date(),
      commentedBy: req.user.id,
      commentedByRole: req.user.role,
      commentedByName: req.user.name || req.user.email || "Admin"
    };

    if (!Array.isArray(review.employeeComments)) {
      review.employeeComments = [];
    }
    review.employeeComments.push(comment);

    const latestActive = [...(employee.performanceReviewHistory || [])]
      .filter((r) => !r.isDeleted)
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0];

    if (latestActive && latestActive._id?.toString() === review._id?.toString()) {
      if (!Array.isArray(employee.performanceReview.employeeComments)) {
        employee.performanceReview.employeeComments = [];
      }
      employee.performanceReview.employeeComments.push(comment);
    }

    await employee.save();

    try {
      await Notification.createNotification({
        user: employee._id,
        type: "general",
        title: "Manager replied to your review thread",
        message: `${req.user.name || "Admin"} replied on your performance review discussion.`,
        priority: "medium",
        data: {
          extra: {
            kind: "manager_review_reply",
            employeeId: employee._id,
            reviewId: review._id
          }
        },
        metadata: { source: "performance_review_comment" }
      });
    } catch (notifyErr) {
      console.error("Manager review reply notification error:", notifyErr);
    }

    const employeeData = employee.toObject();
    delete employeeData.password;
    return res.json({ success: true, message: "Reply posted", employee: employeeData, review });
  } catch (err) {
    console.error("Admin review comment error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ADMIN REPLY TO LATEST ACTIVE PERFORMANCE REVIEW THREAD
===================================================== */
router.post("/employees/:id/performance-review/comment", verifyJWT, requireCapability("manage_reviews"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const employee = await User.findById(req.params.id);
    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    let review = [...(employee.performanceReviewHistory || [])]
      .filter((r) => !r.isDeleted)
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0];
    if (!review) {
      review = backfillReviewHistoryFromCurrent(employee, req.user.id);
    }
    if (!review) {
      return res.status(404).json({ error: "No published review history found" });
    }

    const comment = {
      text,
      commentedAt: new Date(),
      commentedBy: req.user.id,
      commentedByRole: req.user.role,
      commentedByName: req.user.name || req.user.email || "Admin"
    };

    if (!Array.isArray(review.employeeComments)) {
      review.employeeComments = [];
    }
    review.employeeComments.push(comment);

    if (!Array.isArray(employee.performanceReview?.employeeComments)) {
      employee.performanceReview = {
        ...(employee.performanceReview || {}),
        employeeComments: []
      };
    }
    employee.performanceReview.employeeComments.push(comment);

    await employee.save();

    try {
      await Notification.createNotification({
        user: employee._id,
        type: "general",
        title: "Manager replied to your review thread",
        message: `${req.user.name || "Admin"} replied on your performance review discussion.`,
        priority: "medium",
        data: {
          extra: {
            kind: "manager_review_reply",
            employeeId: employee._id,
            reviewId: review._id
          }
        },
        metadata: { source: "performance_review_comment" }
      });
    } catch (notifyErr) {
      console.error("Manager review latest reply notification error:", notifyErr);
    }

    const employeeData = employee.toObject();
    delete employeeData.password;
    return res.json({ success: true, message: "Reply posted", employee: employeeData, review });
  } catch (err) {
    console.error("Admin latest review comment error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   DELETE A PUBLISHED PERFORMANCE REVIEW (time-limited)
===================================================== */
router.delete("/employees/:id/performance-reviews/:reviewId", verifyJWT, requireCapability("manage_reviews"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const employee = await User.findById(req.params.id);
    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    const review = employee.performanceReviewHistory.id(req.params.reviewId);
    if (!review || review.isDeleted) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (!canEditOrDeleteReview(review)) {
      return res.status(400).json({
        error: `Delete window expired. Reviews can only be deleted within ${REVIEW_EDIT_WINDOW_MINUTES} minute(s).`
      });
    }

    review.isDeleted = true;
    review.deletedAt = new Date();
    review.deletedBy = req.user.id;

    const latestActive = [...employee.performanceReviewHistory]
      .filter((r) => !r.isDeleted)
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0];

    if (latestActive) {
      employee.performanceReview = {
        title: latestActive.title || "",
        note: latestActive.note || "",
        updatedAt: latestActive.editedAt || latestActive.publishedAt || new Date(),
        updatedBy: latestActive.editedBy || latestActive.publishedBy || null,
        acknowledgedByEmployee: !!latestActive.acknowledgedByEmployee,
        acknowledgedAt: latestActive.acknowledgedAt || null,
        hiddenByEmployee: !!latestActive.hiddenByEmployee,
        hiddenAt: latestActive.hiddenAt || null,
        employeeComments: Array.isArray(latestActive.employeeComments) ? latestActive.employeeComments : []
      };
    } else {
      employee.performanceReview = {
        title: "",
        note: "",
        updatedAt: null,
        updatedBy: null,
        acknowledgedByEmployee: false,
        acknowledgedAt: null,
        hiddenByEmployee: false,
        hiddenAt: null,
        employeeComments: []
      };
    }

    await employee.save();

    try {
      await Notification.createNotification({
        user: employee._id,
        type: "general",
        title: "Performance review record removed",
        message: `A performance review record was removed by ${req.user.name || "Admin"}.`,
        priority: "low",
        data: { extra: { kind: "performance_review_deleted", employeeId: employee._id, reviewId: req.params.reviewId } },
        metadata: { source: "performance_review" }
      });
    } catch (notifyErr) {
      console.error("Performance review delete notification error:", notifyErr);
    }

    const employeeData = employee.toObject();
    delete employeeData.password;
    return res.json({ success: true, message: "Review deleted", employee: employeeData });
  } catch (err) {
    console.error("Delete performance review entry error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   DELETE/DEACTIVATE EMPLOYEE
===================================================== */
router.delete("/employees/:id", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    if (employee.role !== "employee") {
      return res.status(400).json({ error: "Can only delete employees" });
    }

    // Soft delete - just set status to inactive
    employee.status = "inactive";
    await employee.save();

    return res.json({
      success: true,
      message: "Employee deactivated successfully"
    });
  } catch (err) {
    console.error("Delete employee error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   RESET EMPLOYEE PASSWORD
===================================================== */
router.post("/employees/:id/reset-password", verifyJWT, requireCapability("manage_employees"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    employee.password = hashedPassword;
    await employee.save();

    return res.json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

/* =====================================================
   GET ADMIN DASHBOARD STATS
===================================================== */
router.get("/stats/overview", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const employeeScope = req.user.role === "superadmin"
      ? { role: "employee" }
      : { role: "employee", createdBy: req.user.id };
    const taskScope = req.user.role === "superadmin"
      ? {}
      : { createdBy: req.user.id };

    // Get counts in parallel
    const [
      totalEmployees,
      activeEmployees,
      totalTasks,
      activeTasks,
      completedTasks,
      pendingTasks
    ] = await Promise.all([
      User.countDocuments(employeeScope),
      User.countDocuments({ ...employeeScope, status: "active" }),
      Task.countDocuments(taskScope),
      Task.countDocuments({ ...taskScope, status: { $in: ["assigned", "accepted", "in_progress", "reopened"] } }),
      Task.countDocuments({ ...taskScope, status: "completed" }),
      Task.countDocuments({ ...taskScope, status: "pending" })
    ]);

    return res.json({
      success: true,
      stats: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: totalEmployees - activeEmployees
        },
        tasks: {
          total: totalTasks,
          active: activeTasks,
          completed: completedTasks,
          pending: pendingTasks
        }
      }
    });
  } catch (err) {
    console.error("Get stats error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Server error" 
    });
  }
});

export default router;




