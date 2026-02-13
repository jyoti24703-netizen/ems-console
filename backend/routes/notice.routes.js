import express from "express";
import mongoose from "mongoose";
import { verifyJWT, requireCapability } from "../middleware/auth.js";
import { successPayload, errorPayload, STATUS_ENUMS } from "../utils/apiResponse.js";

const router = express.Router();

import Notice from "../models/Notice.js";

/* =======================
   SEND NOTICE (Admin only) - WITH DISCUSSION SUPPORT
======================= */
router.post("/send", verifyJWT, requireCapability("manage_notices"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json(
        errorPayload({ req, error: "Admin only", code: "NOTICE_ADMIN_ONLY" })
      );
    }
    
    const { 
      title, 
      content,
      targetType, 
      targetDepartment, 
      targetRole, 
      specificUsers,
      priority, 
      category,
      requiresAcknowledgement,
      allowResponse,
      actionRequired,
      actionDeadline,
      actionLink,
      attachments,
      expiresAt,
      sendAt
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json(
        errorPayload({ req, error: "Title and content are required", code: "NOTICE_VALIDATION_FAILED" })
      );
    }
    
    // Get recipients based on target type
    let recipientIds = [];
    const User = mongoose.model("User");
    
    if (targetType === "all") {
      const employees = await User.find({ role: "employee", status: "active" });
      recipientIds = employees.map(emp => emp._id);
    } else if (targetType === "role" && targetRole) {
      const users = await User.find({ role: targetRole, status: "active" });
      recipientIds = users.map(user => user._id);
    } else if (targetType === "specific" && specificUsers && specificUsers.length > 0) {
      recipientIds = specificUsers;
    } else if (targetType === "department" && targetDepartment) {
      const users = await User.find({ 
        role: "employee", 
        status: "active",
        department: targetDepartment 
      });
      recipientIds = users.map(user => user._id);
    }
    
    if (recipientIds.length === 0) {
      return res.status(400).json(
        errorPayload({ req, error: "No recipients found for the specified target", code: "NOTICE_RECIPIENTS_EMPTY" })
      );
    }
    
    const noticeData = {
      title,
      content,
      sender: req.user.id,
      senderName: req.user.name,
      senderEmail: req.user.email,
      createdBy: req.user.id,
      targetType,
      priority: priority || "medium",
      category: category || "general",
      requiresAcknowledgement: requiresAcknowledgement || false,
      allowResponse: allowResponse || false,
      actionRequired: actionRequired || false,
      attachments: attachments || [],
      status: "sent",
      totalRecipients: recipientIds.length,
      sentCount: recipientIds.length,
      discussion: []
    };
    
    if (targetDepartment) noticeData.targetDepartment = targetDepartment;
    if (targetRole) noticeData.targetRole = targetRole;
    if (specificUsers) noticeData.specificUsers = specificUsers;
    if (actionDeadline) noticeData.actionDeadline = new Date(actionDeadline);
    if (actionLink) noticeData.actionLink = actionLink;
    if (expiresAt) noticeData.expiresAt = new Date(expiresAt);
    if (sendAt) {
      noticeData.sendAt = new Date(sendAt);
      noticeData.status = "scheduled";
    }
    
    noticeData.recipients = recipientIds.map(userId => ({
      user: userId,
      read: false,
      acknowledged: false
    }));
    
    const notice = await Notice.create(noticeData);
    
    const noticeSummary = {
      id: notice._id,
      title: notice.title,
      recipients: notice.recipients.length,
      status: notice.status,
      sentAt: notice.sendAt
    };
    res.status(201).json({
      ...successPayload({
        req,
        message: `Notice sent to ${recipientIds.length} recipient(s)`,
        data: { notice: noticeSummary },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      message: `Notice sent to ${recipientIds.length} recipient(s)`,
      notice: noticeSummary
    });
  } catch (err) {
    console.error("Send notice error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_SEND_FAILED"
      })
    );
  }
});

/* =======================
   NEW: ADD MESSAGE TO NOTICE DISCUSSION
======================= */
router.post("/:noticeId/message", verifyJWT, async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json(
        errorPayload({ req, error: "Message text is required", code: "NOTICE_MESSAGE_REQUIRED" })
      );
    }
    
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }
    
    // Check if user is recipient or admin
    const isRecipient = notice.recipients.some(r => r.user.toString() === req.user.id);
    const isAdmin = req.user.role === "admin";
    
    if (!isRecipient && !isAdmin) {
      return res.status(403).json(
        errorPayload({ req, error: "You are not authorized to comment on this notice", code: "NOTICE_ACCESS_DENIED" })
      );
    }
    
    if (!notice.discussion) {
      notice.discussion = [];
    }
    
    const message = {
      sender: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      text: text.trim(),
      createdAt: new Date()
    };
    
    notice.discussion.push(message);
    await notice.save();
    
    res.json({
      ...successPayload({
        req,
        message: "Message added to discussion",
        data: { discussion: notice.discussion },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      message: "Message added to discussion",
      discussion: notice.discussion
    });
  } catch (err) {
    console.error("Add notice message error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_DISCUSSION_POST_FAILED"
      })
    );
  }
});

/* =======================
   NEW: GET NOTICE DISCUSSION
======================= */
router.get("/:noticeId/discussion", verifyJWT, async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    const notice = await Notice.findById(noticeId)
      .populate("discussion.sender", "name email role");
    
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }
    
    // Check if user is recipient or admin
    const isRecipient = notice.recipients.some(r => r.user.toString() === req.user.id);
    const isAdmin = req.user.role === "admin";
    
    if (!isRecipient && !isAdmin) {
      return res.status(403).json(
        errorPayload({ req, error: "Access denied", code: "NOTICE_ACCESS_DENIED" })
      );
    }
    
    const discussion = notice.discussion || [];
    const count = discussion.length;
    res.json({
      ...successPayload({
        req,
        data: { discussion, count },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      discussion,
      count
    });
  } catch (err) {
    console.error("Get notice discussion error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_DISCUSSION_FETCH_FAILED"
      })
    );
  }
});

/* =======================
   GET ALL NOTICES (Admin view)
======================= */
router.get("/", verifyJWT, requireCapability("manage_notices"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json(
        errorPayload({ req, error: "Admin only", code: "NOTICE_ADMIN_ONLY" })
      );
    }
    
    const { page = 1, limit = 20, status, category, includeExpired } = req.query;
    const now = new Date();
    
    let query = {};
    if (req.user.role !== "superadmin") {
      query.createdBy = req.user.id;
    }
    
    if (status) query.status = status;
    if (category) query.category = category;

    if (includeExpired !== "true" && status !== "expired") {
      query.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } }
      ];
      if (!status) {
        query.status = { $nin: ["expired", "deleted"] };
      }
    }
    
    const notices = await Notice.find(query)
      .populate("sender", "name email")
      .populate("recipients.user", "name email role")
      .populate("discussion.sender", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const totalNotices = await Notice.countDocuments(query);
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalNotices,
      pages: Math.ceil(totalNotices / limit)
    };
    res.json({
      ...successPayload({
        req,
        data: { notices },
        meta: { pagination, statusEnum: STATUS_ENUMS.notice }
      }),
      notices,
      pagination
    });
  } catch (err) {
    console.error("Get notices error:", err);
    res.status(500).json(
      errorPayload({ req, error: "Server error", code: "NOTICE_FETCH_FAILED" })
    );
  }
});

/* =======================
   GET MY NOTICES (Employee view)
======================= */
router.get("/my", verifyJWT, async (req, res) => {
  try {
    const { unread = false, page = 1, limit = 20 } = req.query;
    const now = new Date();
    
    let query = {
      "recipients.user": req.user.id,
      status: { $in: ["sent", "scheduled"] }
    };

    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: now } }
    ];
    
    if (unread === "true") {
      query["recipients.read"] = false;
    }
    
    const notices = await Notice.find(query)
      .populate("sender", "name email")
      .populate("discussion.sender", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const filteredNotices = notices.map(notice => {
      const recipientData = notice.recipients.find(r => 
        r.user && r.user.toString() === req.user.id
      );
      
      return {
        id: notice._id,
        title: notice.title,
        content: notice.content,
        sender: notice.sender,
        priority: notice.priority,
        category: notice.category,
        sendAt: notice.sendAt,
        expiresAt: notice.expiresAt,
        attachments: notice.attachments,
        requiresAcknowledgement: notice.requiresAcknowledgement,
        allowResponse: notice.allowResponse,
        actionRequired: notice.actionRequired,
        actionDeadline: notice.actionDeadline,
        actionLink: notice.actionLink,
        discussion: notice.discussion || [],
        discussionCount: notice.discussion?.length || 0,
        read: recipientData?.read || false,
        readAt: recipientData?.readAt,
        acknowledged: recipientData?.acknowledged || false,
        acknowledgedAt: recipientData?.acknowledgedAt,
        response: recipientData?.response,
        respondedAt: recipientData?.respondedAt
      };
    });
    
    const totalNotices = await Notice.countDocuments(query);
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalNotices,
      pages: Math.ceil(totalNotices / limit)
    };
    res.json({
      ...successPayload({
        req,
        data: { notices: filteredNotices },
        meta: { pagination, statusEnum: STATUS_ENUMS.notice }
      }),
      notices: filteredNotices,
      pagination
    });
  } catch (err) {
    console.error("Get my notices error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_MY_FETCH_FAILED"
      })
    );
  }
});

/* =======================
   GET UNREAD NOTICES COUNT
======================= */
router.get("/unread/count", verifyJWT, async (req, res) => {
  try {
    const count = await Notice.countDocuments({
      "recipients.user": req.user.id,
      "recipients.read": false,
      status: { $in: ["sent", "scheduled"] },
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });
    
    const timestamp = new Date().toISOString();
    res.json({
      ...successPayload({
        req,
        data: { count, timestamp },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      count,
      timestamp
    });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_UNREAD_COUNT_FAILED"
      })
    );
  }
});

/* =======================
   MARK NOTICE AS READ
======================= */
router.patch("/:noticeId/read", verifyJWT, async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }
    
    const recipientIndex = notice.recipients.findIndex(r => 
      r.user && r.user.toString() === req.user.id
    );
    
    if (recipientIndex === -1) {
      return res.status(403).json(
        errorPayload({ req, error: "You are not a recipient of this notice", code: "NOTICE_RECIPIENT_REQUIRED" })
      );
    }
    
    if (!notice.recipients[recipientIndex].read) {
      notice.recipients[recipientIndex].read = true;
      notice.recipients[recipientIndex].readAt = new Date();
      notice.readCount = (notice.readCount || 0) + 1;
      
      await notice.save();
    }
    
    const readAt = new Date();
    res.json({
      ...successPayload({
        req,
        message: "Notice marked as read",
        data: { readAt },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      message: "Notice marked as read",
      readAt
    });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_MARK_READ_FAILED"
      })
    );
  }
});

/* =======================
   ACKNOWLEDGE NOTICE
======================= */
router.patch("/:noticeId/acknowledge", verifyJWT, async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { response } = req.body;
    
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }
    
    if (!notice.requiresAcknowledgement) {
      return res.status(400).json(
        errorPayload({ req, error: "This notice does not require acknowledgement", code: "NOTICE_ACK_NOT_REQUIRED" })
      );
    }
    
    const recipientIndex = notice.recipients.findIndex(r => 
      r.user && r.user.toString() === req.user.id
    );
    
    if (recipientIndex === -1) {
      return res.status(403).json(
        errorPayload({ req, error: "You are not a recipient of this notice", code: "NOTICE_RECIPIENT_REQUIRED" })
      );
    }
    
    notice.recipients[recipientIndex].acknowledged = true;
    notice.recipients[recipientIndex].acknowledgedAt = new Date();
    
    if (response && notice.allowResponse) {
      notice.recipients[recipientIndex].response = response;
      notice.recipients[recipientIndex].respondedAt = new Date();
    }
    
    notice.acknowledgedCount = (notice.acknowledgedCount || 0) + 1;
    
    await notice.save();
    
    const acknowledgedAt = new Date();
    res.json({
      ...successPayload({
        req,
        message: "Notice acknowledged",
        data: {
          acknowledgedAt,
          withResponse: !!response
        },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      message: "Notice acknowledged",
      acknowledgedAt,
      withResponse: !!response
    });
  } catch (err) {
    console.error("Acknowledge notice error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_ACKNOWLEDGE_FAILED"
      })
    );
  }
});

/* =======================
   GET NOTICE STATISTICS (Admin only)
======================= */
router.get("/statistics", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json(
        errorPayload({ req, error: "Admin only", code: "NOTICE_ADMIN_ONLY" })
      );
    }
    
    const { timeframe = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));
    
    const notices = await Notice.find({
      createdAt: { $gte: startDate }
    });
    
    const stats = {
      totalSent: notices.length,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byCategory: {},
      byStatus: {
        draft: 0,
        scheduled: 0,
        sent: 0,
        expired: 0,
        cancelled: 0
      },
      engagement: {
        totalRecipients: 0,
        totalRead: 0,
        totalAcknowledged: 0,
        readRate: 0,
        acknowledgementRate: 0
      }
    };
    
    notices.forEach(notice => {
      stats.byPriority[notice.priority] = (stats.byPriority[notice.priority] || 0) + 1;
      stats.byCategory[notice.category] = (stats.byCategory[notice.category] || 0) + 1;
      stats.byStatus[notice.status] = (stats.byStatus[notice.status] || 0) + 1;
      
      const totalRecipients = notice.recipients.length;
      const readCount = notice.readCount || 0;
      const acknowledgedCount = notice.acknowledgedCount || 0;
      
      stats.engagement.totalRecipients += totalRecipients;
      stats.engagement.totalRead += readCount;
      stats.engagement.totalAcknowledged += acknowledgedCount;
    });
    
    if (stats.engagement.totalRecipients > 0) {
      stats.engagement.readRate = (stats.engagement.totalRead / stats.engagement.totalRecipients * 100).toFixed(1);
      stats.engagement.acknowledgementRate = (stats.engagement.totalAcknowledged / stats.engagement.totalRecipients * 100).toFixed(1);
    }
    
    const timeframeLabel = `${timeframe} days`;
    res.json({
      ...successPayload({
        req,
        data: {
          timeframe: timeframeLabel,
          statistics: stats
        },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      timeframe: timeframeLabel,
      statistics: stats
    });
  } catch (err) {
    console.error("Get notice statistics error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_STATS_FETCH_FAILED"
      })
    );
  }
});

/* =======================
   CANCEL NOTICE (Admin only)
======================= */
router.patch("/:noticeId/cancel", verifyJWT, requireCapability("manage_notices"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json(
        errorPayload({ req, error: "Admin only", code: "NOTICE_ADMIN_ONLY" })
      );
    }
    
    const { noticeId } = req.params;
    
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }
    
    if (notice.status === "cancelled") {
      return res.status(400).json(
        errorPayload({ req, error: "Notice is already cancelled", code: "NOTICE_ALREADY_CANCELLED" })
      );
    }
    
    notice.status = "cancelled";
    await notice.save();
    
    const cancelledAt = new Date();
    res.json({
      ...successPayload({
        req,
        message: "Notice cancelled",
        data: { cancelledAt },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      // legacy shape
      message: "Notice cancelled",
      cancelledAt
    });
  } catch (err) {
    console.error("Cancel notice error:", err);
    res.status(500).json(
      errorPayload({
        req,
        error: "Server error",
        code: "NOTICE_CANCEL_FAILED"
      })
    );
  }
});

/* =======================
   EDIT NOTICE (Admin only, limited time)
======================= */
router.patch("/:noticeId", verifyJWT, requireCapability("manage_notices"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json(
        errorPayload({ req, error: "Admin only", code: "NOTICE_ADMIN_ONLY" })
      );
    }

    const { noticeId } = req.params;
    const { title, content, priority, expiresAt } = req.body;

    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }

    const baseTime = notice.sendAt || notice.createdAt;
    const editWindowMs = 15 * 60 * 1000;
    const isWithinWindow = baseTime && (Date.now() - new Date(baseTime).getTime()) <= editWindowMs;
    if (!isWithinWindow) {
      return res.status(403).json(
        errorPayload({ req, error: "Edit window expired", code: "NOTICE_EDIT_WINDOW_EXPIRED" })
      );
    }

    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json(
        errorPayload({ req, error: "Title and content are required", code: "NOTICE_VALIDATION_FAILED" })
      );
    }

    notice.title = title.trim();
    notice.content = content.trim();
    if (priority) notice.priority = priority;
    notice.expiresAt = expiresAt ? new Date(expiresAt) : notice.expiresAt;
    notice.updatedAt = new Date();

    await notice.save();

    return res.json({
      ...successPayload({
        req,
        message: "Notice updated",
        data: { notice },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      notice
    });
  } catch (err) {
    console.error("Edit notice error:", err);
    return res.status(500).json(
      errorPayload({ req, error: "Server error", code: "NOTICE_EDIT_FAILED" })
    );
  }
});

/* =======================
   DELETE NOTICE (Admin only)
======================= */
router.delete("/:noticeId", verifyJWT, requireCapability("manage_notices"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json(
        errorPayload({ req, error: "Admin only", code: "NOTICE_ADMIN_ONLY" })
      );
    }
    
    const { noticeId } = req.params;
    
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json(
        errorPayload({ req, error: "Notice not found", code: "NOTICE_NOT_FOUND" })
      );
    }
    
    await notice.deleteOne();
    
    return res.json({
      ...successPayload({
        req,
        message: "Notice deleted permanently",
        data: { noticeId },
        meta: { statusEnum: STATUS_ENUMS.notice }
      }),
      message: "Notice deleted permanently"
    });
  } catch (err) {
    console.error("Delete notice error:", err);
    return res.status(500).json(
      errorPayload({ req, error: "Server error", code: "NOTICE_DELETE_FAILED" })
    );
  }
});

export default router;

