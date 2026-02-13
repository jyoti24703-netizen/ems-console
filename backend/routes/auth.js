import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { verifyJWT, requireAdmin } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const allowPublicAdminSignup = process.env.ALLOW_PUBLIC_ADMIN_SIGNUP
  ? String(process.env.ALLOW_PUBLIC_ADMIN_SIGNUP).toLowerCase() === "true"
  : true;

const setupStatusLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "auth:setup",
  message: "Too many setup status checks. Please retry in a minute."
});

const registerLimiter = createRateLimiter({
  windowMs: 5 * 60_000,
  max: 10,
  keyPrefix: "auth:register",
  message: "Too many registration attempts. Please retry later."
});

const loginLimiter = createRateLimiter({
  windowMs: 5 * 60_000,
  max: 25,
  keyPrefix: "auth:login",
  message: "Too many login attempts. Please retry later."
});

router.get("/setup-status", setupStatusLimiter, async (_req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: "admin" });
    return res.json({
      success: true,
      requiresAdminSetup: adminCount === 0,
      adminCount,
      allowPublicAdminSignup
    });
  } catch (error) {
    console.error("SETUP STATUS ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ----------------------------------------------------
   REGISTER USER
   Allowed cases:
   1) If NO users exist ? allow create FIRST ADMIN
   2) If users exist ? only ADMIN can register employees
---------------------------------------------------- */
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let creatorAdminId = null;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email, and password are required" });

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already registered" });

    const adminCount = await User.countDocuments({ role: "admin" });
    const isFirstAdminSetup = adminCount === 0;

    if (isFirstAdminSetup) {
      if (role && role !== "admin") {
        return res.status(400).json({ error: "First account must be an admin" });
      }
    } else if (allowPublicAdminSignup && role === "admin") {
      // Demo mode only: allow additional public admin signup.
      // Keep this OFF in production unless explicitly needed.
    } else {
      // After bootstrap ? must be admin
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Admin token required" });
      }

      try {
        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!["admin", "superadmin"].includes(decoded.role)) {
          return res.status(403).json({ error: "Only admin can create employees" });
        }
        creatorAdminId = decoded.id;
      } catch (err) {
        return res.status(401).json({ error: "Invalid admin token" });
      }
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashed,
      role: (isFirstAdminSetup || (allowPublicAdminSignup && role === "admin")) ? "admin" : "employee",
      createdBy: creatorAdminId
    });

    return res.status(201).json({
      message: newUser.role === "admin" ? "Admin created successfully" : "Employee created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ----------------------------------------------------
   LOGIN USER (Admin or Employee)
---------------------------------------------------- */
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        performanceReview: user.performanceReview || null
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ----------------------------------------------------
   CURRENT USER PROFILE
---------------------------------------------------- */
router.get("/me", verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true, user });
  } catch (error) {
    console.error("GET /me ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

const getLatestActivePerformanceReviewEntry = (userDoc) => {
  const history = Array.isArray(userDoc?.performanceReviewHistory)
    ? userDoc.performanceReviewHistory.filter((entry) => !entry.isDeleted)
    : [];
  if (history.length === 0) return null;
  return history.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0];
};

router.patch("/performance-review/acknowledge", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ success: false, error: "Employee access required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const currentReview = user.performanceReview || {};
    if (!currentReview.title && !currentReview.note) {
      return res.status(400).json({ success: false, error: "No active manager review to acknowledge" });
    }

    if (!currentReview.acknowledgedByEmployee) {
      const acknowledgedAt = new Date();
      user.performanceReview.acknowledgedByEmployee = true;
      user.performanceReview.acknowledgedAt = acknowledgedAt;

      const latestEntry = getLatestActivePerformanceReviewEntry(user);
      if (latestEntry) {
        latestEntry.acknowledgedByEmployee = true;
        latestEntry.acknowledgedAt = acknowledgedAt;
      }

      await user.save();
    }

    return res.json({
      success: true,
      message: "Review acknowledged",
      performanceReview: user.performanceReview
    });
  } catch (error) {
    console.error("Acknowledge performance review error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/performance-review/comment", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ success: false, error: "Employee access required" });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ success: false, error: "Comment text is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const currentReview = user.performanceReview || {};
    if (!currentReview.title && !currentReview.note) {
      return res.status(400).json({ success: false, error: "No active manager review to comment on" });
    }

    const comment = {
      text,
      commentedAt: new Date(),
      commentedBy: user._id,
      commentedByRole: user.role || "employee",
      commentedByName: user.name || user.email || "Employee"
    };

    if (!Array.isArray(user.performanceReview.employeeComments)) {
      user.performanceReview.employeeComments = [];
    }
    user.performanceReview.employeeComments.push(comment);

    const latestEntry = getLatestActivePerformanceReviewEntry(user);
    if (latestEntry) {
      if (!Array.isArray(latestEntry.employeeComments)) {
        latestEntry.employeeComments = [];
      }
      latestEntry.employeeComments.push(comment);
    }

    await user.save();

    try {
      // Tenant-like scoping: notify only the owning admin (creator) and superadmins.
      const notifyUserIds = new Set();
      if (user.createdBy) {
        notifyUserIds.add(String(user.createdBy));
      }

      const superAdmins = await User.find({
        role: "superadmin",
        status: "active"
      }).select("_id");

      superAdmins.forEach((u) => notifyUserIds.add(String(u._id)));

      await Promise.all(
        [...notifyUserIds].map((recipientId) =>
          Notification.createNotification({
            user: recipientId,
            type: "general",
            title: "Employee review comment",
            message: `${user.name || user.email} added a comment to manager review.`,
            priority: "medium",
            data: {
              extra: {
                kind: "employee_review_comment",
                employeeId: user._id,
                preview: text.slice(0, 120)
              }
            },
            metadata: { source: "performance_review_comment" }
          })
        )
      );
    } catch (notifyErr) {
      console.error("Employee review comment notification error:", notifyErr);
    }

    return res.status(201).json({
      success: true,
      message: "Comment added",
      performanceReview: user.performanceReview
    });
  } catch (error) {
    console.error("Performance review comment error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.patch("/performance-review/hide", verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ success: false, error: "Employee access required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const currentReview = user.performanceReview || {};
    if (!currentReview.title && !currentReview.note) {
      return res.status(400).json({ success: false, error: "No active manager review to hide" });
    }
    if (!currentReview.acknowledgedByEmployee) {
      return res.status(400).json({ success: false, error: "Acknowledge review before hiding it from dashboard" });
    }

    if (!currentReview.hiddenByEmployee) {
      const hiddenAt = new Date();
      user.performanceReview.hiddenByEmployee = true;
      user.performanceReview.hiddenAt = hiddenAt;

      const latestEntry = getLatestActivePerformanceReviewEntry(user);
      if (latestEntry) {
        latestEntry.hiddenByEmployee = true;
        latestEntry.hiddenAt = hiddenAt;
      }

      await user.save();
    }

    return res.json({
      success: true,
      message: "Review hidden from dashboard",
      performanceReview: user.performanceReview
    });
  } catch (error) {
    console.error("Hide performance review error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;


