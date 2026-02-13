import express from "express";
import CommunityPost from "../models/Community.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { verifyJWT, requireCapability } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const ALLOWED_POST_TYPES = new Set([
  "announcement",
  "discussion",
  "question",
  "update",
  "poll",
  "celebration",
  "help",
  "idea",
  "status"
]);

const getActivePostFilter = () => {
  const now = new Date();
  return {
    $or: [
      { postType: { $ne: "status" } },
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: now } }
    ]
  };
};

const resolveWorkspaceUserIds = async (currentUser) => {
  if (currentUser?.role === "superadmin") return null;

  let workspaceAdminId = currentUser?.id;
  if (currentUser?.role === "employee") {
    const actor = await User.findById(currentUser.id).select("createdBy").lean();
    workspaceAdminId = actor?.createdBy ? actor.createdBy.toString() : currentUser.id;
  }

  const users = await User.find({
    $or: [
      { _id: workspaceAdminId },
      { createdBy: workspaceAdminId }
    ]
  }).select("_id").lean();

  const ids = new Set(users.map((u) => u._id.toString()));
  ids.add(String(currentUser.id));
  return Array.from(ids);
};

const canAccessPostInWorkspace = async (post, currentUser) => {
  if (!post) return false;
  const workspaceIds = await resolveWorkspaceUserIds(currentUser);
  if (!workspaceIds) return true;
  return workspaceIds.includes(String(post.author));
};

// ==================== MULTER CONFIGURATION FOR IMAGE UPLOAD ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
import fs from "fs";
const uploadDir = path.join(__dirname, '../../uploads/community');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // ✅ FIXED: Increased from 5MB to 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/jfif', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

// Model uses full schema from ../models/Community.js

/* =======================
   GET COMMUNITY FEED
======================= */
router.get("/feed", verifyJWT, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const { page = 1, limit = 20, filter = "all" } = req.query;
    
    let query = { isArchived: { $ne: true }, isDeleted: { $ne: true }, ...getActivePostFilter() };
    const workspaceUserIds = await resolveWorkspaceUserIds(req.user);
    if (workspaceUserIds) {
      query.author = { $in: workspaceUserIds };
    }
    
    if (filter === "announcements") {
      query.postType = "announcement";
    } else if (filter === "polls") {
      query.postType = "poll";
    } else if (filter === "pinned") {
      query.isPinned = true;
    }
    
    const posts = await CommunityPost.find(query)
      .populate("author", "name email role")
      .populate("mentions", "name email role")
      .populate("comments.author", "name email role")
      .populate("comments.replies.author", "name email role")
      .populate("pollOptions.voters", "name email")
      .populate("likes", "name email")
      .sort({ isPinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const totalPosts = await CommunityPost.countDocuments(query);
    
    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPosts,
        pages: Math.ceil(totalPosts / limit)
      }
    });
  } catch (err) {
    console.error("Get community feed error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   GET USERS FOR MENTIONS
======================= */
router.get("/users", verifyJWT, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const workspaceUserIds = await resolveWorkspaceUserIds(req.user);
    const usersFilter = { status: "active" };
    if (workspaceUserIds) {
      usersFilter._id = { $in: workspaceUserIds };
    }
    const users = await User.find(usersFilter)
      .select("name email role")
      .sort({ name: 1 })
      .limit(200);
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get community users error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   CREATE POST WITH IMAGE UPLOAD
======================= */
router.post("/post", verifyJWT, upload.array('images', 5), async (req, res) => {
  try {
    const { title, content, postType, type, pollQuestion, pollOptions, pollEndDate, tags, poll } = req.body;
    const resolvedPostType = postType || type || "discussion";
    if (!ALLOWED_POST_TYPES.has(resolvedPostType)) {
      return res.status(400).json({ success: false, error: "Invalid post type" });
    }
    if (resolvedPostType === "announcement" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can create announcements" });
    }
    
    let pollPayload = null;
    if (poll) {
      try {
        pollPayload = typeof poll === "string" ? JSON.parse(poll) : poll;
      } catch (_err) {
        pollPayload = null;
      }
    }
    
    // ✅ FIXED: Only check title (content can be optional for polls/images)
    if (!title || !title.trim()) {
      return res.status(400).json({
        error: "Title is required"
      });
    }
    
    let tagsArray = [];
    if (tags) {
      try {
        tagsArray = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (_err) {
        tagsArray = [];
      }
    }
    const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const normalizeMentionKey = (value = "") =>
      value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const extractMentions = (text) => {
      if (!text) return [];
      const matches = text.match(/@([a-zA-Z0-9_.-]+)/g) || [];
      return Array.from(new Set(matches.map(m => m.slice(1).toLowerCase())));
    };

    const postData = {
      title: title.trim(),
      content: content?.trim() || "",
      author: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      postType: resolvedPostType,
      tags: tagsArray,
      likes: [],
      mentions: [],
      comments: [],
      isDeleted: false // ✅ NEW
    };

    if (resolvedPostType === "status") {
      postData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    
    // Handle image uploads
    if (req.files && req.files.length > 0) {
      postData.images = req.files.map(file => ({
        url: `/uploads/community/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      }));
    }
    
    // Handle poll creation
    if (resolvedPostType === "poll") {
      const resolvedPollQuestion = pollQuestion || pollPayload?.question;
      let optionsArray = null;
      
      if (pollOptions) {
        try {
          optionsArray = typeof pollOptions === "string" ? JSON.parse(pollOptions) : pollOptions;
        } catch (_err) {
          optionsArray = null;
        }
      } else if (pollPayload?.options) {
        optionsArray = pollPayload.options.map(opt => (typeof opt === "string" ? opt : opt.text));
      }
      
      if (!resolvedPollQuestion || !optionsArray) {
        return res.status(400).json({
          error: "Poll question and options are required"
        });
      }
      
      if (optionsArray.length < 2) {
        return res.status(400).json({
          error: "Poll must have at least 2 options"
        });
      }
      
      postData.pollQuestion = resolvedPollQuestion;
      postData.pollOptions = optionsArray.map(option => ({
        text: typeof option === "string" ? option : option?.text,
        votes: 0,
        voters: []
      }));
      
      const resolvedPollEndDate = pollEndDate || pollPayload?.expiresAt;
      if (resolvedPollEndDate) {
        postData.pollEndDate = new Date(resolvedPollEndDate);
      }
    }
    
    const mentionTokens = extractMentions(`${postData.title} ${postData.content}`);
    if (mentionTokens.length > 0) {
      const workspaceUserIds = await resolveWorkspaceUserIds(req.user);
      const usersFilter = { status: "active" };
      if (workspaceUserIds) {
        usersFilter._id = { $in: workspaceUserIds };
      }
      const activeUsers = await User.find(usersFilter).select("_id name email");
      const mentionUsers = activeUsers.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const normalizedName = normalizeMentionKey(name);
        const normalizedEmail = normalizeMentionKey(email);
        const parts = name.split(/\s+/).map(normalizeMentionKey).filter(Boolean);
        return mentionTokens.some((token) => {
          const t = normalizeMentionKey(token);
          if (!t) return false;
          if (name.startsWith(token) || email.startsWith(token)) return true;
          if (normalizedName.startsWith(t) || normalizedEmail.startsWith(t)) return true;
          if (parts.some((p) => p.startsWith(t))) return true;
          const tokenRegex = new RegExp(`\\b${escapeRegex(token)}`, "i");
          return tokenRegex.test(name) || tokenRegex.test(email);
        });
      });
      postData.mentions = Array.from(new Set(mentionUsers.map(u => u._id.toString())));
    }

    const post = await CommunityPost.create(postData);

    if (post.mentions && post.mentions.length > 0) {
      const uniqueMentionIds = post.mentions
        .map(id => id.toString())
        .filter(id => id !== req.user.id);
      await Promise.all(uniqueMentionIds.map(userId => (
        Notification.create({
          user: userId,
          type: "mention",
          title: "You were mentioned in Community",
          message: `${req.user.name} mentioned you: ${post.title}`,
          data: { extra: { postId: post._id } },
          priority: "medium"
        })
      )));
    }
    
    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post
    });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

/* =======================
   LIKE A POST
======================= */
router.post("/post/:id/like", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    const index = post.likes.indexOf(req.user.id);
    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(req.user.id);
    }
    
    await post.save();
    
    res.json({
      success: true,
      liked: index === -1,
      likeCount: post.likes.length
    });
  } catch (err) {
    console.error("Like post error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   ADD COMMENT TO POST - ✅ FIXED PARAMETER BUG
======================= */
router.post("/post/:id/comment", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params; // ✅ FIXED: Changed postId to id
    const { text, content } = req.body;
    const commentText = (content || text || "").trim();
    
    if (!commentText) {
      return res.status(400).json({ error: "Comment text is required" });
    }
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    const comment = {
      author: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      content: commentText,
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: [],
      replies: []
    };
    
    if (!post.comments) post.comments = [];
    post.comments.push(comment);
    post.commentCount = post.comments.length; // ✅ NEW: Track comment count
    
    await post.save();
    
    const updatedPost = await CommunityPost.findById(id)
      .populate("comments.author", "name email role");
    
    res.json({
      success: true,
      message: "Comment added",
      comment: updatedPost.comments[updatedPost.comments.length - 1]
    });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   ✅ NEW: REPLY TO COMMENT
======================= */
router.post("/post/:id/comment/:commentId/reply", verifyJWT, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Reply text is required" });
    }
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    
    const reply = {
      author: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      text: text.trim(),
      createdAt: new Date()
    };
    
    if (!comment.replies) comment.replies = [];
    comment.replies.push(reply);
    
    await post.save();
    
    res.json({
      success: true,
      message: "Reply added",
      reply
    });
  } catch (err) {
    console.error("Add reply error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   VOTE ON POLL - ✅ FIXED PARAMETER BUG
======================= */
router.post("/post/:id/vote", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params; // ✅ FIXED: Changed postId to id
    const { optionIndex } = req.body;
    
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ error: "Option index is required" });
    }
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Poll not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    if (post.postType !== "poll") {
      return res.status(400).json({ error: "This is not a poll" });
    }
    
    if (post.pollEndDate && new Date() > new Date(post.pollEndDate)) {
      return res.status(400).json({ error: "This poll has ended" });
    }
    
    let alreadyVoted = false;
    let votedOptionIndex = -1;
    
    if (post.pollOptions) {
      post.pollOptions.forEach((option, index) => {
        if (option.voters && option.voters.includes(req.user.id)) {
          alreadyVoted = true;
          votedOptionIndex = index;
        }
      });
    }
    
    if (alreadyVoted) {
      if (votedOptionIndex !== -1 && post.pollOptions[votedOptionIndex]) {
        const voterIndex = post.pollOptions[votedOptionIndex].voters.indexOf(req.user.id);
        if (voterIndex !== -1) {
          post.pollOptions[votedOptionIndex].voters.splice(voterIndex, 1);
          post.pollOptions[votedOptionIndex].votes--;
        }
      }
    }
    
    if (optionIndex >= 0 && optionIndex < post.pollOptions.length) {
      const option = post.pollOptions[optionIndex];
      if (!option.voters) option.voters = [];
      if (!option.voters.includes(req.user.id)) {
        option.voters.push(req.user.id);
        option.votes = (option.votes || 0) + 1;
      }
    } else {
      return res.status(400).json({ error: "Invalid option index" });
    }
    
    await post.save();
    
    res.json({
      success: true,
      message: alreadyVoted ? "Vote changed" : "Vote recorded",
      pollResults: post.pollResultsVisible ? post.pollOptions : null,
      totalVotes: post.pollOptions ? post.pollOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0) : 0,
      userVotedFor: optionIndex
    });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   ADD REACTION TO POST
======================= */
router.post("/:postId/react", verifyJWT, async (req, res) => {
  try {
    const { postId } = req.params;
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }
    
    const post = await CommunityPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    const index = post.likes.indexOf(req.user.id);
    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(req.user.id);
    }
    
    await post.save();
    
    res.json({
      success: true,
      message: index === -1 ? "Liked" : "Unliked",
      likeCount: post.likes.length
    });
  } catch (err) {
    console.error("React to post error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   PIN/UNPIN POST (Admin only) - ✅ FIXED PARAMETER
======================= */
router.patch("/post/:id/pin", verifyJWT, requireCapability("manage_community"), async (req, res) => {
  try {
    const { id } = req.params; // ✅ FIXED: postId → id
    const { pinned } = req.body;
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    post.isPinned = pinned === true;
    await post.save();
    
    res.json({
      success: true,
      message: post.isPinned ? "Post pinned" : "Post unpinned",
      post: {
        id: post._id,
        title: post.title,
        isPinned: post.isPinned
      }
    });
  } catch (err) {
    console.error("Pin post error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   DELETE POST (author only)
======================= */
router.delete("/post/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (!(await canAccessPostInWorkspace(post, req.user))) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    const isAuthor = post.author.toString() === req.user.id;
    if (!isAuthor) {
      return res.status(403).json({ error: "Not authorized to delete this post" });
    }
    
    // ✅ IMPROVED: Soft delete with metadata
    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletedBy = req.user.id;
    await post.save();
    
    res.json({
      success: true,
      message: "Post deleted successfully"
    });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================
   SEARCH POSTS
======================= */
router.get("/search", verifyJWT, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const { q, type, tag } = req.query;
    
    let query = { isArchived: { $ne: true }, isDeleted: { $ne: true }, ...getActivePostFilter() };
    const workspaceUserIds = await resolveWorkspaceUserIds(req.user);
    if (workspaceUserIds) {
      query.author = { $in: workspaceUserIds };
    }
    
    if (q) {
      query.$and = [{
        $or: [
          { title: { $regex: q, $options: "i" } },
          { content: { $regex: q, $options: "i" } },
          { tags: { $regex: q, $options: "i" } }
        ]
      }];
    }
    
    if (type && !ALLOWED_POST_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: "Invalid post type filter" });
    }

    if (type) {
      query.postType = type;
    }
    
    if (tag) {
      query.tags = tag;
    }
    
    const posts = await CommunityPost.find(query)
      .populate("author", "name email role")
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      posts,
      count: posts.length,
      query: { q, type, tag }
    });
  } catch (err) {
    console.error("Search posts error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;



