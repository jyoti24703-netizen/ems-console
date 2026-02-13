import express from "express";
import { Meeting, MeetingTemplate } from "../models/Meeting.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { verifyJWT, requireCapability } from "../middleware/auth.js";
import { successPayload, errorPayload, STATUS_ENUMS } from "../utils/apiResponse.js";
import { sendEmail } from "../utils/emailService.js";
import { generateICal } from "../utils/calendarService.js";
import { uploadToS3 } from "../utils/fileUpload.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const meetingUploadDir = path.join(__dirname, "../../uploads/meetings");
if (!fs.existsSync(meetingUploadDir)) {
  fs.mkdirSync(meetingUploadDir, { recursive: true });
}

const meetingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, meetingUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const meetingUpload = multer({
  storage: meetingStorage,
  limits: { fileSize: Number(process.env.MEETING_UPLOAD_MAX_MB || 250) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/webm",
      "audio/ogg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];
    if (!file?.mimetype || allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
});

const meetingRecordingUpload = multer({
  storage: meetingStorage,
  limits: { fileSize: Number(process.env.MEETING_RECORDING_MAX_MB || 1024) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file?.mimetype || file.mimetype.startsWith("video/")) {
      cb(null, true);
      return;
    }
    cb(new Error(`Only video files are supported for meeting recordings. Received: ${file.mimetype}`));
  }
});

const hasMeetingAccess = (meeting, userId, role) => {
  if (role === "admin") return true;
  const isOrganizer = meeting.organizer?.toString() === userId;
  const isCoOrganizer = meeting.coOrganizers?.some(co => co.toString() === userId);
  const isAttendee = meeting.attendees?.some(a => a.employee.toString() === userId);
  return isOrganizer || isCoOrganizer || isAttendee;
};

const canManageMeeting = (meeting, userId, role) => {
  if (role === "admin") return true;
  const isOrganizer = meeting.organizer?.toString() === userId;
  const isCoOrganizer = meeting.coOrganizers?.some(co => co.toString() === userId);
  return isOrganizer || isCoOrganizer;
};

const isActionItemAssignedToUser = (item, user) => {
  const assignedId = item?.assignedTo?._id || item?.assignedTo;
  if (assignedId && assignedId.toString() === user.id) return true;
  if (item?.assignedTo?.email && user?.email && item.assignedTo.email === user.email) return true;
  return false;
};

/* =====================================================
   ADMIN → CREATE MEETING (Enhanced)
===================================================== */
router.post("/create", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    console.log(`📅 Meeting creation request from: ${req.user.email}`);
    
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const {
      title,
      description,
      agenda,
      meetingDate,
      meetingTime,
      duration,
      meetingLink,
      meetingPlatform = "google_meet",
      audience,
      isRecurring = false,
      recurrencePattern = "none",
      recurrenceEndDate,
      priority = "medium",
      tags = [],
      templateId,
      reminders = [],
      coOrganizers = [],
      notifyAttendees = true,
      sendCalendarInvites: sendCalendarInvitesFlag = true
    } = req.body;

    // Validation
    if (!title || !meetingDate || !meetingTime) {
      return res.status(400).json({
        error: "Title, date, and time are required"
      });
    }

    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}`);
    
    if (meetingDateTime < new Date()) {
      return res.status(400).json({
        error: "Meeting cannot be scheduled in the past"
      });
    }

    // Handle template if provided
    let templateData = {};
    if (templateId) {
      const template = await MeetingTemplate.findById(templateId);
      if (template) {
        templateData = {
          title: title || template.title,
          agenda: agenda || template.agenda,
          defaultDuration: duration || template.defaultDuration,
          defaultAttendees: template.defaultAttendees
        };
        template.usedCount += 1;
        template.lastUsed = new Date();
        await template.save();
      }
    }

    // Determine attendees
    let attendeesList = [];
    const audienceType = audience === "all" ? "all" : "selected";
    if (audience === "all") {
      const employeeFilter = {
        role: "employee",
        status: "active"
      };
      if (req.user.role !== "superadmin") {
        employeeFilter.$or = [
          { createdBy: req.user.id },
          { createdBy: { $exists: false } },
          { createdBy: null }
        ];
      }
      const allEmployees = await User.find(employeeFilter).select("_id");
      
      attendeesList = allEmployees.map(emp => ({
        employee: emp._id,
        rsvpStatus: "pending",
        attended: false
      }));
    } else if (Array.isArray(audience)) {
      if (audience.length === 0) {
        return res.status(400).json({ error: "Select at least one employee or choose all employees" });
      }
      // Validate employee IDs
      const validEmployeeFilter = {
        _id: { $in: audience },
        role: "employee",
        status: "active"
      };
      if (req.user.role !== "superadmin") {
        validEmployeeFilter.$or = [
          { createdBy: req.user.id },
          { createdBy: { $exists: false } },
          { createdBy: null }
        ];
      }
      const validEmployees = await User.find(validEmployeeFilter).select("_id");
      
      const validEmployeeIds = validEmployees.map(e => e._id.toString());
      
      attendeesList = validEmployeeIds.map(empId => ({
        employee: empId,
        rsvpStatus: "pending",
        attended: false
      }));
    } else {
      return res.status(400).json({ error: "Invalid audience format" });
    }

    // Add co-organizers as attendees with accepted RSVP
    const coOrganizerAttendees = coOrganizers.map(orgId => ({
      employee: orgId,
      rsvpStatus: "accepted",
      attended: false,
      isCoOrganizer: true
    }));
    
    attendeesList = [...attendeesList, ...coOrganizerAttendees];

    // Create meeting with enhanced data
    const meetingData = {
      title: title || templateData.title,
      description,
      agenda: agenda || templateData.agenda,
      meetingDateTime,
      duration: duration || templateData.defaultDuration || 60,
      meetingLink,
      meetingPlatform,
      organizer: req.user.id,
      coOrganizers,
      attendees: attendeesList,
      audienceType,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
      priority,
      tags,
      templateUsed: templateId || null,
      reminders: reminders.map(r => ({
        type: r.type || "email",
        minutesBefore: r.minutesBefore || 15,
        sent: false
      })),
      status: "scheduled",
      metadata: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        icalUid: `${Date.now()}-${Math.random().toString(36)}@yourdomain.com`
      }
    };

    const meeting = await Meeting.create(meetingData);
    console.log(`✅ Meeting created: ${meeting._id}`);

    // Send notifications
    if (notifyAttendees) {
      await sendMeetingNotifications(meeting, "created");
    }

    // Send calendar invites
    if (sendCalendarInvitesFlag) {
      await sendCalendarInvites(meeting);
    }

    // Populate and return
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("organizer", "name email avatar")
      .populate("coOrganizers", "name email avatar")
      .populate("attendees.employee", "name email avatar department position")
      .populate("templateUsed", "name description");

    return res.status(201).json({
      success: true,
      message: "Meeting scheduled successfully",
      meeting: populatedMeeting,
      calendarInvitesSent: sendCalendarInvitesFlag,
      notificationsSent: notifyAttendees
    });
  } catch (err) {
    console.error("Create meeting error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_CREATE_FAILED",
        details: process.env.NODE_ENV === "development" ? err.message : undefined
      })
    );
  }
});

/* =====================================================
   CREATE MEETING FROM TEMPLATE
===================================================== */
router.post("/create-from-template/:templateId", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { templateId } = req.params;
    const { meetingDate, meetingTime, customizations = {} } = req.body;

    const template = await MeetingTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Check if user has access to template
    if (!template.isPublic && template.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access to template denied" });
    }

    // Create meeting from template
    const meetingDateTime = new Date(`${meetingDate}T${meetingTime}`);
    
  const meetingData = {
      title: customizations.title || template.title,
      description: customizations.description || template.description,
      agenda: customizations.agenda || template.agenda,
      meetingDateTime,
      duration: customizations.duration || template.defaultDuration,
      meetingPlatform: customizations.meetingPlatform || "google_meet",
      organizer: req.user.id,
      attendees: template.defaultAttendees.map(empId => ({
        employee: empId,
        rsvpStatus: "pending",
        attended: false
      })),
      audienceType: "selected",
      isRecurring: customizations.isRecurring || template.isRecurring,
      recurrencePattern: customizations.recurrencePattern || template.recurrencePattern,
      tags: [...(template.defaultTags || []), ...(customizations.tags || [])],
      templateUsed: templateId,
      status: "scheduled"
    };

    const meeting = await Meeting.create(meetingData);

    // Update template usage stats
    template.usedCount += 1;
    template.lastUsed = new Date();
    await template.save();

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("organizer", "name email")
      .populate("attendees.employee", "name email")
      .populate("templateUsed", "name description");

    return res.status(201).json({
      success: true,
      message: "Meeting created from template successfully",
      meeting: populatedMeeting
    });
  } catch (err) {
    console.error("Create from template error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   SAVE MEETING AS TEMPLATE
===================================================== */
router.post("/:id/save-as-template", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { name, description, isPublic = false } = req.body;

    const meeting = await Meeting.findById(req.params.id)
      .populate("attendees.employee", "_id");
    
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check if user is organizer
    if (meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only organizer can save as template" });
    }

    const templateData = {
      name,
      description,
      title: meeting.title,
      agenda: meeting.agenda,
      defaultDuration: meeting.duration,
      defaultAttendees: meeting.attendees.map(a => a.employee._id),
      defaultTags: meeting.tags || [],
      recurrencePattern: meeting.recurrencePattern,
      createdBy: req.user.id,
      isPublic
    };

    const template = await MeetingTemplate.create(templateData);

    return res.status(201).json({
      success: true,
      message: "Meeting saved as template successfully",
      template
    });
  } catch (err) {
    console.error("Save as template error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET MEETING TEMPLATES
===================================================== */
router.get("/templates", verifyJWT, async (req, res) => {
  try {
    const query = { $or: [{ isPublic: true }, { createdBy: req.user.id }] };
    
    const templates = await MeetingTemplate.find(query)
      .populate("createdBy", "name email")
      .populate("defaultAttendees", "name email")
      .sort({ usedCount: -1, updatedAt: -1 });

    return res.json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (err) {
    console.error("Get templates error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   UPLOAD MEETING ATTACHMENT
===================================================== */
router.post("/:id/attachments", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check access
    const isOrganizer = meeting.organizer.toString() === req.user.id;
    const isCoOrganizer = meeting.coOrganizers.some(co => co.toString() === req.user.id);
    const isAttendee = meeting.attendees.some(a => a.employee.toString() === req.user.id);
    
    if (!isOrganizer && !isCoOrganizer && !isAttendee && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { file } = req.body; // Assuming file data from multer/upload middleware
    
    if (!file || !file.url) {
      return res.status(400).json({ error: "File data required" });
    }

    const attachment = {
      name: file.name || "Attachment",
      url: file.url,
      type: file.type || "file",
      size: file.size || 0,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    };

    meeting.attachments.push(attachment);
    await meeting.save();

    return res.json({
      success: true,
      message: "Attachment uploaded successfully",
      attachment
    });
  } catch (err) {
    console.error("Upload attachment error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ADD MESSAGE TO DISCUSSION (Enhanced)
===================================================== */
router.post("/:id/message", verifyJWT, async (req, res) => {
  try {
    const { text, attachments = [], parentMessage = null } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Message text required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check access
    const isOrganizer = meeting.organizer.toString() === req.user.id;
    const isCoOrganizer = meeting.coOrganizers.some(co => co.toString() === req.user.id);
    const isAttendee = meeting.attendees.some(a => a.employee.toString() === req.user.id);
    
    if (!isOrganizer && !isCoOrganizer && !isAttendee && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Get sender info
    const sender = await User.findById(req.user.id);
    
    // Parse mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      // In real implementation, you'd look up users by username
      // For now, we'll store the pattern
      mentions.push({
        userName: match[1]
      });
    }

    const message = {
      sender: req.user.id,
      senderName: sender.name,
      senderRole: req.user.role,
      text: text.trim(),
      attachments,
      mentions,
      parentMessage,
      createdAt: new Date()
    };

    meeting.discussion.push(message);
    meeting.analytics.totalMessages = (meeting.analytics.totalMessages || 0) + 1;
    await meeting.save();

    // Send notifications for mentions
    if (mentions.length > 0) {
      await sendMentionNotifications(meeting, message, mentions);
    }

    const populatedMessage = {
      ...message,
      sender: {
        _id: sender._id,
        name: sender.name,
        email: sender.email,
        avatar: sender.avatar,
        role: sender.role
      }
    };

    return res.json({
      success: true,
      message: "Message sent",
      discussion: populatedMessage
    });
  } catch (err) {
    console.error("Add message error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET MEETING ANALYTICS
===================================================== */
router.get("/:id/analytics", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("organizer", "name email")
      .populate("attendees.employee", "name email department")
      .populate("actionItems.assignedTo", "name email");

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check access
    if (req.user.role !== "admin" && meeting.organizer._id.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const analytics = {
      basic: {
        title: meeting.title,
        date: meeting.meetingDateTime,
        duration: meeting.duration,
        status: meeting.status,
        priority: meeting.priority
      },
      attendance: meeting.attendanceStats,
      engagement: meeting.engagementMetrics,
      actionItems: {
        total: meeting.actionItems.length,
        byStatus: {
          pending: meeting.actionItems.filter(i => i.status === "pending").length,
          in_progress: meeting.actionItems.filter(i => i.status === "in_progress").length,
          completed: meeting.actionItems.filter(i => i.status === "completed").length,
          blocked: meeting.actionItems.filter(i => i.status === "blocked").length
        },
        byPriority: {
          low: meeting.actionItems.filter(i => i.priority === "low").length,
          medium: meeting.actionItems.filter(i => i.priority === "medium").length,
          high: meeting.actionItems.filter(i => i.priority === "high").length,
          critical: meeting.actionItems.filter(i => i.priority === "critical").length
        },
        completionRate: meeting.actionItems.length > 0 
          ? (meeting.actionItems.filter(i => i.status === "completed").length / meeting.actionItems.length) * 100
          : 0
      },
      discussion: {
        totalMessages: meeting.discussion.length,
        uniqueParticipants: new Set(meeting.discussion.map(m => m.sender.toString())).size,
        messagesWithAttachments: meeting.discussion.filter(m => m.attachments && m.attachments.length > 0).length,
        averageResponseTime: calculateAverageResponseTime(meeting.discussion)
      },
      timing: {
        scheduledStart: meeting.meetingDateTime,
        actualStart: meeting.analytics.actualStartTime,
        actualEnd: meeting.analytics.actualEndTime,
        actualDuration: meeting.analytics.actualDuration,
        startDelay: meeting.analytics.actualStartTime 
          ? (meeting.analytics.actualStartTime - meeting.meetingDateTime) / (1000 * 60) // minutes
          : null
      },
      departmentBreakdown: getDepartmentBreakdown(meeting.attendees)
    };

    return res.json({
      success: true,
      analytics
    });
  } catch (err) {
    console.error("Get analytics error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET USER MEETING STATS
===================================================== */
router.get("/user/stats", verifyJWT, async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const stats = await Meeting.getUserMeetingStats(req.user.id, startDate, now);

    return res.json({
      success: true,
      stats,
      period
    });
  } catch (err) {
    console.error("Get user stats error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GENERATE MEETING REPORT
===================================================== */
router.get("/:id/report", verifyJWT, async (req, res) => {
  try {
    const { format = "json" } = req.query; // json, pdf, csv
    
    const meeting = await Meeting.findById(req.params.id)
      .populate("organizer", "name email")
      .populate("attendees.employee", "name email department position")
      .populate("actionItems.assignedTo", "name email")
      .populate("notes.addedBy", "name email");

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check access
    if (req.user.role !== "admin" && meeting.organizer._id.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const report = await Meeting.generateAttendanceReport(meeting._id);

    if (format === "pdf") {
      // Generate PDF report (you'd use a PDF library like pdfkit)
      // For now, return JSON
      return res.json({
        success: true,
        message: "PDF generation not implemented",
        report
      });
    } else if (format === "csv") {
      // Generate CSV
      const csv = generateCSVReport(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=meeting-${meeting._id}-report.csv`);
      return res.send(csv);
    }

    return res.json({
      success: true,
      report
    });
  } catch (err) {
    console.error("Generate report error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   SEND MEETING REMINDERS
===================================================== */
router.post("/:id/send-reminders", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const meeting = await Meeting.findById(req.params.id)
      .populate("attendees.employee", "name email");
    
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const { reminderType = "all" } = req.body; // upcoming, overdue, custom

    let remindersSent = 0;
    const now = new Date();
    const meetingTime = meeting.meetingDateTime;
    
    // Check which reminders to send
    meeting.reminders.forEach(async (reminder) => {
      if (!reminder.sent) {
        const reminderTime = new Date(meetingTime);
        reminderTime.setMinutes(reminderTime.getMinutes() - reminder.minutesBefore);
        
        if (now >= reminderTime) {
          // Send reminder
          await sendReminderNotification(meeting, reminder);
          reminder.sent = true;
          reminder.sentAt = new Date();
          remindersSent++;
        }
      }
    });

    await meeting.save();

    return res.json({
      success: true,
      message: `Sent ${remindersSent} reminders`,
      remindersSent
    });
  } catch (err) {
    console.error("Send reminders error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   SYNC WITH CALENDAR
===================================================== */
router.post("/:id/sync-calendar", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check access
    if (req.user.role !== "admin" && meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { calendarType = "google" } = req.body; // google, outlook, apple

    // Generate iCal event
    const iCalEvent = meeting.generateICalEvent();
    const iCalData = generateICal(iCalEvent);

    // In a real implementation, you would:
    // 1. Sync with Google Calendar API
    // 2. Sync with Outlook API
    // 3. Generate iCal file for download

    // For now, return iCal data
    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", `attachment; filename=meeting-${meeting._id}.ics`);
    
    return res.send(iCalData);
  } catch (err) {
    console.error("Sync calendar error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   MARK ATTENDANCE (Enhanced with timing)
===================================================== */
router.patch("/:id/attendance", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { attendance } = req.body;

    if (!Array.isArray(attendance)) {
      return res.status(400).json({ 
        error: "Attendance must be an array" 
      });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Governance rule: attendance can be edited only while meeting is in progress.
    if (meeting.status === "completed") {
      return res.status(400).json({ error: "Attendance is locked after meeting completion" });
    }
    if (meeting.status !== "in_progress") {
      return res.status(400).json({ error: "Attendance can only be marked when meeting is in progress" });
    }

    const activeEmployees = await User.find({
      role: "employee",
      status: { $ne: "inactive" }
    }).select("_id");

    const attendanceMap = new Map(
      attendance.map(record => [String(record.employeeId), record])
    );

    // Ensure every active employee has an attendance row for this meeting.
    activeEmployees.forEach(emp => {
      const empId = emp._id.toString();
      let attendee = meeting.attendees.find(att => att.employee.toString() === empId);
      if (!attendee) {
        meeting.attendees.push({
          employee: emp._id,
          rsvpStatus: "pending",
          attended: false
        });
        attendee = meeting.attendees[meeting.attendees.length - 1];
      }

      const record = attendanceMap.get(empId);
      attendee.attended = Boolean(record?.attended);

      // Optional late join support from UI.
      attendee.joinTime = record?.joinTime ? new Date(record.joinTime) : null;
      attendee.leaveTime = record?.leaveTime ? new Date(record.leaveTime) : null;

      if (attendee.joinTime && attendee.leaveTime) {
        attendee.durationPresent = (attendee.leaveTime - attendee.joinTime) / (1000 * 60);
      } else {
        attendee.durationPresent = undefined;
      }
    });

    await meeting.save();

    // Calculate peak attendance
    const peakAttendance = calculatePeakAttendance(meeting.attendees);
    meeting.analytics.peakAttendance = peakAttendance;
    await meeting.save();

    return res.json({
      success: true,
      message: "Attendance recorded",
      meeting,
      peakAttendance
    });
  } catch (err) {
    console.error("Mark attendance error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET SINGLE MEETING DETAILS
===================================================== */
router.get("/details/:id", verifyJWT, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("organizer", "name email avatar")
      .populate("coOrganizers", "name email avatar")
      .populate("attendees.employee", "name email avatar department position")
      .populate("notes.addedBy", "name email")
      .populate("actionItems.assignedTo", "name email")
      .populate("actionItems.submission.submittedBy", "name email")
      .populate("actionItems.submission.reviewedBy", "name email");

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!hasMeetingAccess(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const meetingJson = meeting.toObject();
    meetingJson.isExpired =
      meetingJson.status === "scheduled" && new Date(meetingJson.meetingDateTime) < new Date();
    if (!["admin", "superadmin"].includes(req.user.role)) {
      meetingJson.actionItems = (meetingJson.actionItems || []).filter(
        item => isActionItemAssignedToUser(item, req.user)
      );
    }

    return res.json({
      ...successPayload({
        req,
        data: { meeting: meetingJson },
        meta: { scope: "details", statusEnum: STATUS_ENUMS.meeting }
      }),
      meeting: meetingJson
    });
  } catch (err) {
    console.error("Get meeting details error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_DETAILS_FAILED"
      })
    );
  }
});

/* =====================================================
   UPDATE MEETING STATUS
===================================================== */
router.put("/:id", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status || !["scheduled", "in_progress", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid meeting status" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!canManageMeeting(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Only organizer/admin can update status" });
    }

    if (status === "in_progress") {
      const now = Date.now();
      const scheduledAt = new Date(meeting.meetingDateTime).getTime();
      if (now < scheduledAt) {
        return res.status(400).json({
          error: "Meeting cannot be started before scheduled time. Reschedule first to start earlier."
        });
      }
      await meeting.startMeeting();
    } else if (status === "completed") {
      await meeting.markComplete();
    } else if (status === "cancelled") {
      await meeting.cancel(req.body?.reason || "Cancelled", req.user.id);
    } else {
      meeting.status = "scheduled";
      await meeting.save();
    }

    const updated = await Meeting.findById(meeting._id)
      .populate("organizer", "name email avatar")
      .populate("coOrganizers", "name email avatar")
      .populate("attendees.employee", "name email avatar department position");

    return res.json({
      ...successPayload({
        req,
        message: "Meeting status updated",
        data: { meeting: updated },
        meta: { statusEnum: STATUS_ENUMS.meeting }
      }),
      // legacy shape
      message: "Meeting status updated",
      meeting: updated
    });
  } catch (err) {
    console.error("Update meeting status error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_STATUS_UPDATE_FAILED"
      })
    );
  }
});

/* =====================================================
   CANCEL MEETING (SOFT CANCEL)
===================================================== */
router.delete("/:id", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: "Cancellation reason is required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!canManageMeeting(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Only organizer/admin can cancel meeting" });
    }

    await meeting.cancel(reason.trim(), req.user.id);
    await sendMeetingNotifications(meeting, "cancelled");

    return res.json({
      ...successPayload({
        req,
        message: "Meeting cancelled",
        data: { meeting },
        meta: { statusEnum: STATUS_ENUMS.meeting }
      }),
      // legacy shape
      message: "Meeting cancelled",
      meeting
    });
  } catch (err) {
    console.error("Cancel meeting error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_CANCEL_FAILED"
      })
    );
  }
});

/* =====================================================
   ADD MEETING NOTE
===================================================== */
router.post("/:id/notes", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    const { content, isPrivate = false, tags = [] } = req.body || {};
    if (!content || content.trim().length < 2) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!canManageMeeting(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Only organizer/admin can add notes" });
    }

    meeting.notes.push({
      content: content.trim(),
      addedBy: req.user.id,
      isPrivate: Boolean(isPrivate),
      tags: Array.isArray(tags) ? tags : []
    });

    await meeting.save();

    const updated = await Meeting.findById(meeting._id)
      .populate("notes.addedBy", "name email");

    return res.json({
      success: true,
      message: "Note added",
      notes: updated.notes
    });
  } catch (err) {
    console.error("Add meeting note error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ADD ACTION ITEM
===================================================== */
router.post("/:id/action-items", verifyJWT, requireCapability("manage_meetings"), meetingUpload.single("resourceFile"), async (req, res) => {
  try {
    const {
      description,
      assignedTo,
      dueDate,
      priority = "medium",
      resourceType = "none",
      resourceLabel = "",
      resourceUrl = ""
    } = req.body || {};

    if (!description || description.trim().length < 3) {
      return res.status(400).json({ error: "Action item description is required" });
    }
    if (!assignedTo) {
      return res.status(400).json({ error: "Assignee is required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!canManageMeeting(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Only organizer/admin can add action items" });
    }

    const assignee = await User.findById(assignedTo);
    if (!assignee || assignee.status === "inactive" || assignee.role !== "employee") {
      return res.status(400).json({ error: "Assignee must be an active employee" });
    }
    const isAttendee = meeting.attendees.some(a => a.employee.toString() === assignedTo);
    if (!isAttendee) {
      meeting.attendees.push({
        employee: assignedTo,
        rsvpStatus: "accepted",
        attended: false
      });
    }

    const uploadedResource = req.file
      ? {
          fileName: req.file.originalname,
          fileUrl: `/uploads/meetings/${req.file.filename}`,
          mimeType: req.file.mimetype,
          size: req.file.size
        }
      : {};

    const actionItem = {
      description: description.trim(),
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority,
      status: "pending",
      resource: {
        type: resourceType,
        label: resourceLabel?.trim() || "",
        url: resourceUrl?.trim() || "",
        ...uploadedResource
      },
      submission: {
        status: "pending"
      }
    };

    meeting.actionItems.push(actionItem);
    await meeting.save();

    const savedItem = meeting.actionItems[meeting.actionItems.length - 1];
    const assignedByName = req.user.name || req.user.email || "Admin";
    await Notification.create({
      user: assignedTo,
      type: "action_item_assigned",
      title: `New action item in ${meeting.title}`,
      message: `${assignedByName} assigned: ${description.trim()}`,
      data: { meetingId: meeting._id, actionItemId: savedItem._id },
      sentVia: ["in_app"]
    });

    // Mirror notification for admin/organizer side for audit visibility.
    if (meeting.organizer?.toString() !== assignedTo.toString()) {
      await Notification.create({
        user: meeting.organizer,
        type: "action_item_assigned",
        title: `Action item assigned in ${meeting.title}`,
        message: `Assigned to employee: ${description.trim()}`,
        data: { meetingId: meeting._id, actionItemId: savedItem._id },
        sentVia: ["in_app"]
      });
    }

    const updated = await Meeting.findById(meeting._id)
      .populate("actionItems.assignedTo", "name email");

    return res.json({
      success: true,
      message: "Action item added",
      actionItems: updated.actionItems
    });
  } catch (err) {
    console.error("Add action item error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   EMPLOYEE SUBMIT ACTION ITEM RESULT
===================================================== */
router.patch("/:id/action-items/:actionItemId/submit", verifyJWT, meetingUpload.single("submissionFile"), async (req, res) => {
  try {
    const { text = "", url = "", fileName = "" } = req.body || {};
    const hasFile = Boolean(req.file);
    if (!text.trim() && !url.trim() && !hasFile) {
      return res.status(400).json({ error: "Provide submission text, URL, or file" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!hasMeetingAccess(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const actionItem = meeting.actionItems.id(req.params.actionItemId);
    if (!actionItem) {
      return res.status(404).json({ error: "Action item not found" });
    }

    const assignedToThisUser = actionItem.assignedTo.toString() === req.user.id;
    if (!assignedToThisUser && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only assigned employee can submit this action item" });
    }

    actionItem.submission = {
      ...(actionItem.submission || {}),
      status: "submitted",
      text: text.trim(),
      url: url.trim(),
      fileName: hasFile ? req.file.originalname : fileName.trim(),
      fileUrl: hasFile ? `/uploads/meetings/${req.file.filename}` : (actionItem.submission?.fileUrl || ""),
      mimeType: hasFile ? req.file.mimetype : (actionItem.submission?.mimeType || ""),
      size: hasFile ? req.file.size : (actionItem.submission?.size || 0),
      submittedAt: new Date(),
      submittedBy: req.user.id
    };
    actionItem.status = "completed";
    actionItem.completedAt = new Date();

    await meeting.save();

    const submittedByUser = await User.findById(req.user.id).select("name email");
    const submissionActor = submittedByUser?.name || submittedByUser?.email || "Employee";

    // Notify organizer and co-organizers that employee submitted action item.
    const notifyAdminUsers = [
      meeting.organizer?.toString(),
      ...(meeting.coOrganizers || []).map(id => id.toString())
    ].filter(Boolean);

    await Promise.all(
      notifyAdminUsers.map(uid => Notification.create({
        user: uid,
        type: "action_item_completed",
        title: `Action item submitted in ${meeting.title}`,
        message: `${submissionActor} submitted: ${actionItem.description}`,
        data: { meetingId: meeting._id, actionItemId: actionItem._id },
        sentVia: ["in_app"]
      }))
    );

    // Notify employee as acknowledgement too.
    await Notification.create({
      user: req.user.id,
      type: "action_item_completed",
      title: `Submission received for ${meeting.title}`,
      message: `Your action item submission was recorded.`,
      data: { meetingId: meeting._id, actionItemId: actionItem._id },
      sentVia: ["in_app"]
    });

    return res.json({
      success: true,
      message: "Action item submitted",
      actionItem
    });
  } catch (err) {
    console.error("Submit action item error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   UPLOAD MEETING RECORDING
===================================================== */
router.post(
  "/:id/recording",
  verifyJWT,
  requireCapability("manage_meetings"),
  (req, res, next) => {
    meetingRecordingUpload.single("recordingFile")(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        const maxMb = Number(process.env.MEETING_RECORDING_MAX_MB || 1024);
        return res.status(400).json({
          success: false,
          error: `Video is too large. Max allowed size is ${maxMb}MB`
        });
      }
      return res.status(400).json({ success: false, error: err.message || "Invalid recording upload" });
    });
  },
  async (req, res) => {
  try {
    const { url, type = "video", duration = 0, visibility = "attendees_only" } = req.body || {};
    const recordingUrl = req.file ? `/uploads/meetings/${req.file.filename}` : (url || "").trim();
    if (!recordingUrl) {
      return res.status(400).json({ error: "Recording file or URL is required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!canManageMeeting(meeting, req.user.id, req.user.role)) {
      return res.status(403).json({ error: "Only organizer/admin can upload recordings" });
    }

    // Governance: meeting recording must be video only.
    if (req.file && !req.file.mimetype?.startsWith("video/")) {
      return res.status(400).json({ error: "Only video files are allowed for meeting recordings" });
    }
    if (!req.file && type && type !== "video") {
      return res.status(400).json({ error: "Recording type must be video" });
    }
    if (!req.file) {
      const isAudioUrl = /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(recordingUrl);
      if (isAudioUrl) {
        return res.status(400).json({ error: "Audio-only recording URL is not allowed. Upload a video URL or file." });
      }
    }

    const resolvedFileName = req.file?.originalname
      || path.basename(new URL(recordingUrl, "http://localhost").pathname)
      || "meeting-recording.mp4";

    meeting.recording = {
      url: recordingUrl,
      type: "video",
      fileName: resolvedFileName,
      duration: Number(duration) || 0,
      visibility,
      size: req.file?.size || undefined,
      mimeType: req.file?.mimetype || undefined,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    };

    await meeting.save();

    return res.json({
      success: true,
      message: "Recording uploaded",
      recording: meeting.recording
    });
  } catch (err) {
    console.error("Upload recording error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET DEPARTMENT MEETING ANALYTICS
===================================================== */
router.get("/analytics/department", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { startDate, endDate, department } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    // Get all meetings in date range
    const meetings = await Meeting.find({
      meetingDateTime: { $gte: start, $lte: end },
      status: { $in: ["completed", "in_progress"] }
    })
    .populate("attendees.employee", "name email department")
    .populate("organizer", "name email department");

    // Filter by department if specified
    let filteredMeetings = meetings;
    if (department) {
      filteredMeetings = meetings.filter(meeting => {
        // Check if organizer or any attendee is from the department
        const organizerDept = meeting.organizer?.department;
        const attendeeDepts = meeting.attendees
          .map(a => a.employee?.department)
          .filter(Boolean);
        
        return organizerDept === department || attendeeDepts.includes(department);
      });
    }

    // Calculate department analytics
    const analytics = calculateDepartmentAnalytics(filteredMeetings);

    return res.json({
      success: true,
      analytics,
      period: { start, end },
      department: department || "all",
      totalMeetings: filteredMeetings.length
    });
  } catch (err) {
    console.error("Department analytics error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function sendMeetingNotifications(meeting, eventType) {
  try {
    const attendees = await User.find({
      _id: { $in: meeting.attendees.map(a => a.employee) }
    });

    const organizer = await User.findById(meeting.organizer);

    attendees.forEach(async (attendee) => {
      let subject, message;
      
      switch (eventType) {
        case "created":
          subject = `New Meeting: ${meeting.title}`;
          message = `You have been invited to a meeting: ${meeting.title} on ${meeting.meetingDateTime}`;
          break;
        case "updated":
          subject = `Meeting Updated: ${meeting.title}`;
          message = `A meeting you're attending has been updated: ${meeting.title}`;
          break;
        case "cancelled":
          subject = `Meeting Cancelled: ${meeting.title}`;
          message = `The meeting "${meeting.title}" has been cancelled.`;
          break;
        case "reminder":
          subject = `Meeting Reminder: ${meeting.title}`;
          message = `Reminder: You have a meeting in 15 minutes: ${meeting.title}`;
          break;
      }

      // Send email
      await sendEmail({
        to: attendee.email,
        subject,
        text: message,
        html: `<p>${message}</p><p>Date: ${meeting.meetingDateTime}</p><p>Link: ${meeting.meetingLink}</p>`
      });

      // Create in-app notification
      await Notification.create({
        user: attendee._id,
        type: `meeting_${eventType}`,
        title: subject,
        message,
        data: { meetingId: meeting._id },
        sentVia: ["email", "in_app"]
      });
    });

    console.log(`Notifications sent for meeting ${meeting._id}, event: ${eventType}`);
  } catch (err) {
    console.error("Error sending notifications:", err);
  }
}

async function sendCalendarInvites(meeting) {
  try {
    const attendees = await User.find({
      _id: { $in: meeting.attendees.map(a => a.employee) }
    }).select("email");

    const icalEvent = meeting.generateICalEvent();
    const icalData = generateICal(icalEvent);

    // Send iCal invites via email
    attendees.forEach(async (attendee) => {
      await sendEmail({
        to: attendee.email,
        subject: `Calendar Invite: ${meeting.title}`,
        text: `You have been invited to a meeting. Please see the attached calendar invite.`,
        icalEvent: icalData
      });
    });

    console.log(`Calendar invites sent for meeting ${meeting._id}`);
  } catch (err) {
    console.error("Error sending calendar invites:", err);
  }
}

async function sendMentionNotifications(meeting, message, mentions) {
  // Implementation for sending mention notifications
  // This would look up users by username and send notifications
  console.log(`Mentions in message: ${mentions.map(m => m.userName).join(", ")}`);
}

function calculateAverageResponseTime(messages) {
  if (messages.length < 2) return null;
  
  let totalGap = 0;
  let count = 0;
  
  // Sort messages by time
  const sortedMessages = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  for (let i = 1; i < sortedMessages.length; i++) {
    const gap = new Date(sortedMessages[i].createdAt) - new Date(sortedMessages[i - 1].createdAt);
    totalGap += gap;
    count++;
  }
  
  return count > 0 ? totalGap / count / (1000 * 60) : null; // Return in minutes
}

function calculatePeakAttendance(attendees) {
  // Simple implementation - count attendees who attended
  return attendees.filter(a => a.attended).length;
}

function getDepartmentBreakdown(attendees) {
  const breakdown = {};
  
  attendees.forEach(attendee => {
    const dept = attendee.employee?.department || "Unknown";
    breakdown[dept] = (breakdown[dept] || 0) + 1;
  });
  
  return breakdown;
}

function generateCSVReport(report) {
  let csv = "Meeting Attendance Report\n\n";
  csv += `Meeting: ${report.meeting.title}\n`;
  csv += `Date: ${report.meeting.date}\n`;
  csv += `Organizer: ${report.meeting.organizer.name} (${report.meeting.organizer.email})\n\n`;
  
  csv += "Attendee,Email,Department,Position,RSVP Status,Attended,Join Time,Leave Time,Duration Present (min),Punctuality (min)\n";
  
  report.attendees.forEach(attendee => {
    csv += `"${attendee.employee.name}","${attendee.employee.email}","${attendee.employee.department || ''}","${attendee.employee.position || ''}",`;
    csv += `${attendee.rsvpStatus},${attendee.attended ? "Yes" : "No"},`;
    csv += `${attendee.joinTime || ''},${attendee.leaveTime || ''},`;
    csv += `${attendee.durationPresent || ''},${attendee.punctuality || ''}\n`;
  });
  
  return csv;
}

function calculateDepartmentAnalytics(meetings) {
  const analytics = {
    totalMeetings: meetings.length,
    totalDuration: meetings.reduce((sum, m) => sum + (m.analytics.actualDuration || m.duration), 0),
    averageAttendance: 0,
    departments: {}
  };
  
  // Calculate per-department stats
  meetings.forEach(meeting => {
    const organizerDept = meeting.organizer?.department || "Unknown";
    
    if (!analytics.departments[organizerDept]) {
      analytics.departments[organizerDept] = {
        meetingsOrganized: 0,
        totalAttendance: 0,
        averageDuration: 0
      };
    }
    
    analytics.departments[organizerDept].meetingsOrganized++;
    
    // Count attendees from each department
    meeting.attendees.forEach(attendee => {
      const dept = attendee.employee?.department || "Unknown";
      if (!analytics.departments[dept]) {
        analytics.departments[dept] = {
          meetingsAttended: 0,
          totalAttendance: 0,
          averageDuration: 0
        };
      }
      
      if (!analytics.departments[dept].meetingsAttended) {
        analytics.departments[dept].meetingsAttended = 0;
      }
      
      analytics.departments[dept].meetingsAttended++;
    });
  });
  
  // Calculate averages
  Object.keys(analytics.departments).forEach(dept => {
    const deptStats = analytics.departments[dept];
    if (deptStats.meetingsOrganized > 0) {
      deptStats.averageDuration = deptStats.totalDuration / deptStats.meetingsOrganized;
    }
  });
  
  analytics.averageAttendance = analytics.totalMeetings > 0 
    ? Object.values(analytics.departments).reduce((sum, dept) => sum + (dept.totalAttendance || 0), 0) / analytics.totalMeetings
    : 0;
  
  return analytics;
}

// =====================================================
// KEEP ALL YOUR EXISTING ROUTES BELOW
// =====================================================

/* =====================================================
   GET DISCUSSION (Keep existing)
===================================================== */
router.get("/:id/discussion", verifyJWT, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate("discussion.sender", "name email avatar role");

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const isOrganizer = meeting.organizer.toString() === req.user.id;
    const isCoOrganizer = meeting.coOrganizers.some(co => co.toString() === req.user.id);
    const isAttendee = meeting.attendees.some(a => a.employee.toString() === req.user.id);

    if (!isOrganizer && !isCoOrganizer && !isAttendee && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      success: true,
      discussion: meeting.discussion || []
    });
  } catch (err) {
    console.error("Get meeting discussion error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   ADMIN → RESCHEDULE MEETING
===================================================== */
router.patch("/:id/reschedule", verifyJWT, requireCapability("manage_meetings"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { newDate, newTime, reason } = req.body || {};
    if (!newDate || !newTime) {
      return res.status(400).json({ error: "New date and time are required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (meeting.status === "completed") {
      return res.status(400).json({ error: "Completed meetings cannot be rescheduled" });
    }

    const newDateTime = new Date(`${newDate}T${newTime}`);
    if (isNaN(newDateTime.getTime())) {
      return res.status(400).json({ error: "Invalid date/time" });
    }

    if (newDateTime < new Date()) {
      return res.status(400).json({ error: "Meeting cannot be rescheduled in the past" });
    }

    await meeting.reschedule(newDateTime, reason || "", req.user.id);
    meeting.status = "scheduled";
    meeting.analytics.scheduledStartTime = newDateTime;
    await meeting.save();

    await sendMeetingNotifications(meeting, "updated");

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("organizer", "name email avatar")
      .populate("coOrganizers", "name email avatar")
      .populate("attendees.employee", "name email avatar department position");

    return res.json({
      success: true,
      message: "Meeting rescheduled",
      meeting: populatedMeeting
    });
  } catch (err) {
    console.error("Reschedule meeting error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =====================================================
   GET UPCOMING MEETINGS
===================================================== */
router.get("/upcoming", verifyJWT, async (req, res) => {
  try {
    const now = new Date();
    const baseQuery = {
      $or: [
        { status: "scheduled", meetingDateTime: { $gte: now } },
        { status: "in_progress" }
      ]
    };

    // Non-admins only see their meetings
    if (req.user.role !== "admin") {
      const orClause = [
        { organizer: req.user.id },
        { coOrganizers: req.user.id },
        { "attendees.employee": req.user.id }
      ];

      let meetings = await Meeting.find({ $and: [baseQuery, { $or: orClause }] })
        .populate("organizer", "name email avatar")
        .populate("coOrganizers", "name email avatar")
        .populate("attendees.employee", "name email avatar department position")
        .populate("actionItems.assignedTo", "name email")
        .populate("actionItems.submission.submittedBy", "name email")
        .sort({ meetingDateTime: 1 });

      const sanitizedMeetings = meetings.map(meeting => {
        const data = meeting.toObject();
        data.actionItems = (data.actionItems || []).filter(
          item => isActionItemAssignedToUser(item, req.user)
        );
        data.isExpired = false;
        return data;
      });

      return res.json({
        ...successPayload({
          req,
          data: { meetings: sanitizedMeetings },
          meta: { count: sanitizedMeetings.length, scope: "upcoming", statusEnum: STATUS_ENUMS.meeting }
        }),
        meetings: sanitizedMeetings
      });
    }

    const adminQuery = req.user.role === "superadmin"
      ? baseQuery
      : { $and: [baseQuery, { organizer: req.user.id }] };

    const meetings = await Meeting.find(adminQuery)
      .populate("organizer", "name email avatar")
      .populate("coOrganizers", "name email avatar")
      .populate("attendees.employee", "name email avatar department position")
      .populate("actionItems.assignedTo", "name email")
      .populate("actionItems.submission.submittedBy", "name email")
      .sort({ meetingDateTime: 1 });

    const normalizedMeetings = meetings.map(m => {
      const data = m.toObject();
      data.isExpired = false;
      return data;
    });
    return res.json({
      ...successPayload({
        req,
        data: { meetings: normalizedMeetings },
        meta: { count: normalizedMeetings.length, scope: "upcoming", statusEnum: STATUS_ENUMS.meeting }
      }),
      meetings: normalizedMeetings
    });
  } catch (err) {
    console.error("Fetch upcoming meetings error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_UPCOMING_FETCH_FAILED"
      })
    );
  }
});

/* =====================================================
   GET PAST MEETINGS
===================================================== */
router.get("/past", verifyJWT, async (req, res) => {
  try {
    const now = new Date();
    const baseQuery = {
      $or: [
        { status: { $in: ["completed", "cancelled"] } },
        { status: "scheduled", meetingDateTime: { $lt: now } }
      ]
    };

    // Non-admins only see their meetings
    if (req.user.role !== "admin") {
      const orClause = [
        { organizer: req.user.id },
        { coOrganizers: req.user.id },
        { "attendees.employee": req.user.id }
      ];

      let meetings = await Meeting.find({ $and: [baseQuery, { $or: orClause }] })
        .populate("organizer", "name email avatar")
        .populate("coOrganizers", "name email avatar")
        .populate("attendees.employee", "name email avatar department position")
        .populate("actionItems.assignedTo", "name email")
        .populate("actionItems.submission.submittedBy", "name email")
        .sort({ meetingDateTime: -1 });

      const sanitizedMeetings = meetings.map(meeting => {
        const data = meeting.toObject();
        data.actionItems = (data.actionItems || []).filter(
          item => isActionItemAssignedToUser(item, req.user)
        );
        data.isExpired = data.status === "scheduled" && new Date(data.meetingDateTime) < now;
        return data;
      });

      return res.json({
        ...successPayload({
          req,
          data: { meetings: sanitizedMeetings },
          meta: { count: sanitizedMeetings.length, scope: "past", statusEnum: STATUS_ENUMS.meeting }
        }),
        meetings: sanitizedMeetings
      });
    }

    const adminQuery = req.user.role === "superadmin"
      ? baseQuery
      : { $and: [baseQuery, { organizer: req.user.id }] };

    const meetings = await Meeting.find(adminQuery)
      .populate("organizer", "name email avatar")
      .populate("coOrganizers", "name email avatar")
      .populate("attendees.employee", "name email avatar department position")
      .populate("actionItems.assignedTo", "name email")
      .populate("actionItems.submission.submittedBy", "name email")
      .sort({ meetingDateTime: -1 });

    const normalizedMeetings = meetings.map(m => {
      const data = m.toObject();
      data.isExpired = data.status === "scheduled" && new Date(data.meetingDateTime) < now;
      return data;
    });
    return res.json({
      ...successPayload({
        req,
        data: { meetings: normalizedMeetings },
        meta: { count: normalizedMeetings.length, scope: "past", statusEnum: STATUS_ENUMS.meeting }
      }),
      meetings: normalizedMeetings
    });
  } catch (err) {
    console.error("Fetch past meetings error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_PAST_FETCH_FAILED"
      })
    );
  }
  });

/* =====================================================
   EMPLOYEE RSVP TO MEETING
===================================================== */
router.patch("/:id/rsvp", verifyJWT, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status || !["accepted", "declined", "tentative"].includes(status)) {
      return res.status(400).json({ error: "Invalid RSVP status" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const attendee = meeting.attendees.find(
      a => a.employee.toString() === req.user.id
    );

    if (!attendee) {
      return res.status(403).json({ error: "You are not an attendee of this meeting" });
    }

    attendee.rsvpStatus = status;
    attendee.rsvpAt = new Date();

    await meeting.save();

    return res.json({
      ...successPayload({
        req,
        message: "RSVP updated",
        data: {
          rsvpStatus: attendee.rsvpStatus,
          rsvpAt: attendee.rsvpAt
        },
        meta: { statusEnum: STATUS_ENUMS.meeting }
      }),
      // legacy shape
      message: "RSVP updated",
      rsvpStatus: attendee.rsvpStatus,
      rsvpAt: attendee.rsvpAt
    });
  } catch (err) {
    console.error("RSVP update error:", err);
    return res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "MEETING_RSVP_UPDATE_FAILED"
      })
    );
  }
});

// ... KEEP ALL YOUR OTHER EXISTING ROUTES

export default router;

