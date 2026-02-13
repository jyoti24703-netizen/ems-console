import express from "express";
import Task from "../models/Task.js";
import { verifyJWT, requireCapability } from "../middleware/auth.js";

const router = express.Router();

/* =====================================================
   GET FAILURE INTELLIGENCE
   Analyzes patterns in failed tasks
===================================================== */
router.get("/failures", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    // Only admins can access intelligence
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { timeframe = 30 } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    // Get all failed tasks in timeframe
    const failedTasks = await Task.find({
      status: "failed",
      "statusHistory.timestamp": { $gte: startDate }
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 });

    // Analyze failure patterns
    const patterns = {
      totalFailures: failedTasks.length,
      byEmployee: {},
      byReason: {},
      lateSubmissions: 0,
      qualityIssues: 0,
      averageTimeToFailure: 0
    };

    failedTasks.forEach(task => {
      // By employee
      const empId = task.assignedTo?._id?.toString();
      const empName = task.assignedTo?.name || "Unknown";
      if (empId) {
        if (!patterns.byEmployee[empId]) {
          patterns.byEmployee[empId] = {
            name: empName,
            count: 0,
            tasks: []
          };
        }
        patterns.byEmployee[empId].count++;
        patterns.byEmployee[empId].tasks.push({
          title: task.title,
          failedAt: task.updatedAt
        });
      }

      // By reason (from failure comment)
      const failureEvent = task.statusHistory.find(h => h.status === "failed");
      const reason = failureEvent?.comment || "No reason provided";
      patterns.byReason[reason] = (patterns.byReason[reason] || 0) + 1;

      // Late submissions
      if (task.deadline && task.submittedAt && new Date(task.submittedAt) > new Date(task.deadline)) {
        patterns.lateSubmissions++;
      }
    });

    // Convert byEmployee object to array and sort
    patterns.byEmployeeArray = Object.entries(patterns.byEmployee)
      .map(([id, data]) => ({ employeeId: id, ...data }))
      .sort((a, b) => b.count - a.count);

    // Convert byReason to array
    patterns.byReasonArray = Object.entries(patterns.byReason)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      timeframe: parseInt(timeframe),
      patterns,
      tasks: failedTasks.slice(0, 10) // Last 10 failures
    });

  } catch (err) {
    console.error("Get failure intelligence error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Server error",
      message: err.message 
    });
  }
});

/* =====================================================
   GET PERFORMANCE METRICS
===================================================== */
router.get("/performance", verifyJWT, requireCapability("view_analytics"), async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { employeeId, timeframe = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    let query = {
      createdAt: { $gte: startDate }
    };

    if (employeeId) {
      query.assignedTo = employeeId;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email");

    // Calculate metrics
    const metrics = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === "verified").length,
      inProgress: tasks.filter(t => ["accepted", "in_progress"].includes(t.status)).length,
      failed: tasks.filter(t => t.status === "failed").length,
      pending: tasks.filter(t => t.status === "pending").length,
      onTime: 0,
      late: 0,
      averageCompletionTime: 0
    };

    // Calculate on-time vs late
    tasks.forEach(task => {
      if (task.status === "verified" && task.deadline && task.submittedAt) {
        if (new Date(task.submittedAt) <= new Date(task.deadline)) {
          metrics.onTime++;
        } else {
          metrics.late++;
        }
      }
    });

    // Success rate
    metrics.successRate = metrics.total > 0 
      ? ((metrics.completed / metrics.total) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      timeframe: parseInt(timeframe),
      metrics,
      taskCount: tasks.length
    });

  } catch (err) {
    console.error("Get performance metrics error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Server error",
      message: err.message 
    });
  }
});

/* =====================================================
   GET LATE SUBMISSIONS ANALYSIS
===================================================== */
router.get("/late-submissions", verifyJWT, async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { timeframe = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    const lateTasks = await Task.find({
      status: { $in: ["verified", "submitted"] },
      submittedAt: { $exists: true },
      deadline: { $exists: true },
      createdAt: { $gte: startDate }
    })
      .populate("assignedTo", "name email")
      .sort({ submittedAt: -1 });

    // Filter for actually late tasks
    const actuallyLate = lateTasks.filter(task => 
      new Date(task.submittedAt) > new Date(task.deadline)
    );

    // Calculate delay statistics
    const delayStats = {
      total: actuallyLate.length,
      byEmployee: {},
      averageDelayHours: 0
    };

    let totalDelayHours = 0;

    actuallyLate.forEach(task => {
      const delayMs = new Date(task.submittedAt) - new Date(task.deadline);
      const delayHours = delayMs / (1000 * 60 * 60);
      totalDelayHours += delayHours;

      const empId = task.assignedTo?._id?.toString();
      const empName = task.assignedTo?.name || "Unknown";
      
      if (empId) {
        if (!delayStats.byEmployee[empId]) {
          delayStats.byEmployee[empId] = {
            name: empName,
            count: 0,
            totalDelayHours: 0
          };
        }
        delayStats.byEmployee[empId].count++;
        delayStats.byEmployee[empId].totalDelayHours += delayHours;
      }
    });

    delayStats.averageDelayHours = actuallyLate.length > 0
      ? (totalDelayHours / actuallyLate.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      timeframe: parseInt(timeframe),
      stats: delayStats,
      tasks: actuallyLate.slice(0, 20)
    });

  } catch (err) {
    console.error("Get late submissions error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Server error",
      message: err.message 
    });
  }
});

/* =====================================================
   GET REOPEN PATTERNS
===================================================== */
router.get("/reopens", verifyJWT, async (req, res) => {
  try {
    if (!["admin","superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { timeframe = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    // Find tasks that were reopened
    const reopenedTasks = await Task.find({
      "statusHistory.status": "reopened",
      createdAt: { $gte: startDate }
    })
      .populate("assignedTo", "name email")
      .sort({ updatedAt: -1 });

    const patterns = {
      total: reopenedTasks.length,
      byEmployee: {},
      byReason: {}
    };

    reopenedTasks.forEach(task => {
      // By employee
      const empId = task.assignedTo?._id?.toString();
      const empName = task.assignedTo?.name || "Unknown";
      
      if (empId) {
        patterns.byEmployee[empId] = patterns.byEmployee[empId] || {
          name: empName,
          count: 0
        };
        patterns.byEmployee[empId].count++;
      }

      // By reason
      const reopenEvent = task.statusHistory
        .reverse()
        .find(h => h.status === "reopened");
      
      const reason = reopenEvent?.comment || "No reason provided";
      patterns.byReason[reason] = (patterns.byReason[reason] || 0) + 1;
    });

    res.json({
      success: true,
      timeframe: parseInt(timeframe),
      patterns,
      tasks: reopenedTasks.slice(0, 10)
    });

  } catch (err) {
    console.error("Get reopen patterns error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Server error",
      message: err.message 
    });
  }
});

export default router;
