import taskIntelligenceRoutes from "./routes/taskIntelligenceRoutes.js";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { attachRequestContext, requestLogger } from "./middleware/requestContext.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// routes
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/task.js";
import adminRoutes from "./routes/admin.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import noticeRoutes from "./routes/notice.routes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import Task from "./models/Task.js";
import Notice from "./models/Notice.js";
import User from "./models/User.js";

// bootstrap
import { bootstrapAdmin } from "./bootstrapAdmin.js";

dotenv.config();

const app = express();
// Disable ETag to avoid cross-session 304 reuse for role-scoped API payloads.
app.set("etag", false);

const REOPEN_SLA_DAYS = Number(process.env.REOPEN_SLA_DAYS || 3);
const REOPEN_SLA_CHECK_MINUTES = Number(process.env.REOPEN_SLA_CHECK_MINUTES || 60);
const MOD_REQUEST_SLA_CHECK_MINUTES = Number(process.env.MOD_REQUEST_SLA_CHECK_MINUTES || 60);

/* =======================
   MIDDLEWARE
======================= */
// Flexible CORS for development - accepts localhost on any port
const corsOrigin = (origin, callback) => {
  // Allow localhost on any port during development
  if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    callback(null, true);
  } else if (process.env.NODE_ENV === 'production') {
    // In production, use strict FRONTEND_URL
    const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
    callback(origin === allowedOrigin ? null : new Error('Not allowed by CORS'), origin === allowedOrigin);
  } else {
    callback(null, true);
  }
};

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(attachRequestContext);
app.use(requestLogger);

// Serve static uploads from repository-level /uploads directory
// (meetingRoutes writes files to ../../uploads/... from backend/routes)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* =======================
   TEST ROUTE (NO AUTH) - FOR DEBUGGING
======================= */
app.put("/api/tasks/__test__", (req, res) => {
  console.log("✅ __test__ route hit!");
  res.json({ 
    ok: true, 
    message: "Test route working", 
    timestamp: new Date().toISOString(),
    debug: "This proves routes are being registered"
  });
});

/* =======================
   HEALTH CHECK & INFO
======================= */
app.get("/api/health", (_req, res) => {
  res.json({ 
    ok: true, 
    time: new Date().toISOString(),
    service: "Task Management System API",
    version: "1.0.0",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/api/info", (_req, res) => {
  res.json({
    name: "Task Management System",
    description: "Complete task and employee management system with meetings",
    endpoints: {
      auth: "/api/auth",
      tasks: "/api/tasks",
      admin: "/api/admin",
      meetings: "/api/meetings",
      community: "/api/community",
      notices: "/api/notices"
    },
    features: [
      "Admin/Employee roles",
      "Task lifecycle management",
      "Employee permission system",
      "Audit logging",
      "Real-time communication",
      "Task modification requests (admin & employee initiated)",
      "Time extension requests",
      "Task archiving system",
      "Performance tracking & metrics",
      "Task reassignment",
      "Withdrawal & decline handling",
      "Meeting scheduling",
      "Team collaboration",
      "Calendar integration",
      "Failure intelligence analytics",
      "Performance snapshots",
      "Community feed & posts",
      "Admin notices system",
      "Image uploads for posts",
      "Like & comment system"
    ]
  });
});

/* =======================
   ROUTES
======================= */

// DEBUG: Log task routes import path
console.log("🔥 taskRoutes import resolved from:", path.join(__dirname, "routes/task.js"));

app.use("/api/auth", authRoutes);
app.use("/api/tasks/intelligence", taskIntelligenceRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/notifications", notificationRoutes);

/* =======================
   ROUTE DEBUGGING - CHECK REGISTERED ROUTES
   Enable only when ROUTE_DEBUG=true
======================= */
if (String(process.env.ROUTE_DEBUG || "").toLowerCase() === "true") {
  setTimeout(() => {
    console.log("\nREGISTERED EXPRESS ROUTES:");
  const rootRouter = app._router || app.router;

  if (rootRouter && rootRouter.stack) {
    const collectRoutes = (stack, acc = []) => {
      if (!Array.isArray(stack)) return acc;
      for (const layer of stack) {
        if (layer?.route?.path) {
          const methods = Object.keys(layer.route.methods || {});
          acc.push({
            method: methods[0]?.toUpperCase() || "UNKNOWN",
            path: layer.route.path
          });
          continue;
        }

        if (layer?.handle?.stack) {
          collectRoutes(layer.handle.stack, acc);
        }
      }
      return acc;
    };

    const routes = collectRoutes(rootRouter.stack, []);

    console.log("Total routes:", routes.length);
    console.log("\nAll registered routes:");
    routes.forEach((r, i) => {
      console.log(`${i + 1}. ${r.method} ${r.path}`);
    });

    const hasDirectEdit = routes.some(
      (r) => r.path.includes("direct-edit") || r.path.includes("/:id/direct-edit")
    );
    console.log("\nHas /direct-edit route?", hasDirectEdit ? "YES" : "NO");

    const hasTestRoute = routes.some((r) => r.path.includes("__test__"));
    console.log("Has __test__ route?", hasTestRoute ? "YES" : "NO");

    const keyRoutes = [
      "direct-edit",
      "direct-delete",
      "request-modification",
      "employee-request-modification",
      "request-extension",
      "archive",
      "reassign",
      "withdraw",
      "accept-reopen-decline",
      "performance",
      "intelligence/failures",
      "post/like",
      "post/:id/vote",
      "post/:id/comment"
    ];

    console.log("\nKey Route Availability:");
    keyRoutes.forEach((route) => {
      const exists = routes.some((r) => r.path.includes(route));
      console.log(`${exists ? "YES" : "NO"} /${route}`);
    });
  } else {
    console.log("Route stack is not exposed by current Express internals. API routes can still be active.");
  }
  }, 1500);
}

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "🚀 Task Management System Backend",
    documentation: "API endpoints available at /api/[auth|tasks|admin|meetings|community|notices]",
    health: "/api/health",
    info: "/api/info",
    features: {
      taskManagement: [
        "Create, edit, delete tasks",
        "Direct edit/delete (for unaccepted tasks)",
        "Modification requests (requires employee approval)",
        "Task archiving for completed tasks",
        "Task reassignment",
        "Withdrawal handling"
      ],
      employeeFeatures: [
        "Accept/decline tasks",
        "Start work & submit completions",
        "Request time extensions",
        "Withdraw from accepted tasks",
        "Respond to modification requests",
        "Initiate modification requests",
        "RSVP to meetings",
        "View action items"
      ],
      adminFeatures: [
        "Task oversight & review",
        "Verify/fail task submissions",
        "Reopen verified tasks",
        "Approve/reject extensions",
        "Handle modification requests",
        "Task reassignment",
        "Performance analytics",
        "Failure intelligence",
        "Performance snapshots",
        "Meeting management",
        "Schedule team meetings",
        "Send admin notices",
        "Community management"
      ],
      systemFeatures: [
        "Activity timeline tracking",
        "SLA monitoring",
        "Resolution tracking",
        "Edit history",
        "Discussion threads",
        "File attachments",
        "Meeting calendar",
        "RSVP tracking",
        "Action item management",
        "Community posts & polls",
        "Notice system",
        "Image uploads for community posts",
        "Like & comment system"
      ],
      analyticsFeatures: [
        "Performance snapshots by employee",
        "Failure intelligence patterns",
        "Late submission tracking",
        "No-response detection",
        "Reopen pattern analysis",
        "Decline pattern analysis",
        "SLA breach monitoring"
      ]
    }
  });
});

/* =======================
   404 + ERROR HANDLERS
======================= */
app.use(notFoundHandler);
app.use(errorHandler);

/* =======================
   DATABASE CONNECTION
======================= */
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/task-management";

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env file");
  console.log("📝 Please create a .env file with:");
  console.log("MONGO_URI=mongodb://localhost:27017/task-management");
  console.log("JWT_SECRET=your-secret-key-here");
  console.log("PORT=4000");
  console.log("FRONTEND_URL=http://localhost:3000");
  process.exit(1);
}

// Connection events
mongoose.connection.on('connecting', () => {
  console.log("🔄 Connecting to MongoDB...");
});

mongoose.connection.on('connected', () => {
  console.log("✅ MongoDB connected successfully");
});

mongoose.connection.on('error', (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on('disconnected', () => {
  console.log("⚠️ MongoDB disconnected");
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log("🛑 Received SIGINT signal");
  await mongoose.connection.close();
  console.log("👋 MongoDB connection closed");
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("🛑 Received SIGTERM signal");
  await mongoose.connection.close();
  console.log("👋 MongoDB connection closed");
  process.exit(0);
});

/* =======================
   SERVER STARTUP
======================= */
const startServer = async () => {
  try {
    console.log("🚀 Starting Task Management System...");
    console.log("📁 Environment:", process.env.NODE_ENV || "development");
    console.log("📄 Server file location:", __filename);
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log(`📊 Database connected: ${mongoose.connection.name}`);
    
    // Bootstrap admin user (only if doesn't exist)
    await bootstrapAdmin();
    console.log("👨‍💼 Admin user ready");
    
    // Start server
    const port = process.env.PORT || 4000;
    const server = app.listen(port, () => {
      console.log(`🌐 Server running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/api/health`);
      console.log(`🔗 API Info: http://localhost:${port}/api/info`);
      console.log(`📝 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
      console.log("=".repeat(50));
      console.log("✅ SYSTEM READY");
      console.log("=".repeat(50));
      console.log("\n🎯 Available Features:");
      console.log("  • Task CRUD with direct edit/delete");
      console.log("  • Modification request system (admin & employee)");
      console.log("  • Time extension requests");
      console.log("  • Task archiving");
      console.log("  • Task reassignment");
      console.log("  • Withdrawal & decline handling");
      console.log("  • Performance metrics & analytics");
      console.log("  • Failure intelligence");
      console.log("  • Performance snapshots");
      console.log("  • Meeting management");
      console.log("  • Community feed & posts");
      console.log("  • Admin notices system");
      console.log("  • Image uploads for posts (via /uploads/community/)");
      console.log("  • Like & comment system");
      console.log("  • Poll creation & voting");
      console.log("  • Activity timeline & audit logs");
      console.log("=".repeat(50));
    });

    const processReopenSlaTimeouts = async () => {
      try {
        const now = new Date();
        const overdue = await Task.find({
          status: "reopened",
          reopenDueAt: { $ne: null, $lte: now },
          reopenSlaStatus: { $ne: "timed_out" }
        }).populate("assignedTo", "name email");

        if (overdue.length === 0) return;

        const admins = await User.find({ role: "admin", status: "active" }).select("_id name email");

        for (const task of overdue) {
          task.reopenSlaStatus = "timed_out";
          task.reopenSlaBreachedAt = now;
          task.reopenDueAt = null;

          if (task.status === "reopened") {
            task.status = "verified";
          }

          task.activityTimeline.push({
            action: "TASK_REOPEN_TIMEOUT",
            role: "system",
            details: `Reopen response exceeded SLA of ${REOPEN_SLA_DAYS} day(s). Original work remains verified.`,
            timestamp: now
          });

          await task.save();

          if (admins.length > 0) {
            const sender = admins[0];
            const recipientIds = admins.map(a => a._id);

            await Notice.create({
              title: "Reopen SLA Breach",
              content: `Task "${task.title}" exceeded reopen SLA (${REOPEN_SLA_DAYS} days). The reopen request expired and the original work remains verified. Assigned to: ${task.assignedTo?.name || "Unknown"}.`,
              sender: sender._id,
              senderName: sender.name || "System",
              senderEmail: sender.email,
              createdBy: sender._id,
              targetType: "role",
              targetRole: "admin",
              priority: "high",
              category: "compliance",
              severity: "alert",
              status: "sent",
              totalRecipients: recipientIds.length,
              sentCount: recipientIds.length,
              recipients: recipientIds.map(userId => ({
                user: userId,
                read: false,
                acknowledged: false
              }))
            });
          }
        }
      } catch (err) {
        console.error("❌ Reopen SLA monitor error:", err);
      }
    };

    const processModificationRequestTimeouts = async () => {
      try {
        const now = new Date();
        const tasksWithExpiredRequests = await Task.find({
          "modificationRequests.status": "pending",
          "modificationRequests.expiresAt": { $lte: now }
        })
          .populate("modificationRequests.requestedBy", "name email role")
          .populate("assignedTo", "name email");

        if (tasksWithExpiredRequests.length === 0) return;

        for (const task of tasksWithExpiredRequests) {
          let updated = false;

          for (const request of task.modificationRequests) {
            if (request.status === "pending" && request.expiresAt && new Date(request.expiresAt) <= now) {
              request.status = "expired";
              request.expiredAt = now;
              request.response = {
                decision: "expired",
                note: "No response within SLA",
                respondedAt: now
              };

              task.activityTimeline.push({
                action: "MODIFICATION_EXPIRED",
                role: "system",
                details: `Modification request expired (${request.requestType}). Reason: ${request.reason}`,
                timestamp: now
              });

              updated = true;

              const requester = request.requestedBy;
              const requesterId = requester?._id || requester;
              if (requesterId) {
                await Notice.create({
                  title: "Modification Request Expired",
                  content: `Your modification request for task "${task.title}" expired without employee response.`,
                  sender: requesterId,
                  senderName: requester.name || "Admin",
                  senderEmail: requester.email,
                  createdBy: requesterId,
                  targetType: "specific",
                  specificUsers: [requesterId],
                  priority: "high",
                  category: "compliance",
                  severity: "warning",
                  status: "sent",
                  totalRecipients: 1,
                  sentCount: 1,
                  recipients: [{
                    user: requesterId,
                    userEmail: requester.email,
                    userName: requester.name,
                    userRole: requester.role || "admin",
                    delivered: true,
                    deliveredAt: now,
                    deliveryMethod: "in_app",
                    read: false,
                    acknowledged: false
                  }]
                });
              }
            }
          }

          if (updated) {
            await task.save();
          }
        }
      } catch (err) {
        console.error("❌ Modification request SLA monitor error:", err);
      }
    };

    // Start SLA monitor
    setInterval(processReopenSlaTimeouts, REOPEN_SLA_CHECK_MINUTES * 60 * 1000);
    setInterval(processModificationRequestTimeouts, MOD_REQUEST_SLA_CHECK_MINUTES * 60 * 1000);
    processReopenSlaTimeouts();
    processModificationRequestTimeouts();

    // Server error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        console.log(`💡 Try changing PORT in .env file or run: kill -9 $(lsof -t -i:${port})`);
        process.exit(1);
      } else {
        console.error("❌ Server error:", error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    console.log("\n🔧 Troubleshooting tips:");
    console.log("1. Check MongoDB is running: mongod");
    console.log("2. Verify .env file has correct MONGO_URI");
    console.log("3. Ensure port 4000 is free");
    console.log("4. Create uploads directory: mkdir -p uploads/community");
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;


