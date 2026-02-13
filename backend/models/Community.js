import mongoose from "mongoose";

const communityPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  authorName: { type: String, required: true },
  authorRole: { type: String, enum: ["admin", "employee"], required: true },
  postType: { 
    type: String, 
    enum: [
      "announcement",
      "discussion",
      "question",
      "update",
      "poll",
      "celebration",
      "help",
      "idea",
      "status"
    ],
    default: "discussion"
  },
  
  // IMAGE UPLOAD SUPPORT - NEW
  images: [{
    url: String,
    filename: String,
    size: Number
  }],
  
  // Poll-specific fields
  pollQuestion: String,
  pollOptions: [{
    text: String,
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  }],
  pollEndDate: Date,
  pollResultsVisible: { type: Boolean, default: false },
  
  // Reactions - NEW SIMPLIFIED LIKES
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  
  // Mentions
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  
  // Comments
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ["admin", "employee"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    reactions: [{
      emoji: String,
      count: { type: Number, default: 1 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
    }],
    replies: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      authorName: { type: String, required: true },
      authorRole: { type: String, enum: ["admin", "employee"], required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }]
  }],
  
  // Attachments
  attachments: [{
    name: String,
    size: Number,
    type: String,
    url: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Visibility
  isPinned: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  expiresAt: Date,
  
  // Categories & Tags
  category: { 
    type: String, 
    enum: ["general", "announcement", "help", "feedback", "celebration", "idea", "question", "resource"],
    default: "general"
  },
  tags: [String],
  department: String,
  
  // Analytics
  viewCount: { type: Number, default: 0 },
  uniqueViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  shareCount: { type: Number, default: 0 },
  saveCount: { type: Number, default: 0 },
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  
  // Related Content
  relatedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  relatedMeetings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meeting" }],
  relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" }],
  
  // Moderation
  reportedCount: { type: Number, default: 0 },
  reports: [{
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: String,
    details: String,
    reportedAt: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ["pending", "reviewed", "dismissed", "action_taken"],
      default: "pending"
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    actionTaken: String
  }],
  isLocked: { type: Boolean, default: false },
  lockedAt: Date,
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lockReason: String,
  
  // Engagement Tracking
  lastActivityAt: { type: Date, default: Date.now },
  commentCount: { type: Number, default: 0 },
  
  // Poll Analytics
  totalVotes: { type: Number, default: 0 },
  uniqueVoters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  pollClosed: { type: Boolean, default: false },
  pollClosedAt: Date,
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
communityPostSchema.virtual('isActive').get(function() {
  return !this.isArchived && !this.isDeleted;
});

communityPostSchema.virtual('hasPoll').get(function() {
  return this.postType === "poll" && this.pollQuestion;
});

communityPostSchema.virtual('isPollActive').get(function() {
  if (!this.hasPoll) return false;
  if (this.pollClosed) return false;
  if (this.pollEndDate && new Date() > new Date(this.pollEndDate)) return false;
  return true;
});

communityPostSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Methods - UPDATED WITH LIKE FUNCTION
communityPostSchema.methods.toggleLike = async function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    // Remove like
    this.likes.splice(index, 1);
  } else {
    // Add like
    this.likes.push(userId);
  }
  this.lastActivityAt = new Date();
  return await this.save();
};

communityPostSchema.methods.addComment = async function(commentData) {
  const comment = {
    author: commentData.author,
    authorName: commentData.authorName,
    authorRole: commentData.authorRole,
    content: commentData.content,
    createdAt: new Date(),
    updatedAt: new Date(),
    reactions: [],
    replies: []
  };
  
  this.comments.push(comment);
  this.commentCount++;
  this.lastActivityAt = new Date();
  
  return await this.save();
};

communityPostSchema.methods.castVote = async function(userId, optionIndex) {
  if (!this.isPollActive) {
    throw new Error("Poll is not active");
  }
  
  // Check if user already voted
  const alreadyVoted = this.pollOptions.some(option => 
    option.voters.includes(userId)
  );
  
  if (alreadyVoted) {
    // Remove previous vote
    this.pollOptions.forEach(option => {
      const voterIndex = option.voters.indexOf(userId);
      if (voterIndex !== -1) {
        option.voters.splice(voterIndex, 1);
        option.votes--;
        this.totalVotes--;
      }
    });
  }
  
  // Add new vote
  if (optionIndex >= 0 && optionIndex < this.pollOptions.length) {
    const option = this.pollOptions[optionIndex];
    if (!option.voters.includes(userId)) {
      option.voters.push(userId);
      option.votes++;
      this.totalVotes++;
      if (!this.uniqueVoters.includes(userId)) {
        this.uniqueVoters.push(userId);
      }
    }
  }
  
  return await this.save();
};

// Indexes
communityPostSchema.index({ title: "text", content: "text", tags: "text" });
communityPostSchema.index({ author: 1, createdAt: -1 });
communityPostSchema.index({ isPinned: -1, createdAt: -1 });
communityPostSchema.index({ postType: 1, createdAt: -1 });
communityPostSchema.index({ tags: 1, createdAt: -1 });
communityPostSchema.index({ category: 1, createdAt: -1 });
communityPostSchema.index({ isArchived: 1, isDeleted: 1 });
communityPostSchema.index({ lastActivityAt: -1 });

const CommunityPost = mongoose.models.CommunityPost || mongoose.model("CommunityPost", communityPostSchema);

export default CommunityPost;
