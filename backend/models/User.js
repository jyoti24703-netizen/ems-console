import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    /**
     * Role hierarchy:
     * - superadmin : system owner (created once via setup)
     * - admin      : managers / HR who can create employees and admins (with limits)
     * - employee   : regular user
     */
    role: {
      type: String,
      enum: ["superadmin", "admin", "employee"],
      default: "employee",
    },

    /**
     * Scoped admin capabilities for enterprise governance.
     * Empty means "default role capabilities" from middleware.
     */
    adminCapabilities: [
      {
        type: String,
        enum: [
          "view_employee_insights",
          "manage_employees",
          "manage_tasks",
          "manage_reviews",
          "manage_requests",
          "manage_notices",
          "manage_meetings",
          "view_analytics",
          "manage_notification_policy",
          "view_audit_log",
          "export_audit_log"
        ]
      }
    ],

    /**
     * Account status: active | suspended | disabled
     * - active: normal use
     * - suspended: temporarily blocked (cannot login)
     * - disabled: soft-deleted / removed (keeps record)
     */
    status: {
      type: String,
      enum: ["active", "suspended", "disabled"],
      default: "active",
    },

    /**
     * createdBy: reference to the User who created this account (optional).
     * For the first superadmin this will be null.
     */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    /**
     * metadata for audit & governance
     */
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastModifiedAt: { type: Date, default: Date.now },
    // optional flags
    emailVerified: { type: Boolean, default: false },

    /**
     * Performance evaluation review (admin-only write, employee read)
     */
    performanceReview: {
      title: { type: String, default: "" },
      note: { type: String, default: "" },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      acknowledgedByEmployee: { type: Boolean, default: false },
      acknowledgedAt: { type: Date, default: null },
      hiddenByEmployee: { type: Boolean, default: false },
      hiddenAt: { type: Date, default: null },
      employeeComments: [
        {
          text: { type: String, default: "" },
          commentedAt: { type: Date, default: Date.now },
          commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          commentedByRole: { type: String, enum: ["admin", "superadmin", "employee"], default: "employee" },
          commentedByName: { type: String, default: "" }
        }
      ]
    },

    /**
     * Published performance review history (audit + revision control)
     */
    performanceReviewHistory: [
      {
        title: { type: String, default: "" },
        note: { type: String, default: "" },
        publishedAt: { type: Date, default: Date.now },
        publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        editedAt: { type: Date, default: null },
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        acknowledgedByEmployee: { type: Boolean, default: false },
        acknowledgedAt: { type: Date, default: null },
        hiddenByEmployee: { type: Boolean, default: false },
        hiddenAt: { type: Date, default: null },
        employeeComments: [
          {
            text: { type: String, default: "" },
            commentedAt: { type: Date, default: Date.now },
            commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            commentedByRole: { type: String, enum: ["admin", "superadmin", "employee"], default: "employee" },
            commentedByName: { type: String, default: "" }
          }
        ],
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
      }
    ]
  },
  { timestamps: true }
);

/**
 * Ensure compatibility with hot-reload / multiple model registration
 */
export default mongoose.models.User || mongoose.model("User", UserSchema);

