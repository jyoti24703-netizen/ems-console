import mongoose from "mongoose";

/* ============================
   ATTENDEE SCHEMA
============================ */
const attendeeSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rsvpStatus: {
    type: String,
    enum: ["pending", "accepted", "declined", "tentative"],
    default: "pending"
  },
  rsvpAt: Date,
  attended: {
    type: Boolean,
    default: false
  },
  joinTime: Date,
  leaveTime: Date,
  durationPresent: Number // in minutes
}, { _id: false });

/* ============================
   NOTES SCHEMA
============================ */
const noteSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  tags: [String],
  isPrivate: {
    type: Boolean,
    default: false
  }
}, { _id: true });

/* ============================
   ACTION ITEMS SCHEMA
============================ */
const actionItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  dueDate: Date,
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed", "blocked"],
    default: "pending"
  },
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  resource: {
    type: {
      type: String,
      enum: ["none", "link", "document"],
      default: "none"
    },
    label: String,
    url: String,
    fileName: String,
    fileUrl: String,
    mimeType: String,
    size: Number
  },
  submission: {
    status: {
      type: String,
      enum: ["pending", "submitted", "approved", "rejected"],
      default: "pending"
    },
    text: String,
    url: String,
    fileName: String,
    fileUrl: String,
    mimeType: String,
    size: Number,
    submittedAt: Date,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: String
  }
}, { _id: true });

/* ============================
   DISCUSSION SCHEMA
============================ */
const discussionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    enum: ["admin", "employee"],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  mentions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: String
  }],
  parentMessage: { type: mongoose.Schema.Types.ObjectId, ref: "discussion" },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    emoji: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

/* ============================
   NOTIFICATION SCHEMA
============================ */
const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["meeting_created", "meeting_updated", "meeting_cancelled", 
           "rsvp_request", "meeting_reminder", "action_item_assigned",
           "mention", "recording_available", "attendance_required"],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    meetingId: mongoose.Schema.Types.ObjectId,
    actionItemId: mongoose.Schema.Types.ObjectId,
    messageId: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  sentVia: [{
    type: String,
    enum: ["in_app", "email", "push", "sms"]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

/* ============================
   MEETING TEMPLATE SCHEMA
============================ */
const meetingTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  title: String,
  agenda: String,
  defaultDuration: {
    type: Number,
    default: 60
  },
  defaultAttendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  defaultTags: [String],
  recurrencePattern: {
    type: String,
    enum: ["none", "daily", "weekly", "monthly", "custom"],
    default: "none"
  },
  customRecurrence: {
    frequency: String,
    interval: Number,
    daysOfWeek: [Number],
    endDate: Date,
    occurrenceCount: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  usedCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date
}, { timestamps: true });

/* ============================
   MEETING SCHEMA
============================ */
const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  agenda: {
    type: String,
    trim: true
  },
  meetingDateTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  meetingLink: {
    type: String,
    trim: true
  },
  meetingPlatform: {
    type: String,
    enum: ["google_meet", "zoom", "microsoft_teams", "webex", "other"],
    default: "google_meet"
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  coOrganizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  attendees: [attendeeSchema],
  audienceType: {
    type: String,
    enum: ["all", "selected"],
    default: "selected"
  },
  status: {
    type: String,
    enum: ["draft", "scheduled", "in_progress", "completed", "cancelled"],
    default: "scheduled"
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    type: String,
    enum: ["daily", "weekly", "monthly", "none"],
    default: "none"
  },
  recurrenceEndDate: Date,
  parentMeeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meeting"
  },
  seriesId: String,
  notes: [noteSchema],
  actionItems: [actionItemSchema],
  discussion: [discussionSchema],
  tags: [String],
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  recording: {
    url: String,
    fileName: String,
    thumbnailUrl: String,
    mimeType: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    type: {
      type: String,
      enum: ["video", "audio", "transcript"],
      default: "video"
    },
    duration: Number, // in minutes
    size: Number, // in bytes
    visibility: {
      type: String,
      enum: ["public", "attendees_only", "private"],
      default: "attendees_only"
    }
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
  }],
  reminders: [{
    type: {
      type: String,
      enum: ["email", "push", "both"]
    },
    minutesBefore: Number,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  }],
  followUpEmailSent: {
    type: Boolean,
    default: false
  },
  followUpEmailSentAt: Date,
  cancellationReason: String,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rescheduledFrom: Date,
  rescheduledTo: Date,
  rescheduledReason: String,
  rescheduledAt: Date,
  rescheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  templateUsed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MeetingTemplate"
  },
  metadata: {
    timezone: String,
    icalUid: String,
    googleCalendarEventId: String,
    outlookEventId: String,
    zoomMeetingId: String
  },
  analytics: {
    totalMessages: { type: Number, default: 0 },
    averageResponseTime: Number, // in minutes
    engagementScore: Number, // 0-100
    peakAttendance: Number,
    scheduledStartTime: Date,
    actualStartTime: Date,
    actualEndTime: Date,
    actualDuration: Number // in minutes
  }
}, { timestamps: true });

/* ============================
   VIRTUALS
============================ */
meetingSchema.virtual("isPast").get(function() {
  return new Date() > this.meetingDateTime;
});

meetingSchema.virtual("isUpcoming").get(function() {
  return new Date() < this.meetingDateTime;
});

meetingSchema.virtual("endTime").get(function() {
  const end = new Date(this.meetingDateTime);
  end.setMinutes(end.getMinutes() + this.duration);
  return end;
});

meetingSchema.virtual("timeUntilMeeting").get(function() {
  const now = new Date();
  const meetingTime = this.meetingDateTime;
  return meetingTime - now;
});

meetingSchema.virtual("attendanceStats").get(function() {
  const total = this.attendees.length;
  const attended = this.attendees.filter(a => a.attended).length;
  const accepted = this.attendees.filter(a => a.rsvpStatus === "accepted").length;
  const declined = this.attendees.filter(a => a.rsvpStatus === "declined").length;
  const tentative = this.attendees.filter(a => a.rsvpStatus === "tentative").length;
  const pending = this.attendees.filter(a => a.rsvpStatus === "pending").length;
  
  return {
    total,
    attended,
    attendanceRate: total > 0 ? ((attended / total) * 100).toFixed(1) : 0,
    accepted,
    declined,
    tentative,
    pending,
    noResponse: pending
  };
});

meetingSchema.virtual("engagementMetrics").get(function() {
  const totalAttendees = this.attendees.length;
  const activeParticipants = this.discussion
    ? new Set(this.discussion.map(msg => msg.sender.toString())).size
    : 0;
  const messageCount = this.discussion ? this.discussion.length : 0;
  const actionItemsCount = this.actionItems ? this.actionItems.length : 0;
  const completedActionItems = this.actionItems 
    ? this.actionItems.filter(item => item.status === "completed").length 
    : 0;
  
  return {
    activeParticipants,
    participationRate: totalAttendees > 0 
      ? ((activeParticipants / totalAttendees) * 100).toFixed(1) 
      : 0,
    messageCount,
    messagesPerParticipant: activeParticipants > 0 
      ? (messageCount / activeParticipants).toFixed(1) 
      : 0,
    actionItemsCount,
    actionItemCompletionRate: actionItemsCount > 0
      ? ((completedActionItems / actionItemsCount) * 100).toFixed(1)
      : 0
  };
});

/* ============================
   METHODS
============================ */
meetingSchema.methods.addAttendee = function(employeeId) {
  const exists = this.attendees.some(a => a.employee.toString() === employeeId);
  if (!exists) {
    this.attendees.push({
      employee: employeeId,
      rsvpStatus: "pending",
      attended: false
    });
  }
  return this.save();
};

meetingSchema.methods.removeAttendee = function(employeeId) {
  this.attendees = this.attendees.filter(
    a => a.employee.toString() !== employeeId
  );
  return this.save();
};

meetingSchema.methods.markComplete = function() {
  this.status = "completed";
  this.analytics.actualEndTime = new Date();
  this.analytics.actualDuration = this.analytics.actualStartTime 
    ? (this.analytics.actualEndTime - this.analytics.actualStartTime) / (1000 * 60)
    : this.duration;
  return this.save();
};

meetingSchema.methods.startMeeting = function() {
  this.status = "in_progress";
  this.analytics.actualStartTime = new Date();
  return this.save();
};

meetingSchema.methods.cancel = function(reason, cancelledBy) {
  this.status = "cancelled";
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  return this.save();
};

meetingSchema.methods.reschedule = function(newDateTime, reason, rescheduledBy) {
  this.rescheduledFrom = this.meetingDateTime;
  this.meetingDateTime = newDateTime;
  this.rescheduledTo = newDateTime;
  this.rescheduledReason = reason;
  this.rescheduledAt = new Date();
  this.rescheduledBy = rescheduledBy;
  return this.save();
};

meetingSchema.methods.addDiscussionMessage = async function(senderId, text, attachments = []) {
  const sender = await mongoose.model("User").findById(senderId);
  if (!sender) throw new Error("Sender not found");
  
  const message = {
    sender: senderId,
    senderName: sender.name,
    senderRole: sender.role,
    text: text.trim(),
    attachments,
    createdAt: new Date()
  };
  
  this.discussion.push(message);
  this.analytics.totalMessages = (this.analytics.totalMessages || 0) + 1;
  
  return this.save();
};

meetingSchema.methods.generateICalEvent = function() {
  // Generate iCal event data
  const event = {
    title: this.title,
    description: this.description,
    start: this.meetingDateTime,
    end: this.endTime,
    location: this.meetingLink,
    organizer: this.organizer.email,
    attendees: this.attendees.map(a => a.employee.email)
  };
  
  return event;
};

meetingSchema.methods.sendReminders = async function() {
  // Implementation for sending reminders
  const now = new Date();
  const meetingTime = this.meetingDateTime;
  const timeUntil = meetingTime - now;
  
  // Check for reminders that need to be sent
  this.reminders.forEach(reminder => {
    if (!reminder.sent && timeUntil <= reminder.minutesBefore * 60 * 1000) {
      // Send reminder
      reminder.sent = true;
      reminder.sentAt = new Date();
    }
  });
  
  return this.save();
};

/* ============================
   STATICS
============================ */
meetingSchema.statics.findByDateRange = function(startDate, endDate, userId = null) {
  const query = {
    meetingDateTime: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (userId) {
    query.$or = [
      { organizer: userId },
      { coOrganizers: userId },
      { "attendees.employee": userId }
    ];
  }
  
  return this.find(query)
    .populate("organizer", "name email")
    .populate("attendees.employee", "name email")
    .sort({ meetingDateTime: 1 });
};

meetingSchema.statics.getUserMeetingStats = async function(userId, startDate, endDate) {
  const meetings = await this.findByDateRange(startDate, endDate, userId);
  
  const stats = {
    totalMeetings: meetings.length,
    organized: meetings.filter(m => m.organizer.toString() === userId).length,
    attended: meetings.filter(m => 
      m.attendees.some(a => a.employee.toString() === userId && a.attended)
    ).length,
    invited: meetings.filter(m => 
      m.attendees.some(a => a.employee.toString() === userId)
    ).length,
    averageDuration: meetings.length > 0 
      ? meetings.reduce((sum, m) => sum + (m.analytics.actualDuration || m.duration), 0) / meetings.length
      : 0,
    byStatus: {
      scheduled: meetings.filter(m => m.status === "scheduled").length,
      in_progress: meetings.filter(m => m.status === "in_progress").length,
      completed: meetings.filter(m => m.status === "completed").length,
      cancelled: meetings.filter(m => m.status === "cancelled").length
    },
    byPriority: {
      low: meetings.filter(m => m.priority === "low").length,
      medium: meetings.filter(m => m.priority === "medium").length,
      high: meetings.filter(m => m.priority === "high").length,
      critical: meetings.filter(m => m.priority === "critical").length
    }
  };
  
  return stats;
};

meetingSchema.statics.generateAttendanceReport = async function(meetingId) {
  const meeting = await this.findById(meetingId)
    .populate("attendees.employee", "name email department position")
    .populate("organizer", "name email");
  
  if (!meeting) throw new Error("Meeting not found");
  
  const report = {
    meeting: {
      id: meeting._id,
      title: meeting.title,
      date: meeting.meetingDateTime,
      duration: meeting.duration,
      organizer: meeting.organizer
    },
    attendance: meeting.attendanceStats,
    attendees: meeting.attendees.map(attendee => ({
      employee: attendee.employee,
      rsvpStatus: attendee.rsvpStatus,
      rsvpAt: attendee.rsvpAt,
      attended: attendee.attended,
      joinTime: attendee.joinTime,
      leaveTime: attendee.leaveTime,
      durationPresent: attendee.durationPresent,
      punctuality: attendee.joinTime 
        ? (new Date(attendee.joinTime) - meeting.meetingDateTime) / (1000 * 60) // minutes late/early
        : null
    })),
    engagement: meeting.engagementMetrics,
    timestamp: new Date()
  };
  
  return report;
};

/* ============================
   INDEXES
============================ */
meetingSchema.index({ meetingDateTime: 1 });
meetingSchema.index({ organizer: 1 });
meetingSchema.index({ "attendees.employee": 1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ priority: 1 });
meetingSchema.index({ tags: 1 });
meetingSchema.index({ seriesId: 1 });
meetingSchema.index({ "metadata.googleCalendarEventId": 1 });
meetingSchema.index({ "metadata.zoomMeetingId": 1 });
meetingSchema.index({ createdAt: 1 });
meetingSchema.index({ "analytics.actualStartTime": 1 });

/* ============================
   PRE AND POST HOOKS
============================ */
meetingSchema.pre("save", function() {
  // Auto-generate meeting link if not provided
  if (!this.meetingLink && this.meetingPlatform === "google_meet") {
    this.meetingLink = `https://meet.google.com/new-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Update series ID for recurring meetings
  if (this.isRecurring && !this.seriesId) {
    this.seriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Set parent meeting for recurring instances
  if (this.isRecurring && this.parentMeeting && !this.seriesId) {
    this.seriesId = this.parentMeeting.seriesId;
  }
});

meetingSchema.post("save", async function(doc) {
  // Send notifications for status changes
  if (doc.isModified("status")) {
    // Trigger notification logic
    console.log(`Meeting ${doc._id} status changed to ${doc.status}`);
  }
  
  // Send calendar invites when meeting is created
  if (doc.isNew && doc.status === "scheduled") {
    // Trigger calendar integration
    console.log(`New meeting created: ${doc.title}`);
  }
});

/* ============================
   SETTINGS
============================ */
meetingSchema.set("toJSON", { virtuals: true });
meetingSchema.set("toObject", { virtuals: true });

// Export both Meeting and MeetingTemplate models
export const Meeting = mongoose.model("Meeting", meetingSchema);
export const MeetingTemplate = mongoose.model("MeetingTemplate", meetingTemplateSchema);

export default Meeting;
