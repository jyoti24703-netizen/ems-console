import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      "meeting_created", 
      "meeting_updated", 
      "meeting_cancelled",
      "meeting_reminder",
      "rsvp_request",
      "rsvp_accepted",
      "rsvp_declined",
      "action_item_assigned",
      "action_item_completed",
      "mention",
      "recording_available",
      "attendance_marked",
      "meeting_starting",
      "general"
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    meetingId: mongoose.Schema.Types.ObjectId,
    actionItemId: mongoose.Schema.Types.ObjectId,
    discussionId: mongoose.Schema.Types.ObjectId,
    templateId: mongoose.Schema.Types.ObjectId,
    extra: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium"
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  sentVia: [{
    type: String,
    enum: ["in_app", "email", "push", "sms"],
    default: ["in_app"]
  }],
  expiresAt: {
    type: Date,
    index: true,
    expires: 86400 * 90 // Auto-delete after 90 days
  },
  metadata: {
    source: String,
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1, isArchived: 1 });

// Virtual for time ago
notificationSchema.virtual("timeAgo").get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return this.createdAt.toLocaleDateString();
  }
});

// Static methods
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ 
    user: userId, 
    isRead: false,
    isArchived: false 
  });
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

notificationSchema.statics.createNotification = async function(notificationData) {
  const notification = new this(notificationData);
  
  // Set expiry date (90 days from now)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 90);
  notification.expiresAt = expiryDate;
  
  return notification.save();
};

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

// Pre-save middleware
notificationSchema.pre("save", function() {
  if (!this.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    this.expiresAt = expiryDate;
  }
});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
