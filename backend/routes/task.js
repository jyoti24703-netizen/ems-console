console.log("🔥🔥🔥 TASK ROUTES FILE LOADED - ENTERPRISE EDITION:", new Date().toISOString());

import express from "express";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Notice from "../models/Notice.js";
import Notification from "../models/Notification.js";
import { Meeting } from "../models/Meeting.js";
import { verifyJWT, requireCapability } from "../middleware/auth.js";
import { blockIfTaskClosed } from "../middleware/taskReadOnly.js";
import { successPayload, errorPayload, STATUS_ENUMS } from "../utils/apiResponse.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔄 ROUTES/TASK.JS LOADED - COMPLETE ENTERPRISE VERSION:", new Date().toISOString());

const REOPEN_SLA_DAYS = Number(process.env.REOPEN_SLA_DAYS || 3);

const taskSubmissionUploadDir = path.join(__dirname, "../../uploads/tasks/work-submissions");
if (!fs.existsSync(taskSubmissionUploadDir)) {
  fs.mkdirSync(taskSubmissionUploadDir, { recursive: true });
}

const taskSubmissionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, taskSubmissionUploadDir),
  filename: (_req, file, cb) => {
    const safeName = String(file.originalname || "work-file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  },
});

const allowedTaskSubmissionMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const taskSubmissionUpload = multer({
  storage: taskSubmissionStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (allowedTaskSubmissionMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
  },
});

const taskSubmissionUploadMiddleware = (req, res, next) => {
  taskSubmissionUpload.array("workFiles", 5)(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Max 25MB per file."
        : err.message;
      res.status(400).json({ success: false, error: msg });
      return;
    }
    res.status(400).json({ success: false, error: err.message || "File upload failed" });
  });
};

/* =====================================================
   ADMIN → CREATE TASK (ENTERPRISE GRADE)
===================================================== */
router.post("/create", verifyJWT, requireCapability("manage_tasks"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { title, description, category, dueDate, assignedTo, priority, tags, attachments, department } = req.body;

    if (!title || !assignedTo) {
      return res.status(400).json({
        error: "Title and assigned employee are required",
      });
    }

    if (dueDate) {
      const dueTs = new Date(dueDate).getTime();
      if (Number.isNaN(dueTs)) {
        return res.status(400).json({ error: "Invalid due date format" });
      }
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (dueTs < todayStart.getTime()) {
        return res.status(400).json({ error: "Due date cannot be in the past" });
      }
    }

    const employeeFilter = {
      $or: [{ email: assignedTo }, { name: assignedTo }],
      role: "employee",
    };
    if (req.user.role !== "superadmin") {
      employeeFilter.createdBy = req.user.id;
    }
    const employee = await User.findOne(employeeFilter);

    if (!employee) {
      return res.status(404).json({
        error: "Assigned employee not found",
      });
    }

    const task = await Task.create({
      title,
      description,
      category,
      dueDate,
      priority: priority || "medium",
      tags: tags || [],
      attachments: attachments || [],
      department: department || "general",
      assignedTo: employee._id,
      createdBy: req.user.id,
      status: "assigned",
      activityTimeline: [
        {
          action: "TASK_CREATED",
          performedBy: req.user.id,
          role: "admin",
          actorName: req.user.name || req.user.email,
          targetName: employee.name,
          details: "Task created and assigned",
          timestamp: new Date()
        },
      ],
    });

    return res.status(201).json({ 
      success: true, 
      task,
      message: "Task created successfully with enterprise tracking"
    });
  } catch (err) {
    console.error("Create task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ADMIN → VIEW ALL TASKS (WITH ADVANCED FILTERING)
===================================================== */
router.get("/", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { status, priority, department, dateFrom, dateTo, search } = req.query;
    
    let filter = {};
    if (req.user.role !== "superadmin") {
      filter.createdBy = req.user.id;
    }
    
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (department && department !== 'all') filter.department = department;
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email department position")
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .populate("reopenedBy", "name email")
      .populate("archivedBy", "name email")
      .populate("activityTimeline.performedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      ...successPayload({
        req,
        data: { tasks },
        meta: {
          count: tasks.length,
          filters: { status, priority, department, search },
          statusEnum: STATUS_ENUMS.task
        }
      }),
      tasks,
      filters: { status, priority, department, search },
      count: tasks.length
    });
  } catch (err) {
    console.error("Fetch admin tasks error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE → VIEW OWN TASKS (WITH INTELLIGENT SORTING)
===================================================== */
router.get("/my", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { filter = 'all' } = req.query;
    
    let statusFilter = {};
    if (filter === 'active') {
      statusFilter.status = { $in: ['assigned', 'accepted', 'in_progress', 'reopened'] };
    } else if (filter === 'pending') {
      statusFilter.status = { $in: ['assigned', 'accepted'] };
    } else if (filter === 'completed') {
      statusFilter.status = { $in: ['completed', 'verified'] };
    } else if (filter === 'overdue') {
      statusFilter.dueDate = { $lt: new Date() };
      statusFilter.status = { $in: ['assigned', 'accepted', 'in_progress', 'reopened'] };
    }

    const tasks = await Task.find({ 
      assignedTo: req.user.id,
      ...statusFilter
    })
      .populate("createdBy", "name")
      .populate("reviewedBy", "name")
      .populate("reopenedBy", "name")
      .sort({ 
        priority: -1,
        dueDate: 1,
        createdAt: -1 
      });

    return res.status(200).json({
      ...successPayload({
        req,
        data: { tasks },
        meta: {
          count: tasks.length,
          filter,
          statusEnum: STATUS_ENUMS.task
        }
      }),
      tasks,
      filter,
      count: tasks.length
    });
  } catch (err) {
    console.error("Employee fetch tasks error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ ADMIN: DIRECT EDIT (Only when allowed) - ENTERPRISE GUARD
===================================================== */
router.put("/:id/direct-edit", verifyJWT, requireCapability("manage_tasks"), blockIfTaskClosed, async (req, res) => {
  try {
    console.log("🎯 ENTERPRISE DIRECT-EDIT ROUTE HIT!", req.params.id);
    
    if (req.user.role !== "admin") {
      console.log("❌ NOT ADMIN");
      return res.status(403).json({ error: "Admin only" });
    }

    const task = await Task.findById(req.params.id);
    console.log("🔍 TASK FOUND:", {
      id: task?._id,
      status: task?.status,
      title: task?.title,
      assignedTo: task?.assignedTo
    });
    
    if (!task) {
      console.log("❌ TASK NOT FOUND");
      return res.status(404).json({ error: "Task not found" });
    }

    const canEditDirectly = task.canAdminEditDirectly();
    console.log("🔍 CAN EDIT DIRECTLY?", canEditDirectly, "Status:", task.status);
    
    if (!canEditDirectly) {
      console.log("❌ CANNOT EDIT DIRECTLY - Status:", task.status);
      return res.status(403).json({
        error: "Direct edit not allowed. Use modification request.",
        requiresModificationRequest: true,
        currentStatus: task.status,
        hasWorkSubmission: task.hasWorkSubmission?.()
      });
    }

    const { title, description, category, dueDate, priority, editNote, tags, department } = req.body;
    console.log("📝 ENTERPRISE EDIT DATA:", { title, editNote, department });

    const changes = {};

    if (title && title !== task.title) {
      changes.title = { old: task.title, new: title };
      task.title = title;
    }
    
    if (description && description !== task.description) {
      changes.description = { old: task.description, new: description };
      task.description = description;
    }
    
    if (category && category !== task.category) {
      changes.category = { old: task.category, new: category };
      task.category = category;
    }
    
    if (dueDate && new Date(dueDate).toISOString() !== task.dueDate?.toISOString()) {
      changes.dueDate = { old: task.dueDate, new: dueDate };
      task.dueDate = new Date(dueDate);
    }
    
    if (priority && priority !== task.priority) {
      changes.priority = { old: task.priority, new: priority };
      task.priority = priority;
    }
    
    if (tags && JSON.stringify(tags) !== JSON.stringify(task.tags)) {
      changes.tags = { old: task.tags, new: tags };
      task.tags = tags;
    }
    
    if (department && department !== task.department) {
      changes.department = { old: task.department, new: department };
      task.department = department;
    }

    if (Object.keys(changes).length === 0) {
      console.log("❌ NO CHANGES PROVIDED");
      return res.status(400).json({ error: "No changes provided" });
    }

    task.editHistory.push({
      editedBy: req.user.id,
      changes,
      editedAt: new Date(),
      note: editNote || "Direct edit (task not accepted yet)",
      editType: "direct_admin_edit"
    });

    task.activityTimeline.push({
      action: "TASK_EDITED",
      performedBy: req.user.id,
      role: "admin",
      details: `Direct edit (task not accepted): ${Object.keys(changes).join(", ")}. Note: ${editNote || 'No note provided'}`,
      timestamp: new Date()
    });

    await task.save();
    console.log("✅ ENTERPRISE DIRECT EDIT SUCCESSFUL - Changes:", Object.keys(changes));

    const updatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email department")
      .populate("createdBy", "name email");

    res.json({
      success: true,
      message: "Task updated directly (not accepted yet)",
      task: updatedTask,
      changes,
      editNote,
      editHistory: task.editHistory
    });
  } catch (err) {
    console.error("Direct edit error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ ADMIN: DIRECT DELETE (ENTERPRISE GUARD)
===================================================== */
router.delete("/:id/direct-delete", verifyJWT, requireCapability("manage_tasks"), blockIfTaskClosed, async (req, res) => {
  try {
    console.log("✅ ENTERPRISE DIRECT-DELETE ROUTE HIT! Task ID:", req.params.id);
    
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { deleteReason, impactAssessment } = req.body;
    
    if (!deleteReason || deleteReason.trim().length < 5) {
      return res.status(400).json({
        error: "Delete reason required (minimum 5 characters)"
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const canDeleteDirectly = task.canAdminDeleteDirectly();
    console.log("🔍 CAN DELETE DIRECTLY?", canDeleteDirectly, "Status:", task.status);
    
    if (!canDeleteDirectly) {
      return res.status(403).json({
        error: "Direct delete not allowed. Use modification request.",
        requiresModificationRequest: true,
        currentStatus: task.status,
        hasWorkSubmission: task.hasWorkSubmission?.()
      });
    }

    task.status = "deleted";
    task.closedAt = new Date();
    task.deletionReason = deleteReason.trim();
    task.deletionImpact = impactAssessment || "No impact assessment provided";
    
    task.activityTimeline.push({
      action: "TASK_DELETED",
      performedBy: req.user.id,
      role: "admin",
      details: `Direct delete: ${deleteReason}. Impact: ${task.deletionImpact}`,
      timestamp: new Date()
    });

    await task.save();
    console.log("✅ ENTERPRISE DIRECT DELETE SUCCESSFUL");

    res.json({
      success: true,
      message: "Task marked as deleted (enterprise soft delete)",
      deletedAt: new Date(),
      deletionReason: task.deletionReason,
      requiresAuditLog: true
    });
  } catch (err) {
    console.error("Direct delete error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET TASK BY ID - STANDARD ENDPOINT (/:id)
===================================================== */
router.get("/:id", verifyJWT, async (req, res) => {
  try {
    console.log("✅ GET /:id ROUTE HIT for task:", req.params.id);
    let task;
    try {
      task = await Task.findById(req.params.id)
        .populate("assignedTo", "name email department position")
        .populate("createdBy", "name email")
        .populate("reviewedBy", "name email")
        .populate("reopenedBy", "name email")
        .populate("archivedBy", "name email")
        .populate("activityTimeline.performedBy", "name email")
        .populate("editHistory.editedBy", "name email")
        .populate("discussion.sender", "name email role")
        .populate("modificationRequests.requestedBy", "name email role")
        .populate("modificationRequests.response.respondedBy", "name email role")
        .populate("modificationRequests.discussion.sender", "name email role")
        .populate("employeeModificationRequests.requestedBy", "name email role")
        .populate("employeeModificationRequests.response.respondedBy", "name email role")
        .populate("employeeModificationRequests.discussion.sender", "name email role");
    } catch (populateErr) {
      console.error("Populate error in GET /:id, returning raw task:", populateErr);
      task = await Task.findById(req.params.id);
    }

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const taskObj = task.toObject();
    taskObj.canAdminEditDirectly = task.canAdminEditDirectly();
    taskObj.canAdminDeleteDirectly = task.canAdminDeleteDirectly();
    taskObj.canEmployeeEdit = task.canEmployeeEdit?.() || false;
    taskObj.canEmployeeDelete = task.canEmployeeDelete?.() || false;
    taskObj.isOverdue = typeof task.isOverdue === "boolean" ? task.isOverdue : false;
    if (task.dueDate) {
      const diffMs = new Date(task.dueDate).getTime() - Date.now();
      taskObj.timeToDeadline = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } else {
      taskObj.timeToDeadline = null;
    }

    res.json({ 
      success: true, 
      task: taskObj,
      permissions: {
        canEdit: taskObj.canAdminEditDirectly,
        canDelete: taskObj.canAdminDeleteDirectly,
        canComment: true,
        canUploadFiles: true,
        canRequestExtension: task.canRequestExtension?.()
      }
    });
  } catch (err) {
    console.error("Get task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 SAFE TASK BY ID ROUTE (REPLACED GREEDY /:id ROUTE)
===================================================== */
router.get("/by-id/:id", verifyJWT, async (req, res) => {
  try {
    console.log("✅ SAFE /by-id/:id ROUTE HIT");
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email department")
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .populate("reopenedBy", "name email")
      .populate("archivedBy", "name email")
      .populate("activityTimeline.performedBy", "name email")
      .populate("modificationRequests.requestedBy", "name email role")
      .populate("modificationRequests.response.respondedBy", "name email role")
      .populate("modificationRequests.discussion.sender", "name email role")
      .populate("employeeModificationRequests.requestedBy", "name email role")
      .populate("employeeModificationRequests.response.respondedBy", "name email role")
      .populate("employeeModificationRequests.discussion.sender", "name email role");

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const taskObj = task.toObject();
    taskObj.canAdminEditDirectly = task.canAdminEditDirectly();
    taskObj.canAdminDeleteDirectly = task.canAdminDeleteDirectly();

    res.json({ 
      success: true, 
      task: taskObj
    });
  } catch (err) {
    console.error("Get task by ID error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE → ACCEPT TASK (WITH ENTERPRISE TIMESTAMP)
===================================================== */
router.patch("/:id/accept", verifyJWT, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (task.status !== "assigned") {
      return res.status(400).json({ error: "Task not in assignable state" });
    }

    const body = req.body || {};
    task.status = "accepted";
    task.acceptedAt = new Date();
    task.acceptanceNote = body.acceptanceNote || "Task accepted";
    
    task.activityTimeline.push({
      action: "TASK_ACCEPTED",
      performedBy: req.user.id,
      role: "employee",
      details: `Task accepted. Note: ${task.acceptanceNote}`,
      timestamp: new Date()
    });

    await task.save();
    return res.json({ 
      success: true,
      message: "Task accepted successfully",
      acceptedAt: task.acceptedAt
    });
  } catch (err) {
    console.error("Accept task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE → START WORK (IN PROGRESS) WITH ENTERPRISE TRACKING
===================================================== */
router.patch("/:id/start", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (task.status !== "accepted") {
      return res.status(400).json({
        error: "Only accepted tasks can be started",
      });
    }

    const body = req.body || {};
    task.status = "in_progress";
    task.startedAt = new Date();
    task.progressNote = body.progressNote || "Work started";

    task.activityTimeline.push({
      action: "TASK_STARTED",
      performedBy: req.user.id,
      role: "employee",
      details: `Work started. Progress note: ${task.progressNote}`,
      timestamp: new Date()
    });

    await task.save();
    return res.json({ 
      success: true,
      message: "Work started successfully",
      startedAt: task.startedAt
    });
  } catch (err) {
    console.error("Start work error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ ENHANCED: EMPLOYEE → DECLINE ASSIGNMENT (ENTERPRISE)
===================================================== */
router.patch("/:id/decline", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { reason, suggestedAlternative, availabilityDate } = req.body;
    if (!reason || reason.length < 5) {
      return res.status(400).json({
        error: "Decline reason must be at least 5 characters",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (task.status !== "assigned") {
      return res.status(400).json({
        error: "Only assigned tasks can be declined",
      });
    }

    task.status = "declined_by_employee";
    task.declineType = "assignment_decline";
    task.declineReason = reason;
    task.suggestedAlternative = suggestedAlternative;
    task.availabilityDate = availabilityDate;

    task.activityTimeline.push({
      action: "TASK_DECLINED",
      performedBy: req.user.id,
      role: "employee",
      details: `Assignment declined: ${reason}. Alternative: ${suggestedAlternative || 'None'}`,
      timestamp: new Date()
    });

    await task.save();
    try {
      if (task.createdBy) {
        await Notification.createNotification({
          user: task.createdBy,
          type: "general",
          title: "Task assignment declined",
          message: `${req.user.name || req.user.email || "Employee"} declined task "${task.title}".`,
          priority: "high",
          data: {
            extra: {
              kind: "task_declined",
              taskId: task._id,
              employeeId: req.user.id,
              reason
            }
          },
          metadata: { source: "task_decline" }
        });
      }
    } catch (notifyErr) {
      console.error("Task decline notification error:", notifyErr);
    }
    return res.json({ 
      success: true,
      message: "Assignment declined successfully",
      requiresAdminReview: true,
      suggestedAlternative,
      availabilityDate
    });
  } catch (err) {
    console.error("Decline task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ EMPLOYEE → WITHDRAW FROM TASK (ENTERPRISE WITH CONFIRMATION)
===================================================== */
router.patch("/:id/withdraw", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { reason, confirmed, transferTo, handoverNotes } = req.body;
    
    if (!confirmed) {
      return res.status(400).json({
        error: "Confirmation required. Please confirm you want to withdraw.",
        requiresConfirmation: true
      });
    }
    
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: "Withdrawal reason required (min 10 characters)",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (!["accepted", "in_progress"].includes(task.status)) {
      return res.status(400).json({
        error: "Cannot withdraw from task in current state",
      });
    }

    task.status = "withdrawn";
    task.closedAt = new Date();
    task.declineType = "withdrawal";
    task.declineReason = reason;
    task.handoverNotes = handoverNotes;
    task.suggestedReplacement = transferTo;
    
    task.activityTimeline.push({
      action: "TASK_WITHDRAWN",
      performedBy: req.user.id,
      role: "employee",
      details: `Task withdrawn: ${reason}. Handover: ${handoverNotes || 'No handover notes'}`,
      timestamp: new Date()
    });

    await task.save();
    try {
      if (task.createdBy) {
        await Notification.createNotification({
          user: task.createdBy,
          type: "general",
          title: "Reopened task declined",
          message: `${req.user.name || req.user.email || "Employee"} declined reopened task "${task.title}".`,
          priority: "high",
          data: {
            extra: {
              kind: "reopen_declined",
              taskId: task._id,
              employeeId: req.user.id,
              reason: reason.trim()
            }
          },
          metadata: { source: "task_reopen_decline" }
        });
      }
    } catch (notifyErr) {
      console.error("Reopen decline notification error:", notifyErr);
    }
    
    return res.json({ 
      success: true,
      message: "Task withdrawn successfully",
      requiresAdminReview: true,
      handoverNotes,
      suggestedReplacement: transferTo
    });
  } catch (err) {
    console.error("Withdraw task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE → SUBMIT WORK (COMPLETE TASK) - ENTERPRISE VERSION
===================================================== */
router.patch("/:id/complete", verifyJWT, taskSubmissionUploadMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { workLink, files, employeeNote, completionSummary, challengesFaced } = req.body || {};
    const normalizedWorkLink = typeof workLink === "string" ? workLink.trim() : "";
    const uploadedFiles = (req.files || []).map((file) => ({
      name: file.originalname || file.filename,
      size: file.size || 0,
      mimeType: file.mimetype || "application/octet-stream",
      url: `/uploads/tasks/work-submissions/${file.filename}`,
    }));

    let incomingFiles = [];
    if (uploadedFiles.length > 0) {
      incomingFiles = uploadedFiles;
    } else if (Array.isArray(files)) {
      incomingFiles = files;
    } else if (typeof files === "string" && files.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(files);
        if (Array.isArray(parsed)) incomingFiles = parsed;
      } catch (_err) {
        incomingFiles = [];
      }
    }

    if (!normalizedWorkLink && incomingFiles.length === 0) {
      return res.status(400).json({
        error: "Work link or files required",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (!Array.isArray(task.activityTimeline)) {
      task.activityTimeline = [];
    }

    const allowedStatuses = ["accepted", "in_progress"];
    if (task.status === "reopened") {
      const lastAction = task.activityTimeline[task.activityTimeline.length - 1]?.action;
      if (lastAction === "TASK_REOPEN_ACCEPTED") {
        allowedStatuses.push("reopened");
      }
    }
    
    if (!allowedStatuses.includes(task.status)) {
      return res.status(400).json({
        error: "Task must be accepted, in-progress, or accepted after reopen to submit work",
      });
    }

    task.status = "completed";
    task.completedAt = new Date();
    task.completionSummary = completionSummary || "";
    task.challengesFaced = challengesFaced || "";

    const currentVersion = task.workSubmission?.version || 1;
    task.workSubmission = {
      link: normalizedWorkLink,
      files: incomingFiles,
      employeeNote: employeeNote || "",
      version: currentVersion + 1,
      submittedAt: new Date(),
      submissionStatus: "submitted",
      completionSummary: completionSummary,
      challengesFaced: challengesFaced
    };

    task.activityTimeline.push({
      action: "TASK_COMPLETED",
      performedBy: req.user.id,
      role: "employee",
      details: `Submitted (v${currentVersion + 1}) with note: ${employeeNote?.substring(0, 50) || 'No note'}${employeeNote?.length > 50 ? '...' : ''}`,
      timestamp: new Date()
    });

    await task.save();
    return res.json({ 
      success: true,
      message: "Work submitted successfully",
      version: currentVersion + 1,
      submittedAt: new Date()
    });
  } catch (err) {
    console.error("Complete task error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

/* =====================================================
   EMPLOYEE LIVE COUNTERS (Dashboard parity)
===================================================== */
router.get("/employee/live-counters", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const tasks = await Task.find({ assignedTo: req.user.id }).select(
      "_id status dueDate modificationRequests extensionRequests reopenSlaStatus"
    );

    const activeTasks = tasks.filter((t) => ["accepted", "in_progress"].includes(t.status)).length;
    const assignedTasks = tasks.filter((t) => t.status === "assigned").length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const activeLike = ["assigned", "accepted", "in_progress", "reopened", "completed"].includes(t.status);
      return activeLike && new Date(t.dueDate) < now;
    }).length;
    const pendingReopens = tasks.filter(
      (t) => t.status === "reopened" && (t.reopenSlaStatus || "pending") === "pending"
    ).length;
    const expiredModifications = tasks.reduce((acc, t) => {
      const expiredAdminReqs = (t.modificationRequests || []).filter((r) => {
        if (r.status !== "pending") return false;
        if (!r.expiresAt) return false;
        return new Date(r.expiresAt) <= now;
      }).length;
      return acc + expiredAdminReqs;
    }, 0);
    const pendingModifications = tasks.reduce((acc, t) => {
      const pendingAdminReqs = (t.modificationRequests || []).filter((r) => {
        if (r.status !== "pending") return false;
        if (!r.expiresAt) return true;
        return new Date(r.expiresAt) > now;
      }).length;
      return acc + pendingAdminReqs;
    }, 0);
    const pendingExtensions = tasks.reduce((acc, t) => {
      const pendingMine = (t.extensionRequests || []).filter(
        (r) => r.status === "pending" && r.requestedBy?.toString() === req.user.id
      ).length;
      return acc + pendingMine;
    }, 0);

    const meetingScope = {
      $or: [
        { organizer: req.user.id },
        { coOrganizers: req.user.id },
        { "attendees.employee": req.user.id }
      ]
    };

    const todayMeetings = await Meeting.countDocuments({
      ...meetingScope,
      status: { $in: ["scheduled", "in_progress"] },
      meetingDateTime: { $gte: dayStart, $lt: dayEnd }
    });

    const nextMeeting = await Meeting.findOne({
      ...meetingScope,
      status: { $in: ["scheduled", "in_progress"] },
      meetingDateTime: { $gte: now }
    })
      .sort({ meetingDateTime: 1 })
      .select("meetingDateTime");

    const unreadNotices = await Notice.countDocuments({
      "recipients.user": req.user.id,
      "recipients.read": false,
      status: { $in: ["sent", "scheduled"] },
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } }
      ]
    });

    const data = {
      activeTasks,
      assignedTasks,
      overdueTasks,
      completedTasks,
      pendingModifications,
      expiredModifications,
      pendingExtensions,
      pendingReopens,
      totalPendingRequests: pendingModifications + pendingExtensions + pendingReopens,
      todayMeetings,
      unreadNotices,
      nextMeetingAt: nextMeeting?.meetingDateTime || null,
      updatedAt: now.toISOString()
    };

    return res.json({
      ...successPayload({
        req,
        data,
        meta: {
          statusEnum: {
            task: STATUS_ENUMS.task,
            request: STATUS_ENUMS.request,
            meeting: STATUS_ENUMS.meeting,
            notice: STATUS_ENUMS.notice
          }
        }
      }),
      // legacy flat shape
      ...data
    });
  } catch (err) {
    console.error("Employee live counters error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "EMPLOYEE_LIVE_COUNTERS_FAILED"
      })
    );
  }
});

/* =====================================================
   ADMIN -> REVIEW QUEUE (JIRA-LIKE SERVER FILTERING)
===================================================== */
router.get("/queue/review", verifyJWT, requireCapability("manage_reviews"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const {
      lane = "all",
      search = "",
      sort = "recent",
      scope = "pending",
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const scopeStatuses = scope === "all"
      ? ["completed", "verified", "failed", "reopened"]
      : ["completed", "reopened"];

    const match = {
      status: { $in: scopeStatuses },
      isArchived: { $ne: true }
    };
    if (req.user.role !== "superadmin") {
      match.createdBy = req.user.id;
    }

    const normalizedSearch = String(search || "").trim().toLowerCase();
    if (normalizedSearch) {
      match.$or = [
        { title: { $regex: normalizedSearch, $options: "i" } },
        { description: { $regex: normalizedSearch, $options: "i" } }
      ];
    }

    let tasks = await Task.find(match)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ completedAt: -1, updatedAt: -1 });

    const now = Date.now();
    const withComputed = tasks.map((t) => {
      const due = t.dueDate ? new Date(t.dueDate).getTime() : null;
      const isOverdue = Boolean(due && due < now && ["completed", "reopened", "in_progress", "accepted", "assigned"].includes(t.status));
      const taskObj = t.toObject();
      taskObj.isOverdue = isOverdue;
      taskObj.reviewLane =
        t.status === "completed" ? "needs_review" :
        t.status === "reopened" ? "reopened" :
        isOverdue ? "at_risk" :
        ["verified", "failed"].includes(t.status) ? "closed" : "all";
      return taskObj;
    });

    const laneFiltered = withComputed.filter((taskObj) => {
      const matchesSearch = !normalizedSearch || [
        taskObj.title,
        taskObj.description,
        taskObj.assignedTo?.name,
        taskObj.assignedTo?.email
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
      if (!matchesSearch) return false;
      if (lane === "all") return true;
      return taskObj.reviewLane === lane;
    });

    laneFiltered.sort((a, b) => {
      const ta = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
      if (sort === "oldest") return ta - tb;
      if (sort === "sla") {
        const aRisk = a.isOverdue ? 1 : 0;
        const bRisk = b.isOverdue ? 1 : 0;
        if (bRisk !== aRisk) return bRisk - aRisk;
      }
      return tb - ta;
    });

    const total = laneFiltered.length;
    const start = (pageNum - 1) * pageSize;
    const items = laneFiltered.slice(start, start + pageSize);

    const summary = {
      total,
      needsReview: withComputed.filter((t) => t.reviewLane === "needs_review").length,
      atRisk: withComputed.filter((t) => t.isOverdue).length,
      reopened: withComputed.filter((t) => t.reviewLane === "reopened").length,
      closed: withComputed.filter((t) => t.reviewLane === "closed").length
    };

    return res.json({
      ...successPayload({
        req,
        data: { items },
        meta: {
          summary,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
          },
          filters: { lane, scope, sort, search },
          statusEnum: STATUS_ENUMS.task
        }
      }),
      items,
      summary,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (err) {
    console.error("Review queue error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "REVIEW_QUEUE_FAILED"
      })
    );
  }
});

/* =====================================================
   ✅ ENHANCED: ADMIN → VERIFY TASK - ENTERPRISE VERIFICATION
===================================================== */
router.patch("/:id/verify", verifyJWT, requireCapability("manage_reviews"), blockIfTaskClosed, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (!task.canAdminVerify()) {
      return res.status(400).json({ 
        error: "Task cannot be verified in current state",
        allowedStatuses: ["completed", "reopened"]
      });
    }

      const { note, qualityScore, feedback, nextSteps } = req.body || {};
    if (!note || note.trim().length < 5) {
      return res.status(400).json({ 
        error: "Verification note required (minimum 5 characters)" 
      });
    }

    if (task.status === "completed" && !task.hasWorkSubmission()) {
      return res.status(400).json({ 
        error: "Cannot verify: Employee has not submitted work yet" 
      });
    }

    const isReopenVerification = task.status === "reopened";
    const hasNewSubmissionAfterReopen = task.hasNewSubmissionAfterReopen?.() || false;
    
    task.status = "verified";
    task.closedAt = new Date();
    task.reviewedAt = new Date();
    task.reviewedBy = req.user.id;
    task.adminNote = note.trim();
    task.qualityScore = qualityScore || 0;
    task.feedback = feedback || "";
    task.nextSteps = nextSteps || "";
    
    if (task.workSubmission) {
      task.workSubmission.submissionStatus = "verified";
      task.workSubmission.reviewedAt = new Date();
      task.workSubmission.reviewer = req.user.id;
    }
    task.reopenSlaStatus = "responded";
    task.reopenDueAt = null;

    let timelineDetails = `Verified with note: ${note}`;
    if (isReopenVerification) {
      if (hasNewSubmissionAfterReopen) {
        timelineDetails = `Verified rework (v${task.workSubmission?.version || 1}): ${note}`;
      } else {
        timelineDetails = `Verified original work after reopen: ${note}`;
      }
    }

    task.activityTimeline.push({
      action: "TASK_VERIFIED",
      performedBy: req.user.id,
      role: "admin",
      details: timelineDetails,
      timestamp: new Date()
    });

    await task.save();
    
    return res.json({
      ...successPayload({
        req,
        message: "Task verified successfully",
        data: {
          resolution: task.resolution,
          isReopenVerification,
          hasNewSubmissionAfterReopen,
          qualityScore: task.qualityScore,
          reviewedAt: task.reviewedAt
        },
        meta: { statusEnum: STATUS_ENUMS.task }
      }),
      // Legacy fields preserved for existing UI consumers
      message: "Task verified successfully",
      resolution: task.resolution,
      isReopenVerification,
      hasNewSubmissionAfterReopen,
      qualityScore: task.qualityScore,
      reviewedAt: task.reviewedAt
    });
  } catch (err) {
    console.error("Verify task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ ENHANCED: ADMIN → FAIL TASK - ENTERPRISE FAILURE ANALYSIS
===================================================== */
router.patch("/:id/fail", verifyJWT, requireCapability("manage_reviews"), blockIfTaskClosed, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { reason, failureType, rootCause, correctiveActions, preventionPlan } = req.body;
    
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ 
        error: "Failure reason required (minimum 5 characters)" 
      });
    }

    if (!failureType || !["quality_not_met", "overdue_timeout", "incomplete_work", "technical_issues", "communication_breakdown", "resource_constraints", "other"].includes(failureType)) {
      return res.status(400).json({ 
        error: "Valid failure type required" 
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (!task.canAdminFail()) {
      return res.status(400).json({
        error: "Task cannot be failed in current state",
        allowedStatuses: ["completed", "reopened", "in_progress (overdue only)"]
      });
    }

    if (task.status === "completed" && !task.hasWorkSubmission()) {
      return res.status(400).json({ 
        error: "Cannot fail completed task without work submission" 
      });
    }

    if (task.status === "in_progress") {
      const isOverdue = task.dueDate && new Date() > new Date(task.dueDate);
      if (!isOverdue) {
        return res.status(400).json({
          error: "Only overdue in-progress tasks can be failed",
        });
      }
    }

    task.status = "failed";
    task.closedAt = new Date();
    task.failureReason = reason.trim();
    task.failureType = failureType;
    task.rootCause = rootCause || "";
    task.correctiveActions = correctiveActions || "";
    task.preventionPlan = preventionPlan || "";
    
    if (task.workSubmission) {
      task.workSubmission.submissionStatus = "failed";
    }

    const failureLabels = {
      'quality_not_met': 'Work quality did not meet expectations',
      'overdue_timeout': 'Task overdue without submission',
      'incomplete_work': 'Work submitted but incomplete',
      'technical_issues': 'Technical issues prevented completion',
      'communication_breakdown': 'Communication breakdown',
      'resource_constraints': 'Resource constraints',
      'other': 'Failed'
    };

    let timelineDetails = `Failed (${failureLabels[failureType]}): ${reason}`;
    
    if (task.status === "reopened") {
      const hasReopenDeclined = task.activityTimeline?.some(a => a.action === "TASK_REOPEN_DECLINED");
      const hasResubmission = task.hasNewSubmissionAfterReopen?.();
      
      if (hasReopenDeclined) {
        timelineDetails = `Failed after reopen decline: ${reason}`;
      } else if (hasResubmission) {
        timelineDetails = `Failed rework (v${task.workSubmission?.version || 1}): ${reason}`;
      } else {
        timelineDetails = `Failed without rework after reopen: ${reason}`;
      }
    } else if (task.status === "in_progress") {
      timelineDetails = `Failed overdue task: ${reason}`;
    }

    task.activityTimeline.push({
      action: "TASK_FAILED",
      performedBy: req.user.id,
      role: "admin",
      details: timelineDetails,
      timestamp: new Date()
    });

    await task.save();
    
    return res.json({
      ...successPayload({
        req,
        message: "Task marked as failed with root cause analysis",
        data: {
          resolution: task.resolution,
          failureType,
          rootCause: task.rootCause,
          requiresProcessReview: true
        },
        meta: { statusEnum: STATUS_ENUMS.task }
      }),
      // Legacy fields preserved for existing UI consumers
      message: "Task marked as failed with root cause analysis",
      resolution: task.resolution,
      failureType,
      rootCause: task.rootCause,
      requiresProcessReview: true
    });
  } catch (err) {
    console.error("Fail task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ ADMIN → REOPEN VERIFIED TASK - ENTERPRISE REOPEN
===================================================== */
router.patch("/:id/reopen", verifyJWT, requireCapability("manage_reviews"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { reason, changesRequired, expectedCompletion, additionalResources } = req.body || {};
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        error: "Reopen reason must be at least 5 characters",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.isArchived) {
      return res.status(403).json({ error: "Archived tasks cannot be reopened" });
    }

    if (!task.canAdminReopen()) {
      return res.status(400).json({
        error: "Only verified tasks can be reopened",
      });
    }

    task.status = "reopened";
    task.closedAt = null;
    task.reopenReason = reason.trim();
    task.reopenedBy = req.user.id;
    task.changesRequired = changesRequired || "";
    task.expectedCompletion = expectedCompletion || null;
    task.additionalResources = additionalResources || "";
    task.reopenDueAt = new Date(Date.now() + REOPEN_SLA_DAYS * 24 * 60 * 60 * 1000);
    task.reopenSlaStatus = "pending";
    task.reopenSlaBreachedAt = null;
    task.reopenViewedAt = null;
    task.reopenViewedBy = null;

    task.activityTimeline.push({
      action: "TASK_REOPENED",
      performedBy: req.user.id,
      role: "admin",
      details: `Reopened: ${reason}. Changes required: ${changesRequired || 'Not specified'}. SLA: ${REOPEN_SLA_DAYS} day(s)`,
      timestamp: new Date()
    });

    await task.save();
    
    const taskData = {
      id: task._id,
      status: task.status,
      reopenReason: task.reopenReason,
      reopenedBy: task.reopenedBy,
      changesRequired: task.changesRequired,
      expectedCompletion: task.expectedCompletion
    };

    return res.json({
      ...successPayload({
        req,
        message: "Task reopened. Employee must accept or decline.",
        data: { task: taskData },
        meta: { statusEnum: STATUS_ENUMS.task }
      }),
      // Legacy fields preserved for existing UI consumers
      message: "Task reopened. Employee must accept or decline.",
      task: taskData
    });
  } catch (err) {
    console.error("Reopen task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE → ACCEPT REOPENED TASK
===================================================== */
/* =====================================================
   EMPLOYEE → MARK REOPEN REQUEST VIEWED
===================================================== */
router.patch("/:id/reopen/viewed", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (task.status !== "reopened") {
      return res.status(400).json({ error: "Task is not reopened" });
    }

    if (!task.reopenViewedAt) {
      task.reopenViewedAt = new Date();
      task.reopenViewedBy = req.user.id;

      task.activityTimeline.push({
        action: "REOPEN_VIEWED",
        performedBy: req.user.id,
        role: "employee",
        details: "Reopen request viewed",
        timestamp: new Date()
      });

      await task.save();
    }

    return res.json({ success: true, reopenViewedAt: task.reopenViewedAt });
  } catch (err) {
    console.error("Mark reopen viewed error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.patch("/:id/accept-reopen", verifyJWT, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (task.status !== "reopened") {
      return res.status(400).json({ 
        error: "Only reopened tasks can be accepted" 
      });
    }

    const now = new Date();
    if (task.reopenSlaStatus === "timed_out" || (task.reopenDueAt && new Date(task.reopenDueAt) < now)) {
      if (task.reopenSlaStatus !== "timed_out") {
        task.reopenSlaStatus = "timed_out";
        task.reopenSlaBreachedAt = now;
        task.reopenDueAt = null;
        if (task.status === "reopened") {
          task.status = "verified";
        }
        task.activityTimeline.push({
          action: "TASK_REOPEN_TIMEOUT",
          role: "system",
          details: "Reopen response exceeded SLA. Original work remains verified.",
          timestamp: now
        });
        await task.save();
      }
      return res.status(403).json({ error: "Reopen SLA expired" });
    }

    task.status = "accepted";
    task.reopenAcceptedAt = new Date();
    task.reopenAcceptanceNote = req.body.acceptanceNote || "Reopened task accepted";
    task.reopenSlaStatus = "responded";
    task.reopenDueAt = null;
    
    task.activityTimeline.push({
      action: "TASK_REOPEN_ACCEPTED",
      performedBy: req.user.id,
      role: "employee",
      details: `Accepted reopened task. Note: ${task.reopenAcceptanceNote}. Admin's reason: ${task.reopenReason}`,
      timestamp: new Date()
    });

    await task.save();
    return res.json({ 
      success: true,
      message: "Reopened task accepted",
      acceptanceNote: task.reopenAcceptanceNote
    });
  } catch (err) {
    console.error("Accept reopened task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE → DECLINE REOPENED TASK (ENTERPRISE DECLINE)
===================================================== */
router.patch("/:id/decline-reopen", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { reason, suggestedAlternative, capacityIssues } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        error: "Decline reason must be at least 5 characters",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (task.status !== "reopened") {
      return res.status(400).json({
        error: "Only reopened tasks can be declined",
      });
    }

    const now = new Date();
    if (task.reopenSlaStatus === "timed_out" || (task.reopenDueAt && new Date(task.reopenDueAt) < now)) {
      if (task.reopenSlaStatus !== "timed_out") {
        task.reopenSlaStatus = "timed_out";
        task.reopenSlaBreachedAt = now;
        task.reopenDueAt = null;
        if (task.status === "reopened") {
          task.status = "verified";
        }
        task.activityTimeline.push({
          action: "TASK_REOPEN_TIMEOUT",
          role: "system",
          details: "Reopen response exceeded SLA. Original work remains verified.",
          timestamp: now
        });
        await task.save();
      }
      return res.status(403).json({ error: "Reopen SLA expired" });
    }

    task.status = "declined_by_employee";
    task.declineType = "reopen_decline";
    task.declineReason = reason.trim();
    task.reopenSlaStatus = "responded";
    task.reopenDueAt = null;
    task.suggestedAlternative = suggestedAlternative;
    task.capacityIssues = capacityIssues;
    
    task.activityTimeline.push({
      action: "TASK_REOPEN_DECLINED",
      performedBy: req.user.id,
      role: "employee",
      details: `Declined reopened task. Admin's reason: ${task.reopenReason}. Employee's reason: ${reason}`,
      timestamp: new Date()
    });

    await task.save();
    
    return res.json({ 
      success: true,
      message: "Reopened task declined",
      resolution: task.resolution,
      requiresAdminReview: true,
      suggestedAlternative,
      capacityIssues
    });
  } catch (err) {
    console.error("Decline reopened task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ FIXED: ADMIN → ACCEPT REOPEN DECLINE (ENTERPRISE VERIFICATION)
===================================================== */
router.patch("/:id/accept-reopen-decline", verifyJWT, requireCapability("manage_reviews"), blockIfTaskClosed, async (req, res) => {
  try {
    console.log("🎯 ENTERPRISE ACCEPT REOPEN DECLINE ROUTE HIT!");
    console.log("📦 Request body:", req.body);
    
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { note, verificationMethod, qualityChecklist } = req.body;
    
    if (!note || note.trim().length < 5) {
      return res.status(400).json({
        error: "Acceptance note required (minimum 5 characters)",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    console.log("🔍 Task Details:");
    console.log("  - ID:", task._id);
    console.log("  - Title:", task.title);
    console.log("  - Status:", task.status);
    console.log("  - Decline Type:", task.declineType);
    console.log("  - Decline Reason:", task.declineReason);
    
    console.log("🔍 Activity Timeline:", task.activityTimeline?.length || 0, "events");
    
    if (task.activityTimeline && task.activityTimeline.length > 0) {
      task.activityTimeline.forEach((event, index) => {
        console.log(`  [${index}] ${event.action} - ${event.details || 'No details'}`);
      });
    }

    const hasReopenDeclined = task.activityTimeline?.some(event => 
      event.action === "TASK_REOPEN_DECLINED"
    );
    
    const hasReopen = task.activityTimeline?.some(event => 
      event.action === "TASK_REOPENED"
    );
    
    console.log("🔍 Checks:");
    console.log("  - Has reopen declined:", hasReopenDeclined);
    console.log("  - Has reopen:", hasReopen);
    console.log("  - Status is declined_by_employee:", task.status === "declined_by_employee");
    console.log("  - Decline type:", task.declineType);

    if (task.status !== "declined_by_employee") {
      return res.status(400).json({
        error: `Task is in "${task.status}" status, not declined`,
        requiredStatus: "declined_by_employee",
        currentStatus: task.status
      });
    }

    const isReopenDecline = hasReopenDeclined || 
                           task.declineType === "reopen_decline" || 
                           (hasReopen && task.status === "declined_by_employee");
    
    if (!isReopenDecline) {
      return res.status(400).json({
        error: "This decline is not related to a reopen request",
        declineType: task.declineType,
        hasReopenDeclined: hasReopenDeclined,
        hasReopen: hasReopen
      });
    }

    task.status = "verified";
    task.closedAt = new Date();
    task.reviewedAt = new Date();
    task.reviewedBy = req.user.id;
    task.adminNote = note.trim();
    task.verificationMethod = verificationMethod || "manual_review";
    task.qualityChecklist = qualityChecklist || [];
    
    if (task.workSubmission) {
      task.workSubmission.submissionStatus = "verified";
      task.workSubmission.reviewedAt = new Date();
      task.workSubmission.reviewer = req.user.id;
    }

    task.activityTimeline.push({
      action: "TASK_VERIFIED",
      performedBy: req.user.id,
      role: "admin",
      details: `Accepted reopen decline and verified original work: ${note}. Employee reason: ${task.declineReason || "Not specified"}`,
      timestamp: new Date()
    });

    await task.save();
    
    console.log("✅ Enterprise reopen decline accepted successfully!");
    
    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email department")
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email");

    const taskData = {
      id: task._id,
      title: task.title,
      status: task.status,
      adminNote: task.adminNote,
      reviewedAt: task.reviewedAt,
      verificationMethod: task.verificationMethod
    };

    return res.json({
      ...successPayload({
        req,
        message: "Reopen decline accepted. Original work verified with quality checklist.",
        data: { task: taskData },
        meta: { statusEnum: STATUS_ENUMS.task }
      }),
      // Legacy fields preserved for existing UI consumers
      message: "Reopen decline accepted. Original work verified with quality checklist.",
      task: taskData
    });
  } catch (err) {
    console.error("Accept reopen decline error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "ACCEPT_REOPEN_DECLINE_FAILED",
        details: err.message
      })
    );
  }
});

/* =====================================================
   ✅ ADMIN: REQUEST TASK MODIFICATION (ENTERPRISE)
===================================================== */
router.post("/:id/request-modification", verifyJWT, requireCapability("manage_requests"), async (req, res) => {
  try {
    console.log("🎯 ENTERPRISE REQUEST-MODIFICATION ENDPOINT HIT!");
    console.log("Task ID:", req.params.id);
    console.log("User role:", req.user?.role);
    console.log("Request body:", req.body);
    
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { requestType, reason, proposedChanges, impactNote, urgency, deadlineExtension, slaHours, slaDays } = req.body;
    
    if (!["edit", "delete"].includes(requestType)) {
      return res.status(400).json({ error: "Invalid request type" });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: "Reason required (minimum 10 characters)"
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (requestType === "edit" && task.canAdminEditDirectly()) {
      return res.status(400).json({
        error: "Can edit directly (task not accepted yet)",
        canEditDirectly: true
      });
    }

    if (requestType === "delete" && task.canAdminDeleteDirectly()) {
      return res.status(400).json({
        error: "Can delete directly (no work submitted)",
        canDeleteDirectly: true
      });
    }

    if (task.hasPendingModificationRequest()) {
      return res.status(400).json({
        error: "Pending modification request already exists",
        hasPendingRequest: true
      });
    }

    const requestData = {
      reason: reason.trim(),
      urgency: urgency || "normal",
      deadlineExtension: deadlineExtension || null,
      slaHours: slaHours || null,
      slaDays: slaDays || null,
      ...(requestType === "edit" && { 
        title: proposedChanges?.title,
        description: proposedChanges?.description,
        dueDate: proposedChanges?.dueDate,
        category: proposedChanges?.category,
        priority: proposedChanges?.priority,
        department: proposedChanges?.department,
        tags: proposedChanges?.tags
      }),
      ...(requestType === "delete" && { 
        impactNote,
        businessImpact: req.body.businessImpact,
        dataRetention: req.body.dataRetention
      })
    };

    const request = await task.createModificationRequest(
      requestType,
      req.user.id,
      requestData
    );

    const populatedTask = await Task.findById(task._id)
      .populate("modificationRequests.requestedBy", "name email")
      .populate("assignedTo", "name email department");

    const taskData = {
      id: task._id,
      title: task.title,
      assignedTo: task.assignedTo,
      urgency: urgency || "normal"
    };

    res.status(201).json({
      ...successPayload({
        req,
        message: "Modification request submitted to employee",
        data: {
          request,
          task: taskData
        },
        meta: { statusEnum: STATUS_ENUMS.request }
      }),
      // Legacy fields preserved for existing UI consumers
      message: "Modification request submitted to employee",
      request,
      task: taskData
    });
  } catch (err) {
    console.error("❌ Request modification error:", err);
    console.error("Error stack:", err.stack);
    console.error("Error message:", err.message);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =====================================================
   🆕 EMPLOYEE: REQUEST MODIFICATION (Employee-initiated) - ENTERPRISE
===================================================== */
router.post("/:id/employee-request-modification", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { requestType, reason, proposedChanges, supportingDocs, businessCase } = req.body;

    if (!["edit", "delete", "extension", "reassign", "scope_change"].includes(requestType)) {
      return res.status(400).json({ error: "Invalid request type" });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: "Reason required (minimum 10 characters)"
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only assigned employee can request modification" });
    }

    if (!task.employeeModificationRequests) {
      task.employeeModificationRequests = [];
    }

    const now = new Date();
    let markedExpired = false;
    const hasPending = task.employeeModificationRequests.some((existingReq) => {
      const expTs = existingReq.expiresAt ? new Date(existingReq.expiresAt).getTime() : null;
      const isExpiredPending = existingReq.status === "pending" && expTs != null && expTs <= now.getTime();
      if (isExpiredPending) {
        existingReq.status = "expired";
        existingReq.expiredAt = now;
        markedExpired = true;
        return false;
      }
      return existingReq.status === "pending";
    });
    if (hasPending) {
      return res.status(400).json({
        error: "Pending modification request already exists",
        hasPendingRequest: true
      });
    }
    if (markedExpired) {
      task.activityTimeline.push({
        action: "EMPLOYEE_MODIFICATION_EXPIRED",
        performedBy: req.user.id,
        role: "system",
        details: "Previous pending employee modification request was auto-marked as expired.",
        timestamp: now
      });
    }

    const requestData = {
      requestType,
      requestedBy: req.user.id,
      reason: reason.trim(),
      businessCase: businessCase || "",
      supportingDocs: supportingDocs || [],
      requestedAt: new Date(),
      createdAt: new Date(),
      status: "pending",
      urgency: req.body.urgency || "normal",
      discussion: [],
      ...(requestType === "edit" && proposedChanges && {
        proposedChanges
      }),
      ...(requestType === "extension" && {
        requestedExtension: req.body.requestedExtension,
        extensionReason: req.body.extensionReason
      }),
      ...(requestType === "reassign" && {
        suggestedReassign: req.body.suggestedReassign,
        reassignReason: req.body.reassignReason
      }),
      ...(requestType === "scope_change" && {
        scopeChanges: req.body.scopeChanges,
        impactAssessment: req.body.impactAssessment
      })
    };

    task.employeeModificationRequests.push(requestData);

    task.activityTimeline.push({
      action: "EMPLOYEE_MODIFICATION_REQUESTED",
      performedBy: req.user.id,
      role: "employee",
      details: `Employee requested ${requestType} modification. Urgency: ${requestData.urgency}. Reason: ${reason.trim()}`,
      timestamp: new Date()
    });

    await task.save();

    res.status(201).json({
      success: true,
      message: "Modification request submitted to admin",
      request: task.employeeModificationRequests[task.employeeModificationRequests.length - 1],
      requiresAdminApproval: true
    });
  } catch (err) {
    console.error("❌ Employee request modification error:", err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =====================================================
   🆕 GET PENDING MODIFICATION REQUESTS - ENTERPRISE
===================================================== */
router.get("/modification-requests/pending", verifyJWT, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const statusFilter = String(req.query.status || "all").toLowerCase();
    const originFilter = String(req.query.origin || "all").toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();
    const sort = String(req.query.sort || "urgency").toLowerCase();

    let query = {};
    const userRole = req.user.role;
    
    if (userRole === "employee") {
      query = { 
        assignedTo: req.user.id,
        $or: [
          { 
            "modificationRequests.status": { $in: ["pending", "approved", "counter_proposed"] }
          },
          { 
            "employeeModificationRequests.requestedBy": req.user.id,
            "employeeModificationRequests.status": { $in: ["pending", "approved", "rejected", "executed"] }
          }
        ]
      };
    } else if (userRole === "admin" || userRole === "superadmin") {
      if (!(req.user.capabilities || []).includes("manage_requests")) {
        return res.status(403).json({ error: "Missing capability: manage_requests" });
      }
      query = {
        ...(userRole === "superadmin" ? {} : { createdBy: req.user.id }),
        $or: [
          { "modificationRequests.requestedBy": req.user.id, "modificationRequests.status": { $in: ["pending", "approved", "counter_proposed"] } },
          { "employeeModificationRequests.status": { $in: ["pending", "approved", "rejected", "executed"] } }
        ]
      };
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email department")
      .populate("modificationRequests.requestedBy", "name email")
      .populate("employeeModificationRequests.requestedBy", "name email")
      .select("title status assignedTo department modificationRequests employeeModificationRequests");

    const pendingRequests = [];
    const nowTs = Date.now();
    
    tasks.forEach(task => {
      // Admin-initiated requests
      task.modificationRequests.forEach(request => {
        const isPending = request.status === "pending" && new Date(request.expiresAt) > new Date();
        const isApproved = request.status === "approved";
        const isCounter = request.status === "counter_proposed";
        if (isPending || isApproved || isCounter) {
          pendingRequests.push({
            origin: "admin_initiated",
            requestId: request._id,
            taskId: task._id,
            taskTitle: task.title,
            taskStatus: task.status,
            requestType: request.requestType,
            reason: request.reason,
            requestedBy: request.requestedBy,
            requestedAt: request.requestedAt,
            createdAt: request.createdAt,
            expiresAt: request.expiresAt,
            employeeViewedAt: request.employeeViewedAt,
            status: request.status,
            response: request.response,
            assignedTo: task.assignedTo,
            department: task.department,
            proposedChanges: request.proposedChanges,
            deletionImpact: request.deletionImpact,
            urgency: request.urgency,
            discussion: request.discussion || []
          });
        }
      });
      
      // Employee-initiated requests
      if (task.employeeModificationRequests) {
        task.employeeModificationRequests.forEach(request => {
          const includeEmployeeRequest =
            (userRole === "employee" &&
              request.requestedBy?.toString() === req.user.id &&
              ["pending", "approved", "rejected", "executed"].includes(request.status)) ||
            ((userRole === "admin" || userRole === "superadmin") &&
              ["pending", "approved", "rejected", "executed"].includes(request.status));

          if (includeEmployeeRequest) {
            pendingRequests.push({
              origin: "employee_initiated",
              requestId: request._id,
              taskId: task._id,
              taskTitle: task.title,
              taskStatus: task.status,
              requestType: request.requestType,
              reason: request.reason,
              requestedBy: request.requestedBy,
              requestedAt: request.requestedAt,
              createdAt: request.createdAt,
              expiresAt: request.expiresAt,
              status: request.status,
              assignedTo: task.assignedTo,
              department: task.department,
              proposedChanges: request.proposedChanges,
              businessCase: request.businessCase,
              urgency: request.urgency,
              supportingDocs: request.supportingDocs,
              discussion: request.discussion || []
            });
          }
        });
      }
    });

    const summary = {
      totalCount: pendingRequests.length,
      pendingCount: pendingRequests.filter((r) => {
        if (r.status !== "pending") return false;
        const exp = r.expiresAt ? new Date(r.expiresAt).getTime() : null;
        return !(exp != null && exp <= nowTs);
      }).length,
      approvedCount: pendingRequests.filter((r) => r.status === "approved").length,
      rejectedCount: pendingRequests.filter((r) => r.status === "rejected").length,
      counterCount: pendingRequests.filter((r) => r.status === "counter_proposed").length,
      adminInitiatedCount: pendingRequests.filter((r) => r.origin === "admin_initiated").length,
      employeeInitiatedCount: pendingRequests.filter((r) => r.origin === "employee_initiated").length
    };

    let filtered = pendingRequests;

    if (originFilter !== "all") {
      filtered = filtered.filter((r) => (r.origin || "").toLowerCase() === originFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => String(r.status || "").toLowerCase() === statusFilter);
    }

    if (search) {
      filtered = filtered.filter((r) => {
        const taskTitle = String(r.taskTitle || "").toLowerCase();
        const reason = String(r.reason || "").toLowerCase();
        const requestType = String(r.requestType || "").toLowerCase();
        const assigneeName = String(r.assignedTo?.name || "").toLowerCase();
        const assigneeEmail = String(r.assignedTo?.email || "").toLowerCase();
        return (
          taskTitle.includes(search) ||
          reason.includes(search) ||
          requestType.includes(search) ||
          assigneeName.includes(search) ||
          assigneeEmail.includes(search)
        );
      });
    }

    filtered.sort((a, b) => {
      const urgencyOrder = { critical: 1, high: 2, normal: 3, low: 4 };
      const aUrgency = urgencyOrder[a.urgency] || 3;
      const bUrgency = urgencyOrder[b.urgency] || 3;
      if (sort === "oldest") {
        return new Date(a.requestedAt || a.createdAt || 0) - new Date(b.requestedAt || b.createdAt || 0);
      }
      if (sort === "recent") {
        return new Date(b.requestedAt || b.createdAt || 0) - new Date(a.requestedAt || a.createdAt || 0);
      }
      return aUrgency - bUrgency || new Date(a.requestedAt || a.createdAt || 0) - new Date(b.requestedAt || b.createdAt || 0);
    });

    const totalFiltered = filtered.length;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    res.json({
      success: true,
      pendingRequests: paged,
      count: paged.length,
      summary,
      breakdown: {
        adminInitiated: summary.adminInitiatedCount,
        employeeInitiated: summary.employeeInitiatedCount
      },
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.max(1, Math.ceil(totalFiltered / limit))
      },
      filters: {
        status: statusFilter,
        origin: originFilter,
        search,
        sort
      }
    });
  } catch (err) {
    console.error("Get pending requests error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ✅ EMPLOYEE: RESPOND TO MODIFICATION REQUEST - ENTERPRISE
===================================================== */
/* =====================================================
   EMPLOYEE → MARK MODIFICATION REQUEST VIEWED
===================================================== */
router.patch("/:id/modification-request/:requestId/viewed", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }

    const request = task.modificationRequests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Modification request not found" });
    }

    if (!request.employeeViewedAt) {
      request.employeeViewedAt = new Date();
      request.employeeViewedBy = req.user.id;

      task.activityTimeline.push({
        action: "MODIFICATION_VIEWED",
        performedBy: req.user.id,
        role: "employee",
        details: `Modification request viewed (${request.requestType})`,
        timestamp: new Date()
      });

      await task.save();
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error("Mark modification request viewed error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.patch("/:id/modification-request/:requestId/respond", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }

    const { decision, note, counterProposal, requestedChanges } = req.body;
    
    if (!["approved", "rejected", "counter_proposal"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    if (!note || note.trim().length < 5) {
      return res.status(400).json({
        error: "Response note required (minimum 5 characters)"
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only assigned employee can respond" });
    }

    try {
      const request = await task.respondToModificationRequest(
        req.params.requestId,
        req.user.id,
        decision,
        note.trim(),
        decision === "counter_proposal" ? counterProposal : null
      );

      if (decision === "rejected") {
        task.activityTimeline.push({
          action: "MODIFICATION_REJECTED",
          performedBy: req.user.id,
          role: "employee",
          details: `Employee declined ${request.requestType} modification request. Reason: ${note}`,
          timestamp: new Date()
        });
        await task.save();
        
        return res.json({
          success: true,
          message: "Modification request declined",
          decision: "rejected",
          requestType: request.requestType
        });
      }

      if (decision === "counter_proposal") {
        request.counterProposal = counterProposal;
        request.counterProposalBy = req.user.id;
        request.counterProposalAt = new Date();
        request.status = "counter_proposed";
        
        task.activityTimeline.push({
          action: "MODIFICATION_COUNTER_PROPOSAL",
          performedBy: req.user.id,
          role: "employee",
          details: `Employee submitted counter proposal for ${request.requestType} modification request. Note: ${note}`,
          timestamp: new Date()
        });
        
        await task.save();
        
        return res.json({
          success: true,
          message: "Counter proposal submitted",
          decision: "counter_proposal",
          counterProposal,
          requiresAdminReview: true
        });
      }

      if (decision === "approved") {
        return res.json({
          success: true,
          message: "Modification request approved by employee",
          decision: "approved",
          requestType: request.requestType,
          requiresAdminExecution: true
        });
      }

      res.json({
        success: true,
        message: `Modification request ${decision}`,
        decision,
        request,
        task: null,
        changes: null
      });
    } catch (err) {
      if (err.message === "Request has expired") {
        return res.status(410).json({
          error: "Modification request has expired",
          expired: true
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("Respond to modification error:", err);
    const msg = err.message || "Server error";
    if (msg.includes("expired") || msg.includes("processed") || msg.includes("not found")) {
      return res.status(400).json({ success: false, error: msg });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

/* =====================================================
   ✅ ADMIN: EXECUTE APPROVED MODIFICATION REQUEST
===================================================== */
router.post("/:id/approve-modification-request/:requestId", verifyJWT, requireCapability("manage_requests"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

  const { adminNote } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const request = task.modificationRequests.id(req.params.requestId);
  if (!request) return res.status(404).json({ error: "Modification request not found" });

    if (request.status !== "approved") {
      return res.status(400).json({ error: "Request not approved by employee yet" });
    }

  if (request.executedAt) {
    return res.json({ success: true, message: "Request already executed" });
  }

  const incomingChanges = req.body?.proposedChanges;
  const previousProposed = request.proposedChanges
    ? JSON.parse(JSON.stringify(request.proposedChanges))
    : null;
  const hasOverrides = Boolean(
    incomingChanges && JSON.stringify(incomingChanges) !== JSON.stringify(previousProposed || {})
  );

  if (request.requestType === "edit" && incomingChanges) {
    request.proposedChanges = incomingChanges;
  }

    if (request.requestType === "delete") {
      if (task.status !== "deleted") {
        task.status = "deleted";
        task.closedAt = new Date();
        task.activityTimeline.push({
          action: "TASK_DELETED",
          performedBy: req.user.id,
          role: "admin",
          details: `Task deleted after employee approval. Admin note: ${adminNote || "No note"}`
        });
      }

      request.status = "executed";
      request.executedAt = new Date();
      request.executedBy = req.user.id;

      await task.save();
      return res.json({ success: true, message: "Delete executed" });
    }

    const effectiveChanges = request.requestType === "edit"
      ? (incomingChanges || request.proposedChanges)
      : null;

    if (request.requestType === "edit" && effectiveChanges) {
      const changes = {};

      if (effectiveChanges.title && effectiveChanges.title !== task.title) {
        changes.title = { old: task.title, new: effectiveChanges.title };
        task.title = effectiveChanges.title;
      }

      if (effectiveChanges.description && effectiveChanges.description !== task.description) {
        changes.description = { old: task.description, new: effectiveChanges.description };
        task.description = effectiveChanges.description;
      }

      if (effectiveChanges.dueDate && new Date(effectiveChanges.dueDate).toISOString() !== task.dueDate?.toISOString()) {
        changes.dueDate = { old: task.dueDate, new: effectiveChanges.dueDate };
        task.dueDate = effectiveChanges.dueDate;
      }

      if (effectiveChanges.category && effectiveChanges.category !== task.category) {
        changes.category = { old: task.category, new: effectiveChanges.category };
        task.category = effectiveChanges.category;
      }

      if (effectiveChanges.priority && effectiveChanges.priority !== task.priority) {
        changes.priority = { old: task.priority, new: effectiveChanges.priority };
        task.priority = effectiveChanges.priority;
      }

      if (effectiveChanges.department && effectiveChanges.department !== task.department) {
        changes.department = { old: task.department, new: effectiveChanges.department };
        task.department = effectiveChanges.department;
      }

      if (effectiveChanges.tags && JSON.stringify(effectiveChanges.tags) !== JSON.stringify(task.tags)) {
        changes.tags = { old: task.tags, new: effectiveChanges.tags };
        task.tags = effectiveChanges.tags;
      }

      if (Object.keys(changes).length > 0) {
        const approvalNote = hasOverrides
          ? `${adminNote || "Executed after employee approval"} (admin adjusted proposal)`
          : (adminNote || "Executed after employee approval");
        task.editHistory.push({
          editedBy: req.user.id,
          changes,
          editedAt: new Date(),
          approvalNote,
          editType: "modification_request_executed"
        });

        const overrideNote = hasOverrides ? " Admin adjusted proposal before execution." : "";
        const note = adminNote ? ` Note: ${adminNote}` : "";
        task.activityTimeline.push({
          action: "TASK_EDITED",
          performedBy: req.user.id,
          role: "admin",
          details: `Task edited after employee approval. Changes: ${Object.keys(changes).join(", ")}.${overrideNote}${note}`
        });
      }

      request.status = "executed";
      request.executedAt = new Date();
      request.executedBy = req.user.id;

      await task.save();
      return res.json({ success: true, message: "Edit executed", changes });
    }

    return res.status(400).json({ error: "Unsupported request type" });
  } catch (err) {
    console.error("Execute modification request error:", err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =====================================================
   ✅ ADD MESSAGE TO MODIFICATION REQUEST DISCUSSION - ENTERPRISE
===================================================== */
router.post("/:id/modification-request/:requestId/message", verifyJWT, async (req, res) => {
  try {
    console.log("🎯 ENTERPRISE MESSAGE ENDPOINT HIT!");
    console.log("Task ID:", req.params.id);
    console.log("Request ID:", req.params.requestId);
    console.log("Body:", req.body);
    
    const { message, attachments, messageType } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      console.log("❌ Task not found:", req.params.id);
      return res.status(404).json({ error: "Task not found" });
    }

    let request = task.modificationRequests.id(req.params.requestId);
    let isEmployeeRequest = false;
    
    if (!request) {
      request = task.employeeModificationRequests?.id(req.params.requestId);
      isEmployeeRequest = true;
      
      if (!request) {
        console.log("❌ Request not found:", req.params.requestId);
        return res.status(404).json({ error: "Modification request not found" });
      }
    }

    if (!request.discussion) {
      request.discussion = [];
    }

    const newMessage = {
      sender: req.user.id,
      senderRole: req.user.role,
      senderName: req.user.name,
      text: message.trim(),
      messageType: messageType || "general",
      attachments: attachments || [],
      createdAt: new Date(),
      isRead: false
    };

    request.discussion.push(newMessage);

    const action = isEmployeeRequest ? "EMPLOYEE_MODIFICATION_MESSAGE" : "MODIFICATION_MESSAGE";
    
    task.activityTimeline.push({
      action: action,
      performedBy: req.user.id,
      role: req.user.role,
      details: `${req.user.role} added message to ${isEmployeeRequest ? 'employee' : 'admin'} modification request: "${message.substring(0, 50)}..."`,
      timestamp: new Date()
    });

    await task.save();

    console.log("✅ Enterprise message saved successfully");

    res.json({
      success: true,
      message: newMessage,
      discussionThread: request.discussion,
      isEmployeeRequest
    });
  } catch (err) {
    console.error("❌ Add message error:", err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =====================================================
   🆕 ADMIN APPROVE EMPLOYEE MODIFICATION REQUEST - ENTERPRISE
===================================================== */
router.post("/:id/approve-employee-modification/:requestId", verifyJWT, requireCapability("manage_requests"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { adminNote, approvalConditions, effectiveDate } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const request = task.employeeModificationRequests.id(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Modification request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is no longer pending" });
    }
    if (request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now()) {
      request.status = "expired";
      task.activityTimeline.push({
        action: "EMPLOYEE_MODIFICATION_EXPIRED",
        performedBy: req.user.id,
        role: "admin",
        details: "Employee modification request SLA expired before admin approval.",
        timestamp: new Date()
      });
      await task.save();
      return res.status(400).json({ success: false, error: "SLA expired. Request can no longer be approved." });
    }

    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    request.adminNote = adminNote || "";
    request.approvalConditions = approvalConditions || [];
    request.effectiveDate = effectiveDate || new Date();

    task.activityTimeline.push({
      action: "MODIFICATION_APPROVED",
      performedBy: req.user.id,
      role: "admin",
      details: `Admin approved employee modification request. Admin note: ${adminNote || "No note"}`,
      timestamp: new Date()
    });

    await task.save();

    res.json({
      success: true,
      message: "Employee modification request approved",
      taskId: task._id,
      requestId: request._id,
      requestStatus: request.status,
      effectiveDate: request.effectiveDate
    });
  } catch (err) {
    console.error("❌ Approve employee modification error:", err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =====================================================
   EXECUTE APPROVED EMPLOYEE MODIFICATION REQUEST - ENTERPRISE
===================================================== */
router.post("/:id/execute-employee-modification/:requestId", verifyJWT, requireCapability("manage_tasks"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { adminNote } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const request = task.employeeModificationRequests.id(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Modification request not found" });

    if (request.status !== "approved") {
      return res.status(400).json({ error: "Request must be approved before execution" });
    }
    if (request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now()) {
      request.status = "expired";
      task.activityTimeline.push({
        action: "EMPLOYEE_MODIFICATION_EXPIRED",
        performedBy: req.user.id,
        role: "admin",
        details: "Approved employee modification request SLA expired before execution.",
        timestamp: new Date()
      });
      await task.save();
      return res.status(400).json({ success: false, error: "SLA expired. Request can no longer be executed." });
    }

    request.status = "executed";
    request.executedAt = new Date();
    request.executedBy = req.user.id;
    request.adminNote = adminNote || request.adminNote || "";

    if (request.requestType === "delete") {
      task.status = "deleted";
      task.closedAt = new Date();
      task.activityTimeline.push({
        action: "TASK_DELETED",
        performedBy: req.user.id,
        role: "admin",
        details: `Task deleted after executing approved employee request. Admin note: ${adminNote || "No note"}`,
        timestamp: new Date()
      });
    } else if (request.requestType === "edit") {
      if (req.body?.proposedChanges) {
        request.proposedChanges = req.body.proposedChanges;
      }
      if (request.proposedChanges) {
        const changes = {};

        if (request.proposedChanges.title && request.proposedChanges.title !== task.title) {
          changes.title = { old: task.title, new: request.proposedChanges.title };
          task.title = request.proposedChanges.title;
        }

        if (request.proposedChanges.description && request.proposedChanges.description !== task.description) {
          changes.description = { old: task.description, new: request.proposedChanges.description };
          task.description = request.proposedChanges.description;
        }

        if (request.proposedChanges.dueDate) {
          const oldDate = task.dueDate?.toISOString();
          const newDate = new Date(request.proposedChanges.dueDate).toISOString();
          if (oldDate !== newDate) {
            changes.dueDate = { old: task.dueDate, new: request.proposedChanges.dueDate };
            task.dueDate = request.proposedChanges.dueDate;
          }
        }

        if (request.proposedChanges.category && request.proposedChanges.category !== task.category) {
          changes.category = { old: task.category, new: request.proposedChanges.category };
          task.category = request.proposedChanges.category;
        }

        if (request.proposedChanges.priority && request.proposedChanges.priority !== task.priority) {
          changes.priority = { old: task.priority, new: request.proposedChanges.priority };
          task.priority = request.proposedChanges.priority;
        }

        if (Object.keys(changes).length > 0) {
          task.editHistory.push({
            editedBy: req.user.id,
            changes,
            reason: "Executed approved employee modification request",
            editedAt: new Date(),
            editType: "employee_request_executed"
          });

          task.activityTimeline.push({
            action: "TASK_EDITED",
            performedBy: req.user.id,
            role: "admin",
            details: `Task edited by executing approved employee request. Changes: ${Object.keys(changes).join(", ")}`,
            timestamp: new Date()
          });
        }
      }
    } else if (request.requestType === "extension") {
      if (req.body?.requestedExtension) {
        request.requestedExtension = req.body.requestedExtension;
      }
      const extension = {
        requestedBy: request.requestedBy,
        reason: request.extensionReason || "Employee requested extension",
        oldDueDate: task.dueDate,
        newDueDate: request.requestedExtension,
        status: "approved",
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        adminNote: adminNote
      };

      if (!task.extensionRequests) task.extensionRequests = [];
      task.extensionRequests.push(extension);

      task.dueDate = request.requestedExtension;

      task.activityTimeline.push({
        action: "EXTENSION_APPROVED",
        performedBy: req.user.id,
        role: "admin",
        details: `Task extended by executing approved employee request. New due date: ${request.requestedExtension}`,
        timestamp: new Date()
      });
    } else if (request.requestType === "reassign" && request.suggestedReassign) {
      const newEmployee = await User.findById(request.suggestedReassign);
      if (newEmployee && newEmployee.role === "employee") {
        const oldEmployee = task.assignedTo;
        task.assignedTo = newEmployee._id;

        task.activityTimeline.push({
          action: "TASK_REASSIGNED",
          performedBy: req.user.id,
          role: "admin",
          details: `Task reassigned from ${oldEmployee} to ${newEmployee._id} by executing approved employee request`,
          timestamp: new Date()
        });
      }
    } else if (request.requestType === "scope_change" && request.scopeChanges) {
      task.scopeChanges = request.scopeChanges;
      task.scopeChangeApprovedAt = new Date();
      task.scopeChangeApprovedBy = req.user.id;

      task.activityTimeline.push({
        action: "SCOPE_CHANGE_APPROVED",
        performedBy: req.user.id,
        role: "admin",
        details: `Scope change executed: ${JSON.stringify(request.scopeChanges).substring(0, 100)}...`,
        timestamp: new Date()
      });
    }

    await task.save();

    res.json({
      success: true,
      message: "Employee modification request executed",
      taskId: task._id,
      requestId: request._id,
      requestStatus: request.status
    });
  } catch (err) {
    console.error("Execute employee modification error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: err.message || "Server error",
        code: "REQUEST_MODIFICATION_FAILED"
      })
    );
  }
});

/* =====================================================
   🆕 ADMIN REJECT EMPLOYEE MODIFICATION REQUEST - ENTERPRISE
===================================================== */
router.post("/:id/reject-employee-modification/:requestId", verifyJWT, requireCapability("manage_requests"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { reason, alternativeSolution, followUpDate } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const request = task.employeeModificationRequests.id(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Modification request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is no longer pending" });
    }

    request.status = "rejected";
    request.rejectionReason = reason.trim();
    request.alternativeSolution = alternativeSolution || "";
    request.followUpDate = followUpDate || null;
    request.rejectedAt = new Date();
    request.rejectedBy = req.user.id;

    task.activityTimeline.push({
      action: "MODIFICATION_REJECTED",
      performedBy: req.user.id,
      role: "admin",
      details: `Admin rejected employee ${request.requestType} modification request. Reason: ${reason.trim()}. Alternative: ${alternativeSolution || 'None provided'}`,
      timestamp: new Date()
    });

    await task.save();

    res.json({
      success: true,
      message: "Employee modification request rejected with alternative solution",
      task,
      alternativeSolution,
      followUpDate
    });
  } catch (err) {
    console.error("❌ Reject employee modification error:", err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =====================================================
   ✅ ADMIN → REASSIGN TASK (ENTERPRISE REASSIGNMENT)
===================================================== */
router.patch("/:id/reassign", verifyJWT, requireCapability("manage_tasks"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { newEmployeeId, reason, handoverNotes, startDate, priorityChange } = req.body;
    
    if (!newEmployeeId) {
      return res.status(400).json({ error: "New employee ID required" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const canReassign =
      task.status === "withdrawn" ||
      (task.status === "declined_by_employee" && (!task.declineType || task.declineType === "assignment_decline"));
    
    if (!canReassign) {
      return res.status(400).json({
        error: `Cannot reassign task with status: ${task.status}`,
        allowedStatuses: ["withdrawn", "declined_by_employee (assignment_decline only)"]
      });
    }

    const newEmployee = await User.findById(newEmployeeId);
    if (!newEmployee || newEmployee.role !== "employee") {
      return res.status(404).json({ error: "New employee not found" });
    }

    const oldEmployeeId = task.assignedTo;
    const oldEmployee = await User.findById(oldEmployeeId);
    
    task.assignedTo = newEmployeeId;
    task.reassignmentReason = reason || "Admin reassignment";
    task.handoverNotes = handoverNotes || "";
    task.reassignedAt = new Date();
    task.reassignedBy = req.user.id;
    
    if (priorityChange) {
      task.priority = priorityChange;
    }
    
    if (["declined_by_employee", "withdrawn"].includes(task.status)) {
      task.status = "assigned";
      task.declineReason = "";
      task.declineType = null;
    }

    task.activityTimeline.push({
      action: "TASK_REASSIGNED",
      performedBy: req.user.id,
      role: "admin",
      actorName: req.user.name || req.user.email,
      targetName: newEmployee.name,
      details: `Reassigned from ${oldEmployee?.name || oldEmployeeId} to ${newEmployee.name}. Reason: ${reason || "Admin reassignment"}`,
      timestamp: new Date()
    });

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email department")
      .populate("createdBy", "name email");

    return res.json({
      success: true,
      message: "Task reassigned successfully with handover notes",
      task: updatedTask,
      oldEmployee: oldEmployeeId,
      newEmployee: newEmployeeId,
      reassignmentDetails: {
        reason: task.reassignmentReason,
        handoverNotes: task.handoverNotes,
        reassignedAt: task.reassignedAt
      }
    });
  } catch (err) {
    console.error("Reassign task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EXTENSION SYSTEM ROUTES - ENTERPRISE
===================================================== */

// Employee request extension
router.post("/:id/request-extension", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Employees only" });
    }
    
    const { reason, newDueDate, impactAssessment, supportingDocs } = req.body;
    
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ 
        error: "Reason required (minimum 5 characters)" 
      });
    }
    
    if (!newDueDate || isNaN(new Date(newDueDate))) {
      return res.status(400).json({ 
        error: "Valid new due date required" 
      });
    }
    
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    
    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not your task" });
    }
    
    if (!task.canRequestExtension()) {
      return res.status(400).json({
        error: "Cannot request extension for this task",
        canRequest: false
      });
    }
    
    const extension = await task.requestExtension(
      req.user.id,
      reason,
      newDueDate,
      impactAssessment,
      supportingDocs
    );
    
    res.json({
      success: true,
      message: "Extension requested with impact assessment",
      extension,
      task: {
        id: task._id,
        title: task.title,
        status: task.status,
        currentDueDate: task.dueDate
      }
    });
  } catch (err) {
    console.error("Request extension error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin approve/reject extension
router.patch("/:id/extension/:requestId", verifyJWT, requireCapability("manage_requests"), blockIfTaskClosed, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    
    const { decision, note, approvedDate, conditions } = req.body;
    
    if (!["approve", "reject", "partial_approve"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }
    
    if (!note || note.trim().length < 5) {
      return res.status(400).json({ 
        error: "Review note required (minimum 5 characters)" 
      });
    }
    
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    
    let result;
    if (decision === "approve") {
      result = await task.approveExtension(req.user.id, req.params.requestId, note, approvedDate, conditions);
    } else if (decision === "partial_approve") {
      result = await task.partiallyApproveExtension(req.user.id, req.params.requestId, note, req.body.partialDate, conditions);
    } else {
      result = await task.rejectExtension(req.user.id, req.params.requestId, note);
    }
    
    res.json({
      success: true,
      message: `Extension ${decision}d`,
      decision,
      extension: result,
      task: {
        id: task._id,
        title: task.title,
        dueDate: task.dueDate,
        isOverdue: task.isOverdue
      }
    });
  } catch (err) {
    console.error("Process extension error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin directly extend due date
router.patch("/:id/extend-due", verifyJWT, requireCapability("manage_tasks"), blockIfTaskClosed, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    
    const { newDueDate, reason, notificationRequired, priorityUpdate } = req.body;
    
    if (!newDueDate || !reason) {
      return res.status(400).json({ 
        error: "New due date and reason required" 
      });
    }
    
    if (reason.trim().length < 5) {
      return res.status(400).json({ 
        error: "Reason required (minimum 5 characters)" 
      });
    }
    
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    
    const updatedTask = await task.extendDueDate(
      req.user.id,
      newDueDate,
      reason,
      notificationRequired,
      priorityUpdate
    );
    
    res.json({
      success: true,
      message: "Due date extended with enterprise tracking",
      task: updatedTask,
      oldDueDate: task.dueDate,
      newDueDate: updatedTask.dueDate,
      extensionReason: reason,
      requiresEmployeeNotification: notificationRequired !== false
    });
  } catch (err) {
    console.error("Extend due date error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get extension requests for a task
router.get("/:id/extensions", verifyJWT, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("extensionRequests.requestedBy", "name email role department")
      .populate("extensionRequests.reviewedBy", "name email");
    
    if (!task) return res.status(404).json({ error: "Task not found" });
    
    const isAdmin = req.user.role === "admin";
    const isAssignedEmployee = task.assignedTo.toString() === req.user.id;
    
    if (!isAdmin && !isAssignedEmployee) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const extensions = task.extensionRequests || [];
    
    // Calculate statistics
    const stats = {
      total: extensions.length,
      approved: extensions.filter(e => e.status === "approved").length,
      rejected: extensions.filter(e => e.status === "rejected").length,
      pending: extensions.filter(e => e.status === "pending").length,
      partiallyApproved: extensions.filter(e => e.status === "partially_approved").length
    };
    
    res.json({
      success: true,
      extensions,
      count: extensions.length,
      statistics: stats,
      canRequestExtension: task.canRequestExtension?.() || false
    });
  } catch (err) {
    console.error("Get extensions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN ↔ EMPLOYEE → DISCUSSION (ENTERPRISE)
===================================================== */
router.post("/:id/message", verifyJWT, blockIfTaskClosed, async (req, res) => {
  try {
    const { text, attachments, messageType, mentionedUsers } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Message required" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (
      req.user.role === "employee" &&
      task.assignedTo.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: "Not your task" });
    }

    if (!task.discussion) {
      task.discussion = [];
    }

    const message = {
      sender: req.user.id,
      senderRole: req.user.role,
      senderName: req.user.name,
      text: text,
      attachments: attachments || [],
      messageType: messageType || "general",
      mentionedUsers: mentionedUsers || [],
      createdAt: new Date(),
      isRead: false,
      reactions: []
    };

    task.discussion.push(message);

    task.activityTimeline.push({
      action: "COMMENT_ADDED",
      performedBy: req.user.id,
      role: req.user.role,
      details: text.substring(0, 100),
      timestamp: new Date(),
    });

    await task.save();

    return res.status(200).json({
      success: true,
      message,
      discussion: task.discussion,
      totalMessages: task.discussion.length
    });
  } catch (err) {
    console.error("Add message error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

/* =====================================================
   VIEW DISCUSSION THREAD WITH ENTERPRISE FEATURES
===================================================== */
router.get("/:id/messages", verifyJWT, async (req, res) => {
  try {
    let task;
    try {
        task = await Task.findById(req.params.id)
          .populate("discussion.sender", "name email role department");
    } catch (populateErr) {
      console.error("Populate error in GET /:id/messages, returning raw discussion:", populateErr);
      task = await Task.findById(req.params.id);
    }

    if (!task) return res.status(404).json({ error: "Task not found" });

    if (
      req.user.role === "admin" ||
      task.assignedTo.toString() === req.user.id
    ) {
      // Mark unread messages as read for this user
      if (task.discussion) {
        task.discussion.forEach(msg => {
          if (msg.sender._id.toString() !== req.user.id && !msg.isRead) {
            msg.isRead = true;
          }
        });
        await task.save();
      }

        return res.json({ 
          success: true, 
          discussion: task.discussion || [],
          canReply: true,
          canAttachFiles: true,
          canMentionUsers: true
        });
      }

    return res.status(403).json({ error: "Access denied" });
  } catch (err) {
    console.error("Get messages error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   REACT TO MESSAGE (ENTERPRISE REACTIONS)
===================================================== */
router.post("/:id/message/:messageId/react", verifyJWT, async (req, res) => {
  try {
    const { reaction } = req.body;
    
    if (!reaction || !["like", "celebrate", "insightful", "love", "curious", "disagree"].includes(reaction)) {
      return res.status(400).json({ error: "Valid reaction required" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (
      req.user.role === "employee" &&
      task.assignedTo.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: "Not your task" });
    }

    const message = task.discussion.id(req.params.messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (!message.reactions) {
      message.reactions = [];
    }

    // Remove existing reaction from same user
    message.reactions = message.reactions.filter(r => r.user.toString() !== req.user.id);
    
    // Add new reaction
    message.reactions.push({
      user: req.user.id,
      reaction,
      reactedAt: new Date()
    });

    await task.save();

    return res.json({
      success: true,
      message: "Reaction added",
      reactions: message.reactions,
      reactionCount: message.reactions.length
    });
  } catch (err) {
    console.error("React to message error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ADMIN → GET TASK STATISTICS (ENTERPRISE OVERVIEW)
===================================================== */
router.get("/statistics/overview", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { department, timeframe } = req.query;
    
    let filter = {};
    if (req.user.role !== "superadmin") {
      filter.createdBy = req.user.id;
    }
    if (department && department !== 'all') {
      filter.department = department;
    }
    
    if (timeframe) {
      const startDate = new Date();
      if (timeframe === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeframe === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (timeframe === 'quarter') {
        startDate.setMonth(startDate.getMonth() - 3);
      } else if (timeframe === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
      filter.createdAt = { $gte: startDate };
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email department")
      .populate("createdBy", "name email");

    const activeTasks = tasks.filter(t => 
      ["assigned", "accepted", "in_progress", "reopened"].includes(t.status)
    ).length;
    
    const pendingReviews = tasks.filter(t => t.status === "completed").length;
    
    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const status = t.status;
      if (["completed", "verified", "failed", "declined_by_employee", "withdrawn", "deleted"].includes(status)) return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    
    const draftTasks = tasks.filter(t => t.status === "assigned").length;
    const verifiedTasks = tasks.filter(t => t.status === "verified").length;
    const failedTasks = tasks.filter(t => t.status === "failed").length;
    const archivedTasks = tasks.filter(t => t.isArchived).length;

    // Department breakdown
    const departmentStats = {};
    tasks.forEach(task => {
      const dept = task.department || 'uncategorized';
      if (!departmentStats[dept]) {
        departmentStats[dept] = {
          total: 0,
          active: 0,
          completed: 0,
          overdue: 0
        };
      }
      departmentStats[dept].total++;
      
      if (["assigned", "accepted", "in_progress", "reopened"].includes(task.status)) {
        departmentStats[dept].active++;
      }
      
      if (task.status === "verified") {
        departmentStats[dept].completed++;
      }
      
      if (task.dueDate && new Date(task.dueDate) < new Date() && 
          !["completed", "verified", "failed", "declined_by_employee", "withdrawn", "deleted"].includes(task.status)) {
        departmentStats[dept].overdue++;
      }
    });

    const employeeScope = req.user.role === "superadmin"
      ? { role: "employee", status: "active" }
      : { role: "employee", status: "active", createdBy: req.user.id };
    const employees = await User.find(employeeScope).countDocuments();

    return res.json({
      success: true,
      timeframe: timeframe || 'all',
      department: department || 'all',
      statistics: {
        activeTasks,
        pendingReviews,
        overdueTasks,
        draftTasks,
        verifiedTasks,
        failedTasks,
        archivedTasks,
        activeEmployees: employees,
        totalTasks: tasks.length,
        completionRate: tasks.length > 0 ? ((verifiedTasks / tasks.length) * 100).toFixed(1) : 0,
        overdueRate: tasks.length > 0 ? ((overdueTasks / tasks.length) * 100).toFixed(1) : 0
      },
      departmentBreakdown: departmentStats,
      trendData: {
        dailyCompletion: [], // Would be populated from time-series data
        weeklyTrend: [] // Would be populated from time-series data
      }
    });
  } catch (err) {
    console.error("Get task statistics error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 PERFORMANCE SNAPSHOT - Get employee performance (ENTERPRISE)
===================================================== */
router.get("/performance/:employeeId", verifyJWT, async (req, res) => {
  try {
    const { employeeId: rawEmployeeId } = req.params;
    const isSelf = rawEmployeeId === "self";

    if (isSelf) {
      if (!["employee", "admin"].includes(req.user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      if (!["admin", "superadmin"].includes(req.user.role)) {
        return res.status(403).json({ error: "Admin only" });
      }
      if (req.user.role !== "superadmin") {
        const actor = await User.findById(req.user.id).select("adminCapabilities").lean();
        const actorCapabilities = Array.isArray(actor?.adminCapabilities) ? actor.adminCapabilities : [];
        // Backward compatibility: legacy admins without configured capability list keep analytics access.
        if (actorCapabilities.length > 0 && !actorCapabilities.includes("view_analytics")) {
          return res.status(403).json({ error: "Missing capability: view_analytics" });
        }
      }
    }

    const employeeId = isSelf ? req.user.id : rawEmployeeId;
    const { timeframe = "all", department } = req.query;

    const employee = await User.findById(employeeId);
    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (!isSelf && req.user.role !== "superadmin" && String(employee.createdBy || "") !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied for this employee" });
    }

    let dateFilter = {};
    const now = new Date();
    if (timeframe === "month") {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (timeframe === "quarter") {
      const quarter = Math.floor(now.getMonth() / 3);
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), quarter * 3, 1) } };
    } else if (timeframe === "year") {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } };
    }

    if (department && department !== 'all') {
      dateFilter.department = department;
    }

    const performanceTaskFilter = {
      assignedTo: employeeId,
      ...dateFilter
    };
    if (!isSelf && req.user.role !== "superadmin") {
      performanceTaskFilter.createdBy = req.user.id;
    }

    const tasks = await Task.find(performanceTaskFilter).populate("reviewedBy", "name");

    const totalTasks = tasks.length;
    const verifiedTasks = tasks.filter(t => t.status === "verified").length;
    const failedTasks = tasks.filter(t => t.status === "failed").length;
    const onTimeTasks = tasks.filter(t => {
      if (!t.completedAt || !t.dueDate) return false;
      return new Date(t.completedAt) <= new Date(t.dueDate);
    }).length;

    const acceptedTasks = tasks.filter(t => t.acceptedAt);
    const avgAcceptanceTime = acceptedTasks.length > 0
      ? acceptedTasks.reduce((sum, t) => {
          const diff = new Date(t.acceptedAt) - new Date(t.createdAt);
          return sum + (diff / (1000 * 60 * 60));
        }, 0) / acceptedTasks.length
      : 0;

    const completedTasks = tasks.filter(t => t.completedAt && t.acceptedAt);
    const avgCompletionTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => {
          const diff = new Date(t.completedAt) - new Date(t.acceptedAt);
          return sum + (diff / (1000 * 60 * 60));
        }, 0) / completedTasks.length
      : 0;

    const lateSubmissions = tasks.filter(t => {
      if (!t.completedAt || !t.dueDate) return false;
      return new Date(t.completedAt) > new Date(t.dueDate);
    }).length;

    const lateCurrentOpen = tasks.filter((t) => {
      if (!t.dueDate) return false;
      if (!["assigned", "accepted", "in_progress", "reopened"].includes(t.status)) return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    const noResponseTasks = tasks.filter(t => 
      t.status === "assigned" && 
      (new Date() - new Date(t.createdAt)) > (48 * 60 * 60 * 1000)
    ).length;

    // Outcome-level reopen metric must reflect current outcome state, not historical events.
    const reopenedCurrent = tasks.filter(t => t.status === "reopened").length;
    const reopenedHistorical = tasks.filter(t => {
      if (t.activityTimeline?.some(a => a.action === "TASK_REOPENED")) return true;
      if (t.reopenReason || t.reopenDueAt || t.reopenSlaStatus) return true;
      return false;
    }).length;

    const declinedTasks = tasks.filter((t) => t.status === "declined_by_employee").length;
    const declinedHistorical = tasks.filter((t) => {
      if (t.status === "declined_by_employee") return true;
      return t.activityTimeline?.some((evt) => evt.action === "TASK_DECLINED_BY_EMPLOYEE");
    }).length;

    const hasApprovedExtension = (task) =>
      Array.isArray(task.extensionRequests) &&
      task.extensionRequests.some((e) => e.status === "approved");

    const isOpenSlaTrackStatus = (status) =>
      ["assigned", "accepted", "in_progress", "reopened", "completed"].includes(status);

    const extensionBreachesHistorical = tasks.filter((t) => {
      if (!hasApprovedExtension(t) || !t.dueDate) return false;
      const dueTs = new Date(t.dueDate).getTime();
      if (Number.isNaN(dueTs)) return false;

      if (t.completedAt) {
        return new Date(t.completedAt).getTime() > dueTs;
      }
      return false;
    }).length;

    const extensionBreachesCurrent = tasks.filter((t) => {
      if (!hasApprovedExtension(t) || !t.dueDate || t.completedAt) return false;
      const dueTs = new Date(t.dueDate).getTime();
      if (Number.isNaN(dueTs)) return false;
      return isOpenSlaTrackStatus(t.status) && Date.now() > dueTs;
    }).length;

    const standardSlaBreaches = tasks.filter((t) =>
      t.failureType === "overdue_timeout" && !hasApprovedExtension(t)
    ).length;

    const slaBreachesHistorical = standardSlaBreaches + extensionBreachesHistorical;
    const slaBreachesCurrent = lateCurrentOpen + extensionBreachesCurrent;
    const slaBreaches = slaBreachesHistorical + slaBreachesCurrent;

    const extendedTasks = tasks.filter(t => 
      t.extensionRequests?.some(e => e.status === "approved")
    ).length;

    const qualityScores = tasks.filter(t => t.qualityScore).map(t => t.qualityScore);
    const avgQualityScore = qualityScores.length > 0
      ? (qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(1)
      : 0;

    // Calculate performance rating
    let performanceRating = "Satisfactory";
    const completionRate = totalTasks > 0 ? (verifiedTasks / totalTasks) * 100 : 0;
    const onTimeRate = totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 0;
    
    if (completionRate >= 90 && onTimeRate >= 85 && avgQualityScore >= 4) {
      performanceRating = "Exceptional";
    } else if (completionRate >= 80 && onTimeRate >= 75 && avgQualityScore >= 3) {
      performanceRating = "Exceeds Expectations";
    } else if (completionRate >= 70 && onTimeRate >= 65) {
      performanceRating = "Meets Expectations";
    } else if (completionRate < 60 || onTimeRate < 50) {
      performanceRating = "Needs Improvement";
    }

    return res.json({
      success: true,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        hireDate: employee.hireDate,
        performanceReview: employee.performanceReview || null,
        performanceReviewHistory: (employee.performanceReviewHistory || [])
          .filter((r) => !r.isDeleted)
          .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      },
      timeframe,
      department: department || 'all',
      performanceMetrics: {
        totalTasks,
        verified: verifiedTasks,
        failed: failedTasks,
        onTime: onTimeTasks,
        onTimeRate: totalTasks > 0 ? ((onTimeTasks / totalTasks) * 100).toFixed(1) : 0,
        verificationRate: totalTasks > 0 ? ((verifiedTasks / totalTasks) * 100).toFixed(1) : 0,
        avgAcceptanceTime: avgAcceptanceTime.toFixed(1),
        avgCompletionTime: avgCompletionTime.toFixed(1),
        avgQualityScore,
        reopenRate: totalTasks > 0 ? ((reopenedCurrent / totalTasks) * 100).toFixed(1) : 0,
        reopenHistoricalRate: totalTasks > 0 ? ((reopenedHistorical / totalTasks) * 100).toFixed(1) : 0,
        reopenedCurrentCount: reopenedCurrent,
        reopenedHistoricalCount: reopenedHistorical,
        extended: extendedTasks,
        performanceRating
      },
      failureBreakdown: {
        lateSubmissions,
        lateCurrentOpen,
        lateHistorical: lateSubmissions,
        noResponse: noResponseTasks,
        // Backward-compatible field now mapped to historical reopen events.
        reopens: reopenedHistorical,
        reopensCurrent: reopenedCurrent,
        reopensHistorical: reopenedHistorical,
        declines: declinedTasks,
        declinesCurrent: declinedTasks,
        declinesHistorical: declinedHistorical,
        slaBreaches,
        slaBreachesCurrent,
        slaBreachesHistorical,
        standardSlaBreaches,
        extensionBreaches: extensionBreachesHistorical + extensionBreachesCurrent,
        extensionBreachesCurrent,
        extensionBreachesHistorical
      },
      improvementAreas: {
        needsImprovement: failedTasks > 0 || reopenedHistorical > 0 || lateSubmissions > 0,
        areas: [
          ...(failedTasks > 0 ? ["Task Quality"] : []),
          ...(reopenedHistorical > 0 ? ["First-time Completion"] : []),
          ...(lateSubmissions > 0 ? ["Time Management"] : []),
          ...(declinedTasks > 0 ? ["Task Acceptance"] : [])
        ]
      },
      taskHistory: tasks.map(t => ({
        id: t._id,
        title: t.title,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        dueDate: t.dueDate,
        resolution: t.resolution,
        qualityScore: t.qualityScore,
        department: t.department
      }))
    });
  } catch (err) {
    console.error("Performance snapshot error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 FAILURE INTELLIGENCE - Get failure patterns (ENTERPRISE)
===================================================== */
router.get("/intelligence/failures", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { timeframe = 30, department, severity } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    let filter = { createdAt: { $gte: startDate } };
    if (req.user.role !== "superadmin") {
      filter.createdBy = req.user.id;
    }
    if (department && department !== 'all') filter.department = department;

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email department")
      .populate("reviewedBy", "name");

    // Failure patterns by type
    const failureTypes = {};
    const failureTimeline = [];
    
    tasks.forEach(t => {
      if (t.failureType) {
        if (!failureTypes[t.failureType]) {
          failureTypes[t.failureType] = {
            count: 0,
            tasks: [],
            departments: new Set(),
            avgTimeToFailure: 0,
            totalTime: 0
          };
        }
        failureTypes[t.failureType].count++;
        failureTypes[t.failureType].tasks.push({
          id: t._id,
          title: t.title,
          assignedTo: t.assignedTo,
          failureReason: t.failureReason,
          createdAt: t.createdAt
        });
        
        if (t.department) {
          failureTypes[t.failureType].departments.add(t.department);
        }
        
        if (t.completedAt && t.acceptedAt) {
          const timeToFailure = (new Date(t.completedAt) - new Date(t.acceptedAt)) / (1000 * 60 * 60 * 24);
          failureTypes[t.failureType].totalTime += timeToFailure;
        }
      }
      
      // Build timeline for failures
      if (t.status === "failed" && t.closedAt) {
        failureTimeline.push({
          date: t.closedAt.toISOString().split('T')[0],
          taskId: t._id,
          failureType: t.failureType,
          department: t.department
        });
      }
    });

    // Calculate averages
    Object.keys(failureTypes).forEach(type => {
      if (failureTypes[type].count > 0) {
        failureTypes[type].avgTimeToFailure = (failureTypes[type].totalTime / failureTypes[type].count).toFixed(1);
        failureTypes[type].departments = Array.from(failureTypes[type].departments);
      }
    });

    // Employee failure patterns
    const employeeFailures = {};
    const departmentFailures = {};
    
    tasks.forEach(t => {
      if (t.status === "failed" && t.assignedTo) {
        const empId = t.assignedTo._id.toString();
        if (!employeeFailures[empId]) {
          employeeFailures[empId] = {
            employee: t.assignedTo,
            totalFailures: 0,
            failureTypes: {},
            departments: new Set(),
            timeline: []
          };
        }
        employeeFailures[empId].totalFailures++;
        
        if (!employeeFailures[empId].failureTypes[t.failureType]) {
          employeeFailures[empId].failureTypes[t.failureType] = 0;
        }
        employeeFailures[empId].failureTypes[t.failureType]++;
        
        if (t.department) {
          employeeFailures[empId].departments.add(t.department);
        }
        
        employeeFailures[empId].timeline.push({
          date: t.closedAt.toISOString().split('T')[0],
          taskId: t._id,
          failureType: t.failureType
        });
        
        // Department failures
        if (t.department) {
          if (!departmentFailures[t.department]) {
            departmentFailures[t.department] = {
              totalFailures: 0,
              commonFailureTypes: {},
              employees: new Set()
            };
          }
          departmentFailures[t.department].totalFailures++;
          departmentFailures[t.department].employees.add(empId);
          
          if (!departmentFailures[t.department].commonFailureTypes[t.failureType]) {
            departmentFailures[t.department].commonFailureTypes[t.failureType] = 0;
          }
          departmentFailures[t.department].commonFailureTypes[t.failureType]++;
        }
      }
    });

    // Convert sets to arrays
    Object.keys(employeeFailures).forEach(empId => {
      employeeFailures[empId].departments = Array.from(employeeFailures[empId].departments);
    });
    
    Object.keys(departmentFailures).forEach(dept => {
      departmentFailures[dept].employees = Array.from(departmentFailures[dept].employees);
      // Get top failure types
      departmentFailures[dept].topFailureTypes = Object.entries(departmentFailures[dept].commonFailureTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => ({ type, count }));
    });

    // Root cause analysis
    const rootCauses = {};
    tasks.forEach(t => {
      if (t.rootCause) {
        if (!rootCauses[t.rootCause]) {
          rootCauses[t.rootCause] = 0;
        }
        rootCauses[t.rootCause]++;
      }
    });

    // Trend analysis
    const failureTrend = {};
    failureTimeline.forEach(item => {
      if (!failureTrend[item.date]) {
        failureTrend[item.date] = {
          total: 0,
          byType: {},
          byDepartment: {}
        };
      }
      failureTrend[item.date].total++;
      
      if (!failureTrend[item.date].byType[item.failureType]) {
        failureTrend[item.date].byType[item.failureType] = 0;
      }
      failureTrend[item.date].byType[item.failureType]++;
      
      if (item.department) {
        if (!failureTrend[item.date].byDepartment[item.department]) {
          failureTrend[item.date].byDepartment[item.department] = 0;
        }
        failureTrend[item.date].byDepartment[item.department]++;
      }
    });

    return res.json({
      success: true,
      timeframe: `${timeframe} days`,
      department: department || 'all',
      summary: {
        totalTasks: tasks.length,
        totalFailures: tasks.filter(t => t.status === "failed").length,
        failureRate: tasks.length > 0 ? ((tasks.filter(t => t.status === "failed").length / tasks.length) * 100).toFixed(1) : 0,
        mostCommonFailureType: Object.entries(failureTypes)
          .sort((a, b) => b[1].count - a[1].count)[0]?.[0] || "None"
      },
      intelligence: {
        failureTypes,
        employeeFailures: Object.values(employeeFailures)
          .sort((a, b) => b.totalFailures - a.totalFailures),
        departmentFailures,
        rootCauses,
        trend: failureTrend,
        recommendations: generateFailureRecommendations(failureTypes, employeeFailures, departmentFailures)
      }
    });
  } catch (err) {
    console.error("Failure intelligence error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 ADMIN → ARCHIVE TASK (ENTERPRISE ARCHIVING)
===================================================== */
router.patch("/:id/archive", verifyJWT, requireCapability("manage_tasks"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { archiveNote, retentionPeriod, archiveCategory, confidentialLevel } = req.body;
    
    if (!archiveNote || archiveNote.trim().length < 5) {
      return res.status(400).json({
        error: "Archive note required (minimum 5 characters)"
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.status !== "verified" && task.status !== "failed") {
      return res.status(400).json({
        error: "Only verified or failed tasks can be archived"
      });
    }

    if (task.isArchived) {
      return res.status(400).json({
        error: "Task is already archived"
      });
    }

    task.isArchived = true;
    task.archivedAt = new Date();
    task.archivedBy = req.user.id;
    task.archiveNote = archiveNote.trim();
    task.retentionPeriod = retentionPeriod || "permanent";
    task.archiveCategory = archiveCategory || "completed_task";
    task.confidentialLevel = confidentialLevel || "internal";
    task.archivedVersion = task.workSubmission?.version || 1;
    
    task.activityTimeline.push({
      action: "TASK_ARCHIVED",
      performedBy: req.user.id,
      role: "admin",
      details: `Task archived. Category: ${task.archiveCategory}. Retention: ${task.retentionPeriod}. Note: ${archiveNote}`,
      timestamp: new Date()
    });

    await task.save();

    return res.json({
      success: true,
      message: "Task archived successfully with enterprise retention policy",
      archivedAt: task.archivedAt,
      archiveDetails: {
        note: task.archiveNote,
        category: task.archiveCategory,
        retentionPeriod: task.retentionPeriod,
        confidentialLevel: task.confidentialLevel
      },
      requiresAuditLog: true
    });
  } catch (err) {
    console.error("Archive task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 UNARCHIVE TASK (ENTERPRISE)
===================================================== */
router.patch("/:id/unarchive", verifyJWT, requireCapability("manage_tasks"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { unarchiveReason } = req.body;
    
    if (!unarchiveReason || unarchiveReason.trim().length < 5) {
      return res.status(400).json({
        error: "Unarchive reason required (minimum 5 characters)"
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (!task.isArchived) {
      return res.status(400).json({
        error: "Task is not archived"
      });
    }

    task.isArchived = false;
    task.unarchivedAt = new Date();
    task.unarchivedBy = req.user.id;
    task.unarchiveReason = unarchiveReason.trim();
    
    task.activityTimeline.push({
      action: "TASK_UNARCHIVED",
      performedBy: req.user.id,
      role: "admin",
      details: `Task unarchived. Reason: ${unarchiveReason}`,
      timestamp: new Date()
    });

    await task.save();

    return res.json({
      success: true,
      message: "Task unarchived successfully",
      unarchivedAt: task.unarchivedAt,
      unarchiveReason: task.unarchiveReason
    });
  } catch (err) {
    console.error("Unarchive task error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 GET ARCHIVED TASKS (ENTERPRISE)
===================================================== */
router.get("/archived", verifyJWT, requireCapability("manage_tasks"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { category, retentionPeriod, dateFrom, dateTo } = req.query;
    
    let filter = { isArchived: true };
    
    if (category && category !== 'all') filter.archiveCategory = category;
    if (retentionPeriod && retentionPeriod !== 'all') filter.retentionPeriod = retentionPeriod;
    
    if (dateFrom || dateTo) {
      filter.archivedAt = {};
      if (dateFrom) filter.archivedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.archivedAt.$lte = new Date(dateTo);
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email")
      .populate("archivedBy", "name email")
      .populate("unarchivedBy", "name email")
      .sort({ archivedAt: -1 });

    return res.json({
      success: true,
      tasks,
      count: tasks.length,
      filters: { category, retentionPeriod, dateFrom, dateTo },
      archiveStats: {
        totalArchived: tasks.length,
        byCategory: {},
        byRetentionPeriod: {}
      }
    });
  } catch (err) {
    console.error("Get archived tasks error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   🆕 TASK EXPORT (ENTERPRISE REPORTING)
===================================================== */
router.get("/export/report", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { format = "json", timeframe = "month", department } = req.query;
    
    let filter = {};
    const now = new Date();
    
    if (timeframe === "week") {
      filter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7) };
    } else if (timeframe === "month") {
      filter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    } else if (timeframe === "quarter") {
      const quarter = Math.floor(now.getMonth() / 3);
      filter.createdAt = { $gte: new Date(now.getFullYear(), quarter * 3, 1) };
    } else if (timeframe === "year") {
      filter.createdAt = { $gte: new Date(now.getFullYear(), 0, 1) };
    }
    
    if (department && department !== 'all') {
      filter.department = department;
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email department")
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    if (format === "csv") {
      // Generate CSV
      const csvData = tasks.map(task => ({
        ID: task._id,
        Title: task.title,
        Status: task.status,
        Priority: task.priority,
        Department: task.department,
        AssignedTo: task.assignedTo?.name || "Unassigned",
        CreatedBy: task.createdBy?.name || "System",
        CreatedAt: task.createdAt,
        DueDate: task.dueDate,
        CompletedAt: task.completedAt,
        VerifiedAt: task.reviewedAt,
        QualityScore: task.qualityScore || "N/A",
        FailureReason: task.failureReason || "N/A"
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=tasks-export-${new Date().toISOString().split('T')[0]}.csv`);
      
      // Simple CSV writer
      const csvHeaders = Object.keys(csvData[0] || {}).join(',');
      const csvRows = csvData.map(row => Object.values(row).map(val => 
        `"${String(val).replace(/"/g, '""')}"`
      ).join(','));
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      return res.send(csvContent);
    } else {
      // Return JSON
      return res.json({
        success: true,
        export: {
          format,
          timeframe,
          department: department || 'all',
          generatedAt: new Date(),
          totalTasks: tasks.length,
          tasks: tasks.map(t => ({
            id: t._id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            department: t.department,
            assignedTo: t.assignedTo?.name,
            createdBy: t.createdBy?.name,
            createdAt: t.createdAt,
            dueDate: t.dueDate,
            completedAt: t.completedAt,
            reviewedAt: t.reviewedAt,
            qualityScore: t.qualityScore,
            failureReason: t.failureReason,
            activityTimeline: t.activityTimeline?.length || 0
          }))
        }
      });
    }
  } catch (err) {
    console.error("Export tasks error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   HELPER FUNCTION: Generate failure recommendations
===================================================== */
function generateFailureRecommendations(failureTypes, employeeFailures, departmentFailures) {
  const recommendations = [];
  
  // Analyze failure types
  Object.entries(failureTypes).forEach(([type, data]) => {
    if (data.count > 5) { // Threshold for action
      recommendations.push({
        type: "failure_pattern",
        severity: "high",
        title: `High frequency of ${type} failures`,
        description: `${data.count} tasks failed due to ${type}`,
        suggestion: "Consider additional training or process improvements",
        affectedDepartments: data.departments,
        avgTimeToFailure: data.avgTimeToFailure
      });
    }
  });
  
  // Analyze employee patterns
  Object.values(employeeFailures).forEach(emp => {
    if (emp.totalFailures >= 3) { // Threshold for employee review
      recommendations.push({
        type: "employee_performance",
        severity: emp.totalFailures >= 5 ? "high" : "medium",
        title: `Performance review needed for ${emp.employee.name}`,
        description: `${emp.totalFailures} task failures in selected timeframe`,
        suggestion: "Schedule performance review and provide additional support",
        employee: emp.employee,
        commonFailureTypes: Object.entries(emp.failureTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
      });
    }
  });
  
  // Analyze department patterns
  Object.entries(departmentFailures).forEach(([dept, data]) => {
    if (data.totalFailures >= 10) { // Threshold for department review
      recommendations.push({
        type: "department_process",
        severity: "medium",
        title: `Process review needed for ${dept} department`,
        description: `${data.totalFailures} failures across ${data.employees.length} employees`,
        suggestion: "Review department processes and provide team training",
        department: dept,
        affectedEmployees: data.employees.length,
        topFailureTypes: data.topFailureTypes
      });
    }
  });
  
  return recommendations.sort((a, b) => {
    const severityOrder = { high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/* =====================================================
   DEBUG: Catch-all route to log unmatched requests
===================================================== */
router.use((req, res) => {
  console.log("❌ ENTERPRISE UNMATCHED REQUEST:", {
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  res.status(404).json({ 
    success: false,
    error: "Route not found", 
    path: req.path, 
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "GET / - View all tasks (admin only)",
      "GET /my - View own tasks (employee only)",
      "POST /create - Create task (admin only)",
      "GET /:id - Get task by ID",
      "GET /by-id/:id - Safe get task by ID",
      "PUT /:id/direct-edit - Direct edit task (admin only)",
      "DELETE /:id/direct-delete - Direct delete task (admin only)",
      "PATCH /:id/accept - Accept task (employee only)",
      "PATCH /:id/start - Start work (employee only)",
      "PATCH /:id/decline - Decline assignment (employee only)",
      "PATCH /:id/withdraw - Withdraw from task (employee only)",
      "PATCH /:id/complete - Submit work (employee only)",
      "PATCH /:id/verify - Verify task (admin only)",
      "PATCH /:id/fail - Fail task (admin only)",
      "PATCH /:id/reopen - Reopen task (admin only)",
      "PATCH /:id/reopen/viewed - Mark reopen request viewed (employee only)",
      "PATCH /:id/accept-reopen - Accept reopened task (employee only)",
      "PATCH /:id/decline-reopen - Decline reopened task (employee only)",
      "PATCH /:id/accept-reopen-decline - Accept reopen decline (admin only)",
      "POST /:id/request-modification - Request modification (admin only)",
      "PATCH /:id/modification-request/:requestId/viewed - Mark modification request viewed (employee only)",
      "POST /:id/employee-request-modification - Employee request modification",
      "GET /modification-requests/pending - Get pending modification requests",
      "PATCH /:id/modification-request/:requestId/respond - Respond to modification request",
      "POST /:id/modification-request/:requestId/message - Add message to modification request",
      "POST /:id/approve-employee-modification/:requestId - Approve employee modification",
      "POST /:id/reject-employee-modification/:requestId - Reject employee modification",
      "PATCH /:id/reassign - Reassign task (admin only)",
      "POST /:id/request-extension - Request extension (employee only)",
      "PATCH /:id/extension/:requestId - Approve/reject extension (admin only)",
      "PATCH /:id/extend-due - Extend due date (admin only)",
      "GET /:id/extensions - Get extension requests",
      "POST /:id/message - Add message to discussion",
      "GET /:id/messages - Get discussion messages",
      "POST /:id/message/:messageId/react - React to message",
      "GET /statistics/overview - Get task statistics",
      "GET /performance/:employeeId - Get employee performance",
      "GET /intelligence/failures - Get failure intelligence",
      "PATCH /:id/archive - Archive task (admin only)",
      "PATCH /:id/unarchive - Unarchive task (admin only)",
      "GET /archived - Get archived tasks",
      "GET /export/report - Export tasks report"
    ]
  });
});

export default router;
