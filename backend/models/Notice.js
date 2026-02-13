import mongoose from "mongoose";

/* ============================
   ✅ NEW: DISCUSSION SCHEMA
============================ */
const discussionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  senderName: String,
  senderRole: {
    type: String,
    enum: ["admin", "employee"]
  },
  text: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  senderName: { type: String, required: true },
  senderEmail: String,
  
  // Recipients Management
  recipients: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userEmail: String,
    userName: String,
    userRole: String,
    userDepartment: String,
    
    // Delivery Status
    delivered: { type: Boolean, default: false },
    deliveredAt: Date,
    deliveryMethod: { 
      type: String, 
      enum: ["in_app", "email", "sms", "push", "all"],
      default: "in_app"
    },
    
    // Engagement Status
    read: { type: Boolean, default: false },
    readAt: Date,
    readDuration: Number,
    
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: Date,
    acknowledgementMethod: String,
    
    // Response Handling
    response: String,
    responseType: { 
      type: String, 
      enum: ["acknowledgement", "question", "feedback", "objection", "suggestion"]
    },
    respondedAt: Date,
    responseProcessed: { type: Boolean, default: false },
    responseProcessor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    responseProcessedAt: Date,
    responseNotes: String,
    
    // Action Items
    actionTaken: { type: Boolean, default: false },
    actionDescription: String,
    actionTakenAt: Date,
    actionVerified: { type: Boolean, default: false },
    actionVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actionVerifiedAt: Date,
    
    // Follow-up
    followUpRequired: { type: Boolean, default: false },
    followUpDate: Date,
    followUpCompleted: { type: Boolean, default: false },
    followUpNotes: String,
    
    // Analytics
    openedCount: { type: Number, default: 0 },
    lastOpenedAt: Date,
    deviceInfo: String,
    locationInfo: String
  }],
  
  // Targeting Configuration
  targetType: {
    type: String,
    enum: ["all", "department", "role", "specific", "meeting", "team", "custom_query"],
    default: "all"
  },
  targetDepartment: String,
  targetRole: { type: String, enum: ["employee", "admin", "manager", "all"] },
  specificUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  
  targetQuery: mongoose.Schema.Types.Mixed,
  
  // Priority & Classification
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical", "urgent"],
    default: "medium"
  },
  severity: {
    type: String,
    enum: ["info", "warning", "error", "success", "alert"],
    default: "info"
  },
  category: {
    type: String,
    enum: [
      "general", 
      "urgent", 
      "meeting", 
      "task", 
      "policy", 
      "system", 
      "celebration", 
      "reminder",
      "training",
      "compliance",
      "security",
      "maintenance",
      "performance",
      "feedback",
      "anniversary",
      "birthday"
    ],
    default: "general"
  },
  subCategory: String,
  
  // Scheduling & Validity
  sendAt: { type: Date, default: Date.now },
  expiresAt: Date,
  validityPeriod: Number,
  renotifyAfter: Number,
  autoArchiveAfter: Number,
  
  // Lifecycle Status
  status: {
    type: String,
    enum: [
      "draft", 
      "scheduled", 
      "sending", 
      "sent", 
      "partially_sent", 
      "failed", 
      "expired", 
      "cancelled", 
      "archived",
      "deleted"
    ],
    default: "draft"
  },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: String
  }],
  
  // Attachments
  attachments: [{
    name: String,
    size: Number,
    type: String,
    url: String,
    description: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Interactive Elements
  requiresAcknowledgement: { type: Boolean, default: false },
  acknowledgementDeadline: Date,
  acknowledgementReminders: [{
    sentAt: Date,
    reminderType: String,
    recipientsCount: Number
  }],
  
  allowResponse: { type: Boolean, default: false },
  responseDeadline: Date,
  responseFormat: String,
  responseOptions: [String],
  
  actionRequired: { type: Boolean, default: false },
  actionDeadline: Date,
  actionType: String,
  actionInstructions: String,
  actionLink: String,
  actionButtonText: String,
  
  // Poll/Survey Integration
  isPoll: { type: Boolean, default: false },
  pollQuestion: String,
  pollOptions: [{
    text: String,
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  }],
  pollEndDate: Date,
  pollResultsVisible: { type: Boolean, default: false },
  
  /* ============================
     ✅ NEW: DISCUSSION FIELD
  ============================ */
  discussion: [discussionSchema],
  
  // Analytics & Metrics
  totalRecipients: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  openedCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  acknowledgedCount: { type: Number, default: 0 },
  respondedCount: { type: Number, default: 0 },
  actionTakenCount: { type: Number, default: 0 },
  
  averageReadTime: Number,
  engagementRate: Number,
  responseRate: Number,
  
  // Delivery Methods
  deliveryMethods: [{
    method: String,
    sentAt: Date,
    successCount: Number,
    failCount: Number
  }],
  
  // Reminders & Follow-ups
  reminders: [{
    type: {
      type: String,
      enum: ["email", "push", "sms", "in_app"]
    },
    scheduledAt: Date,
    sentAt: Date,
    recipientsCount: Number,
    content: String
  }],
  
  autoFollowUps: [{
    daysAfter: Number,
    content: String,
    sentAt: Date,
    recipientsCount: Number
  }],
  
  // Audit Trail
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedAt: Date,
  
  // Templates
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "NoticeTemplate" },
  templateName: String,
  isTemplate: { type: Boolean, default: false },
  
  // Localization
  language: { type: String, default: "en" },
  translations: [{
    language: String,
    title: String,
    content: String,
    translatedAt: Date,
    translatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  
  // Compliance
  retentionPeriod: Number,
  legalHold: { type: Boolean, default: false },
  complianceNotes: String,
  requiresSignOff: { type: Boolean, default: false },
  signedOffBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  signedOffAt: Date,
  
  // Integration
  externalId: String,
  externalSystem: String,
  syncStatus: String,
  lastSyncedAt: Date,
  
  // Rich Content
  featuredImage: String,
  videoUrl: String,
  formattedContent: String,
  summary: String,
  
  // Related Entities
  relatedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  relatedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
  relatedDocuments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
  relatedNotices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notice" }],
  
  // Feedback
  feedbackEnabled: { type: Boolean, default: false },
  feedbackRatings: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: Number,
    comment: String,
    ratedAt: { type: Date, default: Date.now }
  }],
  averageRating: Number,
  
  // Cost Tracking
  estimatedCost: Number,
  actualCost: Number,
  costBreakdown: mongoose.Schema.Types.Mixed,
  
  // Security
  encryptionLevel: { 
    type: String, 
    enum: ["standard", "confidential", "restricted", "top_secret"],
    default: "standard"
  },
  accessLog: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    accessedAt: { type: Date, default: Date.now },
    action: String,
    ipAddress: String
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
noticeSchema.virtual('isActive').get(function() {
  const now = new Date();
  const expired = this.expiresAt && now > new Date(this.expiresAt);
  const notSent = this.status === "draft" || this.status === "scheduled";
  
  return !expired && !notSent && this.status !== "cancelled" && this.status !== "archived";
});

noticeSchema.virtual('deliveryRate').get(function() {
  if (this.totalRecipients === 0) return 0;
  return (this.deliveredCount / this.totalRecipients * 100).toFixed(1);
});

noticeSchema.virtual('readRate').get(function() {
  if (this.totalRecipients === 0) return 0;
  return (this.readCount / this.totalRecipients * 100).toFixed(1);
});

noticeSchema.virtual('acknowledgementRate').get(function() {
  if (!this.requiresAcknowledgement || this.totalRecipients === 0) return 0;
  return (this.acknowledgedCount / this.totalRecipients * 100).toFixed(1);
});

noticeSchema.virtual('timeToFirstRead').get(function() {
  if (!this.recipients || this.recipients.length === 0) return null;
  
  const readRecipients = this.recipients.filter(r => r.readAt);
  if (readRecipients.length === 0) return null;
  
  const firstRead = readRecipients.reduce((earliest, current) => {
    return earliest.readAt < current.readAt ? earliest : current;
  });
  
  return Math.round((firstRead.readAt - this.sendAt) / (1000 * 60));
});

noticeSchema.virtual('isUrgent').get(function() {
  return this.priority === "urgent" || this.priority === "critical" || this.severity === "alert";
});

// Methods
noticeSchema.methods.markAsDelivered = async function(userId) {
  const recipient = this.recipients.id(userId);
  if (recipient && !recipient.delivered) {
    recipient.delivered = true;
    recipient.deliveredAt = new Date();
    this.deliveredCount++;
    
    this.statusHistory.push({
      status: "delivered",
      changedAt: new Date(),
      notes: `Delivered to user ${userId}`
    });
    
    return await this.save();
  }
  return this;
};

noticeSchema.methods.markAsRead = async function(userId, duration = null, deviceInfo = null) {
  const recipient = this.recipients.id(userId);
  if (recipient && !recipient.read) {
    recipient.read = true;
    recipient.readAt = new Date();
    if (duration) recipient.readDuration = duration;
    if (deviceInfo) recipient.deviceInfo = deviceInfo;
    
    recipient.openedCount++;
    recipient.lastOpenedAt = new Date();
    
    this.readCount++;
    this.openedCount++;
    
    this.statusHistory.push({
      status: "read",
      changedAt: new Date(),
      notes: `Read by user ${userId}`
    });
    
    return await this.save();
  } else if (recipient && recipient.read) {
    recipient.openedCount++;
    recipient.lastOpenedAt = new Date();
    this.openedCount++;
    return await this.save();
  }
  return this;
};

noticeSchema.methods.acknowledge = async function(userId, method = "button_click") {
  const recipient = this.recipients.id(userId);
  if (recipient && !recipient.acknowledged) {
    recipient.acknowledged = true;
    recipient.acknowledgedAt = new Date();
    recipient.acknowledgementMethod = method;
    
    this.acknowledgedCount++;
    
    this.statusHistory.push({
      status: "acknowledged",
      changedAt: new Date(),
      notes: `Acknowledged by user ${userId} via ${method}`
    });
    
    return await this.save();
  }
  return this;
};

noticeSchema.methods.addResponse = async function(userId, response, responseType = "acknowledgement") {
  const recipient = this.recipients.id(userId);
  if (recipient && this.allowResponse) {
    recipient.response = response;
    recipient.responseType = responseType;
    recipient.respondedAt = new Date();
    
    this.respondedCount++;
    
    this.statusHistory.push({
      status: "responded",
      changedAt: new Date(),
      notes: `Response received from user ${userId}`
    });
    
    return await this.save();
  }
  return this;
};

noticeSchema.methods.markActionTaken = async function(userId, description = "") {
  const recipient = this.recipients.id(userId);
  if (recipient && this.actionRequired) {
    recipient.actionTaken = true;
    recipient.actionDescription = description;
    recipient.actionTakenAt = new Date();
    
    this.actionTakenCount++;
    
    this.statusHistory.push({
      status: "action_taken",
      changedAt: new Date(),
      notes: `Action taken by user ${userId}: ${description}`
    });
    
    return await this.save();
  }
  return this;
};

noticeSchema.methods.castVote = async function(userId, optionIndex) {
  if (!this.isPoll) {
    throw new Error("This notice is not a poll");
  }
  
  if (this.pollEndDate && new Date() > new Date(this.pollEndDate)) {
    throw new Error("Poll has ended");
  }
  
  const option = this.pollOptions[optionIndex];
  if (!option) {
    throw new Error("Invalid option index");
  }
  
  const alreadyVoted = this.pollOptions.some(opt => 
    opt.voters.includes(userId)
  );
  
  if (alreadyVoted) {
    this.pollOptions.forEach(opt => {
      const voterIndex = opt.voters.indexOf(userId);
      if (voterIndex !== -1) {
        opt.voters.splice(voterIndex, 1);
        opt.votes--;
      }
    });
  }
  
  option.voters.push(userId);
  option.votes++;
  
  return await this.save();
};

noticeSchema.methods.updateStatus = async function(newStatus, changedBy, notes = "") {
  const oldStatus = this.status;
  this.status = newStatus;
  
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: changedBy,
    notes: `${notes} (Changed from ${oldStatus} to ${newStatus})`
  });
  
  return await this.save();
};

// Statics
noticeSchema.statics.getStatistics = async function(timeframe = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);
  
  const notices = await this.find({
    createdAt: { $gte: startDate }
  });
  
  const stats = {
    total: notices.length,
    byStatus: {},
    byPriority: {},
    byCategory: {},
    engagement: {
      totalRecipients: 0,
      totalRead: 0,
      totalAcknowledged: 0,
      totalResponded: 0,
      readRate: 0,
      acknowledgementRate: 0,
      responseRate: 0
    },
    delivery: {
      totalSent: 0,
      totalDelivered: 0,
      deliveryRate: 0
    }
  };
  
  notices.forEach(notice => {
    stats.byStatus[notice.status] = (stats.byStatus[notice.status] || 0) + 1;
    stats.byPriority[notice.priority] = (stats.byPriority[notice.priority] || 0) + 1;
    stats.byCategory[notice.category] = (stats.byCategory[notice.category] || 0) + 1;
    
    stats.engagement.totalRecipients += notice.totalRecipients || 0;
    stats.engagement.totalRead += notice.readCount || 0;
    stats.engagement.totalAcknowledged += notice.acknowledgedCount || 0;
    stats.engagement.totalResponded += notice.respondedCount || 0;
    
    stats.delivery.totalSent += notice.sentCount || 0;
    stats.delivery.totalDelivered += notice.deliveredCount || 0;
  });
  
  if (stats.engagement.totalRecipients > 0) {
    stats.engagement.readRate = (stats.engagement.totalRead / stats.engagement.totalRecipients * 100).toFixed(1);
    stats.engagement.acknowledgementRate = (stats.engagement.totalAcknowledged / stats.engagement.totalRecipients * 100).toFixed(1);
    stats.engagement.responseRate = (stats.engagement.totalResponded / stats.engagement.totalRecipients * 100).toFixed(1);
  }
  
  if (stats.delivery.totalSent > 0) {
    stats.delivery.deliveryRate = (stats.delivery.totalDelivered / stats.delivery.totalSent * 100).toFixed(1);
  }
  
  return stats;
};

noticeSchema.statics.getUrgentNotices = async function(userId) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
  
  return await this.find({
    "recipients.user": userId,
    status: { $in: ["sent", "sending"] },
    $or: [
      { priority: { $in: ["urgent", "critical"] } },
      { severity: "alert" },
      {
        requiresAcknowledgement: true,
        acknowledgementDeadline: { $lte: oneHourAgo }
      },
      {
        actionRequired: true,
        actionDeadline: { $lte: oneHourAgo }
      }
    ]
  })
  .populate("sender", "name email")
  .sort({ priority: -1, createdAt: -1 })
  .limit(20);
};

// Indexes
noticeSchema.index({ sender: 1, createdAt: -1 });
noticeSchema.index({ "recipients.user": 1, status: 1 });
noticeSchema.index({ status: 1, sendAt: -1 });
noticeSchema.index({ priority: 1, severity: 1 });
noticeSchema.index({ category: 1, subCategory: 1 });
noticeSchema.index({ targetType: 1, targetDepartment: 1 });
noticeSchema.index({ targetType: 1, targetRole: 1 });
noticeSchema.index({ sendAt: -1 });
noticeSchema.index({ expiresAt: 1 });
noticeSchema.index({ status: 1, expiresAt: 1 });
noticeSchema.index({ isPoll: 1, pollEndDate: 1 });
noticeSchema.index({ title: "text", content: "text" });
noticeSchema.index({ "recipients.read": 1, "recipients.user": 1 });
noticeSchema.index({ "recipients.acknowledged": 1, "recipients.user": 1 });
noticeSchema.index({ "recipients.actionTaken": 1, "recipients.user": 1 });

const Notice = mongoose.models.Notice || mongoose.model("Notice", noticeSchema);

export default Notice;