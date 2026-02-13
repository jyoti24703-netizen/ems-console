import express from "express";
import { verifyJWT } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = express.Router();

/* =======================
   GET MY NOTIFICATIONS
======================= */
router.get("/", verifyJWT, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    let notifications = await Notification.find({
      user: req.user.id,
      isArchived: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Admin isolation guard: hide legacy cross-admin performance-review comment notifications.
    if (req.user.role === "admin") {
      const ownedEmployees = await User.find({
        role: "employee",
        createdBy: req.user.id
      }).select("_id");

      const ownedEmployeeIds = new Set(ownedEmployees.map((e) => String(e._id)));
      const performanceKinds = new Set([
        "employee_review_comment",
        "manager_review_reply",
        "performance_review",
        "performance_review_updated",
        "performance_review_deleted"
      ]);

      notifications = notifications.filter((n) => {
        const kind = n?.data?.extra?.kind;
        if (!performanceKinds.has(kind)) return true;
        const employeeId = n?.data?.extra?.employeeId;
        if (!employeeId) return false;
        return ownedEmployeeIds.has(String(employeeId));
      });
    }

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
