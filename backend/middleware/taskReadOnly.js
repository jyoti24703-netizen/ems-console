import Task from "../models/Task.js";

/* =====================================================
   UNIVERSAL TASK WRITE-GUARD
   Blocks any write operation on CLOSED tasks
===================================================== */
export const blockIfTaskClosed = async (req, res, next) => {
  try {
    const taskId = req.params.id;

    if (!taskId || taskId.length !== 24) {
      return res.status(400).json({ error: "Invalid task id" });
    }

    const task = await Task.findById(taskId).select("status");

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // 🔴 FIXED: Added deleted and withdrawn to closed states
    const CLOSED_STATES = ["verified", "failed", "deleted", "withdrawn"];

    if (CLOSED_STATES.includes(task.status)) {
      return res.status(403).json({
        error: "This task is closed and read-only",
        status: task.status,
      });
    }

    next();
  } catch (err) {
    console.error("blockIfTaskClosed error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};