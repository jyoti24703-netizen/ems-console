import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const ADMIN_CAPABILITIES = [
  "view_employee_insights",
  "manage_employees",
  "manage_tasks",
  "manage_reviews",
  "manage_requests",
  "manage_notices",
  "manage_community",
  "manage_meetings",
  "view_analytics",
  "manage_notification_policy",
  "view_audit_log",
  "export_audit_log"
];

export const isAdminRole = (role) => role === "admin" || role === "superadmin";

export const getCapabilitiesForUser = (user) => {
  if (!user) return [];
  if (user.role === "superadmin") return [...ADMIN_CAPABILITIES];
  if (user.role !== "admin") return [];
  if (Array.isArray(user.adminCapabilities) && user.adminCapabilities.length > 0) {
    return user.adminCapabilities;
  }
  // Backward compatibility for existing admins.
  return [...ADMIN_CAPABILITIES];
};

/* ============================
   VERIFY JWT (ALL ROLES)
============================ */
export const verifyJWT = async (req, res, next) => {
  try {
    // Authenticated API responses must not be cached across users.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authorization header required"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Invalid token format. Must be: Bearer <token>"
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token || token.trim() === "") {
      return res.status(401).json({
        success: false,
        error: "Token cannot be empty"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, error: "Token expired" });
      }
      if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({ success: false, error: "Invalid token" });
      }
      return res.status(401).json({ success: false, error: "Token verification failed" });
    }

    const dbUser = await User.findById(decoded.id).select("-password");
    if (!dbUser) {
      return res.status(401).json({
        success: false,
        error: "User account no longer exists"
      });
    }

    if (dbUser.status !== "active") {
      return res.status(401).json({
        success: false,
        error: "User account is not active"
      });
    }

    req.user = {
      id: dbUser._id.toString(),
      role: dbUser.role,
      email: dbUser.email,
      name: dbUser.name,
      status: dbUser.status,
      adminCapabilities: dbUser.adminCapabilities || [],
      capabilities: getCapabilitiesForUser(dbUser)
    };

    next();
  } catch (_err) {
    return res.status(401).json({
      success: false,
      error: "Authentication failed"
    });
  }
};

/* ============================
   REQUIRE ADMIN ROLE
============================ */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }

  if (!isAdminRole(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: "Admin privileges required"
    });
  }

  next();
};

export const requireCapability = (capability) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Admin privileges required"
      });
    }

    const capabilities = req.user.capabilities || [];
    if (!capabilities.includes(capability)) {
      return res.status(403).json({
        success: false,
        error: `Missing capability: ${capability}`
      });
    }

    next();
  };
};
