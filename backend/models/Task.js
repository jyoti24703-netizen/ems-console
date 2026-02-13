import mongoose from "mongoose";

/* ============================
   ACTIVITY TIMELINE SCHEMA
============================ */
const activitySchema = new mongoose.Schema(
  {
    action: { 
      type: String, 
      required: true,
      enum: [
        "TASK_CREATED",
        "TASK_ASSIGNED",
        "TASK_ACCEPTED",
        "TASK_STARTED",
        "TASK_COMPLETED",
        "TASK_VERIFIED",
        "TASK_FAILED",
        "TASK_REOPENED",
        "TASK_REOPEN_TIMEOUT",
        "TASK_DECLINED",
        "TASK_REASSIGNED",
        "TASK_REOPEN_ACCEPTED",
        "TASK_REOPEN_DECLINED",
        "REOPEN_VIEWED",
        // 🔴 MODIFICATION ACTIONS (CRITICAL FIX)
        "MODIFICATION_REQUESTED",
        "MODIFICATION_APPROVED",
        "MODIFICATION_REJECTED",
        "MODIFICATION_COUNTER_PROPOSAL",
        "MODIFICATION_EXPIRED",
        "MODIFICATION_VIEWED",
        "MODIFICATION_MESSAGE",
        "EMPLOYEE_MODIFICATION_MESSAGE",
        "EMPLOYEE_MODIFICATION_REQUESTED",
        "EMPLOYEE_MODIFICATION_EXPIRED",
        // 🔴 COMMUNICATION ACTIONS
        "COMMENT_ADDED",
        "FILE_UPLOADED",
        "MESSAGE_SENT",
        // 🔴 EXTENSION ACTIONS
        "EXTENSION_REQUESTED",
        "EXTENSION_APPROVED",
        "EXTENSION_REJECTED",
        "DEADLINE_EXTENDED",
        "TASK_EXTENDED",
        "SCOPE_CHANGE_APPROVED",
        // 🔴 TASK LIFECYCLE ACTIONS
        "TASK_EDITED",
        "TASK_DELETED",
        "TASK_WITHDRAWN",
        "TASK_ARCHIVED",
        "TASK_UNARCHIVED"
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actorName: { type: String },
    targetName: { type: String },
    role: {
      type: String,
      enum: ["admin", "employee", "system"],
    },
    details: String,
  },
  { timestamps: true }
);

/* ============================
   DISCUSSION SCHEMA
============================ */
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["admin", "employee"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

/* ============================
   EDIT HISTORY SCHEMA
============================ */
const editHistorySchema = new mongoose.Schema(
  {
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    changes: Object,
    editedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvalNote: String,
    note: String
  },
  { _id: false }
);

/* ============================
   MODIFICATION REQUEST SCHEMA
============================ */
const modificationRequestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    enum: ["edit", "delete", "extension", "reassign", "scope_change"],
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "expired", "counter_proposed", "executed"],
    default: "pending"
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  response: {
    decision: String,
    note: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  expiredAt: Date,
  executedAt: Date,
  executedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  employeeViewedAt: Date,
  employeeViewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  // For edit requests
  proposedChanges: {
    title: String,
    description: String,
    dueDate: Date,
    category: String,
    priority: String
  },
  // For delete requests
  deletionImpact: String,
  // For extension requests (employee initiated)
  requestedExtension: Date,
  extensionReason: String,
  // For reassign requests (employee initiated)
  suggestedReassign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reassignReason: String,
  // For scope change requests (employee initiated)
  scopeChanges: Object,
  impactAssessment: String,
  // Shared metadata
  businessCase: String,
  supportingDocs: [String],
  urgency: { type: String, default: "normal" },
  // Discussion/Comments on modification
  discussion: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    senderRole: {
      type: String,
      enum: ["admin", "employee"]
    },
    text: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Review tracking
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rejectedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  rejectionReason: String
}, { _id: true });

/* ============================
   EXTENSION REQUEST SCHEMA
============================ */
const extensionSchema = new mongoose.Schema({
  requestedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  requestedAt: { 
    type: Date, 
    default: Date.now 
  },
  oldDueDate: { 
    type: Date, 
    required: true 
  },
  newDueDate: { 
    type: Date, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  reviewedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  reviewedAt: Date,
  reviewNote: String
}, { _id: true });

const workSubmissionFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: "application/octet-stream" },
    url: { type: String, default: "" },
  },
  { _id: false }
);

/* ============================
   TASK SCHEMA
============================ */
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    category: String,
    dueDate: Date,

    status: {
      type: String,
      enum: [
        "assigned",
        "accepted",
        "in_progress",
        "completed",
        "verified",
        "reopened",
        "failed",
        "declined_by_employee",
        "deleted",
        "withdrawn"
      ],
      default: "assigned",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },

    workSubmission: {
      link: { type: String },
      files: [workSubmissionFileSchema],
      employeeNote: { type: String, default: "" },
      version: { type: Number, default: 1 },
      submittedAt: { type: Date, default: Date.now },
      submissionStatus: {
        type: String,
        enum: ["pending", "submitted", "verified", "failed"],
        default: "pending"
      }
    },

    /* ============================
       🆕 NEW TIMESTAMPS FOR PERFORMANCE TRACKING
    ============================ */
    acceptedAt: Date,  // When employee accepted the task
    startedAt: Date,   // When employee started working

    /* ============================
       REVIEW & COMPLETION METADATA
    ============================ */
    completedAt: Date,
    reviewedAt: Date,
    adminNote: String,
    failureReason: String,
    failureType: {
      type: String,
      enum: ["quality_not_met", "overdue_timeout", "incomplete_work", "technical_issues", "other"],
      default: null
    },
    
    /* ============================
       DECLINE & REOPEN SUPPORT
    ============================ */
    declineReason: { type: String, default: "" },
    declineType: { 
      type: String, 
      enum: ["assignment_decline", "reopen_decline", "withdrawal", null], 
      default: null 
    },
    reopenReason: { type: String, default: "" },
    reopenDueAt: Date,
    reopenSlaStatus: {
      type: String,
      enum: ["pending", "responded", "timed_out"],
      default: "pending"
    },
    reopenSlaBreachedAt: Date,
    reopenViewedAt: Date,
    reopenViewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /* ============================
       ASSIGNMENTS & REFERENCES
    ============================ */
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /* ============================
       MODIFICATION & EXTENSION FEATURES
    ============================ */
    modificationRequests: [modificationRequestSchema],
    employeeModificationRequests: [modificationRequestSchema], // Employee-initiated
    extensionRequests: [extensionSchema],
    
    /* ============================
       AUDIT TRAILS
    ============================ */
    activityTimeline: [activitySchema],
    discussion: [messageSchema],
    editHistory: [editHistorySchema],
    
    /* ============================
       CLOSED AT TIMESTAMP
    ============================ */
    closedAt: Date,
    
    /* ============================
       🆕 ARCHIVE SUPPORT
    ============================ */
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    archiveNote: String
  },
  { timestamps: true }
);

/* ============================
   VIRTUALS
============================ */
taskSchema.virtual("isOverdue").get(function () {
  if (!this.dueDate) return false;
  if (["completed", "verified", "failed", "declined_by_employee", "reopened", "deleted", "withdrawn"].includes(this.status)) return false;
  return new Date() > this.dueDate;
});

taskSchema.virtual("overdueDays").get(function () {
  if (!this.isOverdue) return 0;
  const diff = new Date() - this.dueDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

taskSchema.virtual("taskCategory").get(function () {
  const categories = {
    'assigned': { type: 'active', label: 'To Do', color: 'gray', icon: '📋', priority: 1 },
    'accepted': { type: 'active', label: 'To Do', color: 'blue', icon: '✅', priority: 2 },
    'in_progress': { type: 'active', label: 'In Progress', color: 'yellow', icon: '⚡', priority: 3 },
    'completed': { type: 'active', label: 'In Review', color: 'purple', icon: '👀', priority: 4 },
    'verified': { type: 'done', label: 'Verified', color: 'green', icon: '✔️', priority: 5 },
    'reopened': { type: 'active', label: 'Reopened', color: 'orange', icon: '🔄', priority: 6 },
    'failed': { type: 'failed', label: 'Failed', color: 'red', icon: '❌', priority: 7 },
    'declined_by_employee': { type: 'failed', label: 'Declined', color: 'red', icon: '🚫', priority: 8 },
    'deleted': { type: 'failed', label: 'Deleted', color: 'gray', icon: '🗑️', priority: 9 },
    'withdrawn': { type: 'failed', label: 'Withdrawn', color: 'orange', icon: '↩️', priority: 10 },
  };
  return categories[this.status] || { type: 'unknown', label: this.status, color: 'gray', icon: '📄', priority: 99 };
});

/* ============================
   🆕 PERFORMANCE METRICS VIRTUALS
============================ */
taskSchema.virtual("acceptanceTime").get(function() {
  if (!this.acceptedAt || !this.createdAt) return null;
  const diff = new Date(this.acceptedAt) - new Date(this.createdAt);
  return Math.round(diff / (1000 * 60 * 60)); // hours
});

taskSchema.virtual("completionTime").get(function() {
  if (!this.completedAt || !this.acceptedAt) return null;
  const diff = new Date(this.completedAt) - new Date(this.acceptedAt);
  return Math.round(diff / (1000 * 60 * 60)); // hours
});

taskSchema.virtual("wasOnTime").get(function() {
  if (!this.completedAt || !this.dueDate) return null;
  return new Date(this.completedAt) <= new Date(this.dueDate);
});

taskSchema.virtual("slaBreach").get(function() {
  if (!this.dueDate) return false;
  const closedStatuses = ["completed", "verified", "failed", "deleted", "withdrawn"];
  if (!closedStatuses.includes(this.status)) {
    return new Date() > new Date(this.dueDate);
  }
  if (this.completedAt) {
    return new Date(this.completedAt) > new Date(this.dueDate);
  }
  return false;
});

/* ============================
   RESOLUTION VIRTUAL
============================ */
taskSchema.virtual("resolution").get(function () {
  const actions = this.activityTimeline?.map(a => a.action) || [];
  const lastAction = actions[actions.length - 1];
  const hasReopen = actions.includes("TASK_REOPENED");

  // 1. ASSIGNMENT DECLINED (Never started)
  if (actions.includes("TASK_DECLINED") && !hasReopen) {
    return {
      code: "DECLINED_ASSIGNMENT",
      label: "Assignment Declined",
      severity: "neutral",
      phase: "assignment",
      isFinal: true
    };
  }

  // 2. REOPEN DECLINED BY EMPLOYEE
  if (actions.includes("TASK_REOPEN_DECLINED")) {
    if (lastAction === "TASK_VERIFIED") {
      return {
        code: "REOPEN_DECLINED_VERIFIED",
        label: "Original Work Accepted",
        severity: "positive",
        phase: "reopen",
        isFinal: true
      };
    } else if (lastAction === "TASK_FAILED") {
      return {
        code: "REOPEN_DECLINED_FAILED",
        label: "Rework Declined - Failed",
        severity: "critical",
        phase: "reopen",
        isFinal: true
      };
    } else {
      return {
        code: "REOPEN_DECLINED_PENDING",
        label: "Rework Declined - Pending Review",
        severity: "warning",
        phase: "reopen",
        isFinal: false
      };
    }
  }

  // 3. REOPEN FAILED AFTER REWORK
  if (hasReopen && this.status === "failed") {
    const lastReopenIndex = actions.lastIndexOf("TASK_REOPENED");
    const hasResubmission = actions.slice(lastReopenIndex).includes("TASK_COMPLETED");
    
    if (hasResubmission) {
      return {
        code: "REOPEN_FAILED_AFTER_REWORK",
        label: "Rework Failed",
        severity: "critical",
        phase: "reopen",
        isFinal: true
      };
    } else {
      return {
        code: "REOPEN_FAILED_WITHOUT_REWORK",
        label: "Failed Without Rework",
        severity: "critical",
        phase: "reopen",
        isFinal: true
      };
    }
  }

  // 4. FIRST SUBMISSION FAILED
  if (this.status === "failed" && !hasReopen) {
    return {
      code: "FAILED_EXECUTION",
      label: "Work Did Not Meet Expectations",
      severity: "critical",
      phase: "first_submission",
      isFinal: true
    };
  }

  // 5. VERIFIED AFTER REOPEN
  if (hasReopen && this.status === "verified") {
    const lastReopenIndex = actions.lastIndexOf("TASK_REOPENED");
    const hasResubmission = actions.slice(lastReopenIndex).includes("TASK_COMPLETED");
    
    if (hasResubmission) {
      return {
        code: "REOPEN_VERIFIED_WITH_RESUBMISSION",
        label: "Verified After Rework",
        severity: "positive",
        phase: "reopen",
        isFinal: true
      };
    } else {
      return {
        code: "REOPEN_VERIFIED_WITHOUT_RESUBMISSION",
        label: "Original Work Accepted",
        severity: "positive",
        phase: "reopen",
        isFinal: true
      };
    }
  }

  // 6. NORMAL SUCCESSFUL COMPLETION
  if (this.status === "verified" && !hasReopen) {
    return {
      code: "SUCCESSFUL",
      label: "Verified",
      severity: "positive",
      phase: "first_submission",
      isFinal: true
    };
  }

  // 7. STILL ACTIVE / IN PROGRESS
  if (["assigned", "accepted", "in_progress", "completed"].includes(this.status)) {
    return {
      code: "ACTIVE",
      label: "In Progress",
      severity: "info",
      phase: "active",
      isFinal: false
    };
  }

  // 8. REOPENED AND WAITING
  if (this.status === "reopened") {
    return {
      code: "REOPEN_PENDING",
      label: "Reopened - Pending",
      severity: "warning",
      phase: "reopen",
      isFinal: false
    };
  }

  // 9. DEFAULT FALLBACK
  return {
    code: "UNKNOWN",
    label: "Unknown",
    severity: "neutral",
    phase: "unknown",
    isFinal: false
  };
});

/* ============================
   PERMISSION CHECKING METHODS
============================ */
taskSchema.methods.canAdminEditDirectly = function() {
  return this.status === "assigned";
};

taskSchema.methods.canAdminDeleteDirectly = function() {
  return this.status === "assigned" && !this.hasWorkSubmission();
};

taskSchema.methods.canAdminVerify = function() {
  return this.status === "completed" || this.status === "reopened";
};

taskSchema.methods.canAdminFail = function() {
  if (this.status === "completed") return true;
  if (this.status === "reopened") return true;
  if (this.status === "in_progress" && this.isOverdue) return true;
  if (this.status === "declined_by_employee") return true;
  if (this.status === "withdrawn") return true;
  return false;
};

taskSchema.methods.canAdminReopen = function() {
  return this.status === "verified";
};

taskSchema.methods.hasWorkSubmission = function() {
  if (!this.workSubmission) return false;
  
  const hasLink = this.workSubmission.link && this.workSubmission.link.trim().length > 0;
  const hasFiles = this.workSubmission.files && this.workSubmission.files.length > 0;
  const hasNote = this.workSubmission.employeeNote && this.workSubmission.employeeNote.trim().length > 0;
  const isSubmitted = this.workSubmission.submissionStatus === "submitted";
  
  return (hasLink || hasFiles || hasNote) && isSubmitted;
};

taskSchema.methods.hasPendingModificationRequest = function() {
  return this.modificationRequests && 
         this.modificationRequests.some(req => req.status === "pending" && new Date(req.expiresAt) > new Date());
};

taskSchema.methods.hasNewSubmissionAfterReopen = function() {
  if (!this.activityTimeline) return false;
  
  const lastReopenIndex = this.activityTimeline.findLastIndex(a => a.action === "TASK_REOPENED");
  if (lastReopenIndex === -1) return false;
  
  const hasNewCompletion = this.activityTimeline
    .slice(lastReopenIndex)
    .some(a => a.action === "TASK_COMPLETED");
  
  return hasNewCompletion;
};

/* ============================
   MODIFICATION REQUEST METHODS
============================ */
taskSchema.methods.createModificationRequest = async function(requestType, adminId, data) {
  if (!this.modificationRequests) this.modificationRequests = [];
  
  const slaHours = Number(data?.slaHours || data?.slaDays * 24 || 24);
  const expiresAt = data?.expiresAt || new Date(Date.now() + slaHours * 60 * 60 * 1000);

  const request = {
    requestType,
    requestedBy: adminId,
    requestedAt: new Date(),
    createdAt: new Date(),
    reason: data.reason,
    status: "pending",
    discussion: [],
    expiresAt
  };
  
  if (requestType === "edit") {
    request.proposedChanges = {
      title: data.title || this.title,
      description: data.description || this.description,
      dueDate: data.dueDate || this.dueDate,
      category: data.category || this.category,
      priority: data.priority || this.priority
    };
  } else if (requestType === "delete") {
    request.deletionImpact = data.impactNote;
  }
  
  this.modificationRequests.push(request);
  
  this.activityTimeline.push({
    action: "MODIFICATION_REQUESTED",
    performedBy: adminId,
    role: "admin",
    details: `Modification request (${requestType}): ${data.reason}`,
    timestamp: new Date()
  });
  
  if (this.isModified('status')) {
    this.updateClosedAt();
  }
  
  await this.save();
  
  return this.modificationRequests[this.modificationRequests.length - 1];
};

taskSchema.methods.respondToModificationRequest = async function(requestId, employeeId, decision, note) {
  const request = this.modificationRequests.id(requestId);
  if (!request) throw new Error("Modification request not found");
  
  if (request.status !== "pending") {
    throw new Error("Request already processed");
  }
  
  if (new Date(request.expiresAt) < new Date()) {
    request.status = "expired";
    request.expiredAt = new Date();
    
    this.activityTimeline.push({
      action: "MODIFICATION_EXPIRED",
      role: "system",
      details: `Modification request expired before response (${request.requestType})`,
      timestamp: new Date()
    });

    await this.save();
    throw new Error("Request has expired");
  }
  
  request.status = decision;
  request.response = {
    decision,
    note,
    respondedAt: new Date(),
    respondedBy: employeeId
  };
  
  this.activityTimeline.push({
    action: `MODIFICATION_${decision.toUpperCase()}`,
    performedBy: employeeId,
    role: "employee",
    details: `Modification request ${decision}: ${note}`
  });
  
  await this.save();
  return request;
};

/* ============================
   EXTENSION METHODS
============================ */
taskSchema.methods.canRequestExtension = function() {
  const activeStatuses = ["in_progress", "accepted"];
  return activeStatuses.includes(this.status) &&
         (!this.extensionRequests || !this.extensionRequests.some(req => req.status === "pending"));
};

taskSchema.methods.requestExtension = async function(userId, reason, newDueDate) {
  if (!this.extensionRequests) this.extensionRequests = [];
  
  const extension = {
    requestedBy: userId,
    requestedAt: new Date(),
    oldDueDate: this.dueDate,
    newDueDate: new Date(newDueDate),
    reason: reason,
    status: "pending"
  };
  
  this.extensionRequests.push(extension);
  
  this.activityTimeline.push({
    action: "EXTENSION_REQUESTED",
    performedBy: userId,
    role: "employee",
    details: `Extension requested: ${reason}. New date: ${newDueDate}`
  });
  
  await this.save();
  return extension;
};

taskSchema.methods.approveExtension = async function(adminId, requestId, note) {
  const request = this.extensionRequests.id(requestId);
  if (!request) throw new Error("Extension request not found");
  
  request.status = "approved";
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.reviewNote = note;
  
  this.dueDate = request.newDueDate;
  
  this.activityTimeline.push({
    action: "EXTENSION_APPROVED",
    performedBy: adminId,
    role: "admin",
    details: `Extension approved: ${note}. New deadline: ${request.newDueDate.toDateString()}`
  });
  
  await this.save();
  return request;
};

taskSchema.methods.rejectExtension = async function(adminId, requestId, note) {
  const request = this.extensionRequests.id(requestId);
  if (!request) throw new Error("Extension request not found");
  
  request.status = "rejected";
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.reviewNote = note;
  
  this.activityTimeline.push({
    action: "EXTENSION_REJECTED",
    performedBy: adminId,
    role: "admin",
    details: `Extension rejected: ${note}`
  });
  
  await this.save();
  return request;
};

taskSchema.methods.extendDueDate = async function(adminId, newDueDate, reason) {
  const CLOSED_STATES = ["verified", "failed", "deleted", "withdrawn"];
  if (CLOSED_STATES.includes(this.status)) {
    throw new Error("Cannot extend deadline for closed task");
  }
  
  const oldDueDate = this.dueDate;
  this.dueDate = new Date(newDueDate);
  
  this.activityTimeline.push({
    action: "DEADLINE_EXTENDED",
    performedBy: adminId,
    role: "admin",
    details: `Deadline extended from ${oldDueDate?.toDateString() || 'N/A'} to ${newDueDate}. Reason: ${reason}`
  });
  
  await this.save();
  return this;
};

/* ============================
   HELPER METHODS
============================ */
taskSchema.methods.getResolutionSeverityColor = function(severity) {
  const colors = {
    'positive': 'text-green-400',
    'critical': 'text-red-400',
    'warning': 'text-yellow-400',
    'info': 'text-blue-400',
    'neutral': 'text-gray-400'
  };
  return colors[severity] || 'text-gray-400';
};

taskSchema.methods.updateClosedAt = function() {
  const CLOSED_STATES = ["verified", "failed", "deleted", "withdrawn"];
  if (CLOSED_STATES.includes(this.status) && !this.closedAt) {
    this.closedAt = new Date();
  }
};

taskSchema.methods.canBeArchived = function() {
  return this.status === "verified" && !this.isArchived;
};

taskSchema.methods.archive = async function(adminId, note) {
  if (!this.canBeArchived()) {
    throw new Error("Only verified tasks can be archived");
  }
  
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = adminId;
  this.archiveNote = note;
  
  this.activityTimeline.push({
    action: "TASK_ARCHIVED",
    performedBy: adminId,
    role: "admin",
    details: `Task archived: ${note}`
  });
  
  return await this.save();
};

/* ============================
   QUERY HELPERS
============================ */
taskSchema.query.active = function() {
  return this.where({ isArchived: false });
};

taskSchema.query.archived = function() {
  return this.where({ isArchived: true });
};

taskSchema.query.byEmployee = function(employeeId) {
  return this.where({ assignedTo: employeeId });
};

taskSchema.query.overdue = function() {
  return this.where({
    dueDate: { $lt: new Date() },
    status: { $nin: ["completed", "verified", "failed", "deleted", "withdrawn"] }
  });
};

taskSchema.query.pendingReview = function() {
  return this.where({ status: "completed" });
};

/* ============================
   STATIC METHODS FOR ANALYTICS
============================ */
taskSchema.statics.getPerformanceMetrics = async function(employeeId, timeframe = "all") {
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

  const tasks = await this.find({ 
    assignedTo: employeeId,
    ...dateFilter
  });

  return {
    total: tasks.length,
    verified: tasks.filter(t => t.status === "verified").length,
    failed: tasks.filter(t => t.status === "failed").length,
    onTime: tasks.filter(t => t.wasOnTime === true).length,
    avgAcceptanceTime: tasks.filter(t => t.acceptanceTime).reduce((sum, t) => sum + t.acceptanceTime, 0) / tasks.length || 0,
    avgCompletionTime: tasks.filter(t => t.completionTime).reduce((sum, t) => sum + t.completionTime, 0) / tasks.length || 0
  };
};

/* ============================
   🆕 COMPREHENSIVE INDEXES FOR PERFORMANCE
============================ */
// Basic queries
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });

// Performance tracking
taskSchema.index({ acceptedAt: 1 });
taskSchema.index({ startedAt: 1 });
taskSchema.index({ completedAt: 1 });
taskSchema.index({ reviewedAt: 1 });
taskSchema.index({ closedAt: 1 });

// Archive queries
taskSchema.index({ isArchived: 1 });
taskSchema.index({ archivedAt: 1 });
taskSchema.index({ archivedBy: 1 });

// Compound indexes for common queries
taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1, isArchived: 1, status: 1 });

// Modification requests
taskSchema.index({ "modificationRequests.status": 1 });
taskSchema.index({ "modificationRequests.expiresAt": 1 });
taskSchema.index({ "employeeModificationRequests.status": 1 });

// Extension requests
taskSchema.index({ "extensionRequests.status": 1 });

// Full-text search (optional)
taskSchema.index({ title: "text", description: "text" });

/* ============================
   JSON/OBJECT TRANSFORMATION
============================ */
taskSchema.set("toJSON", { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.resolution = doc.resolution;
    ret.canAdminEditDirectly = doc.canAdminEditDirectly();
    ret.canAdminDeleteDirectly = doc.canAdminDeleteDirectly();
    ret.canAdminVerify = doc.canAdminVerify();
    ret.canAdminFail = doc.canAdminFail();
    ret.canAdminReopen = doc.canAdminReopen();
    ret.hasWorkSubmission = doc.hasWorkSubmission();
    ret.hasNewSubmissionAfterReopen = doc.hasNewSubmissionAfterReopen();
    ret.hasPendingModificationRequest = doc.hasPendingModificationRequest();
    ret.isOverdue = doc.isOverdue;
    ret.overdueDays = doc.overdueDays;
    ret.acceptanceTime = doc.acceptanceTime;
    ret.completionTime = doc.completionTime;
    ret.wasOnTime = doc.wasOnTime;
    ret.slaBreach = doc.slaBreach;
    return ret;
  }
});

taskSchema.set("toObject", { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.resolution = doc.resolution;
    ret.canAdminEditDirectly = doc.canAdminEditDirectly();
    ret.canAdminDeleteDirectly = doc.canAdminDeleteDirectly();
    ret.canAdminVerify = doc.canAdminVerify();
    ret.canAdminFail = doc.canAdminFail();
    ret.canAdminReopen = doc.canAdminReopen();
    ret.hasWorkSubmission = doc.hasWorkSubmission();
    ret.hasNewSubmissionAfterReopen = doc.hasNewSubmissionAfterReopen();
    ret.hasPendingModificationRequest = doc.hasPendingModificationRequest();
    ret.isOverdue = doc.isOverdue;
    ret.overdueDays = doc.overdueDays;
    ret.acceptanceTime = doc.acceptanceTime;
    ret.completionTime = doc.completionTime;
    ret.wasOnTime = doc.wasOnTime;
    ret.slaBreach = doc.slaBreach;
    return ret;
  }
});

export default mongoose.model("Task", taskSchema);
