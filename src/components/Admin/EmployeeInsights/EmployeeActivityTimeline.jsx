import { useMemo } from "react";

/* ================= COLOR MAP ================= */
const EVENT_COLOR = {
  TASK_CREATED: "text-blue-400",
  TASK_ASSIGNED: "text-blue-400",
  TASK_ACCEPTED: "text-green-400",
  TASK_STARTED: "text-cyan-400",
  TASK_COMPLETED: "text-emerald-400",
  TASK_VERIFIED: "text-purple-400",
  TASK_REOPENED: "text-yellow-400",
  TASK_FAILED: "text-red-400",
  TASK_DECLINED: "text-red-400", // ✅ New
  TASK_REOPEN_ACCEPTED: "text-green-400", // ✅ New
  TASK_REOPEN_DECLINED: "text-red-400", // ✅ New
  MODIFICATION_REQUESTED: "text-yellow-300",
  MODIFICATION_APPROVED: "text-green-400",
  MODIFICATION_REJECTED: "text-red-400",
  MODIFICATION_COUNTER_PROPOSAL: "text-orange-300",
  MODIFICATION_EXPIRED: "text-red-300",
  MODIFICATION_VIEWED: "text-blue-300",
  MODIFICATION_MESSAGE: "text-sky-300",
  EMPLOYEE_MODIFICATION_MESSAGE: "text-sky-300",
  EMPLOYEE_MODIFICATION_REQUESTED: "text-yellow-300",
  EXTENSION_REQUESTED: "text-yellow-300",
  EXTENSION_APPROVED: "text-green-400",
  EXTENSION_REJECTED: "text-red-400",
  TASK_REOPEN_TIMEOUT: "text-orange-300",
  COMMENT_ADDED: "text-gray-200",
  FILE_UPLOADED: "text-cyan-400",
  MESSAGE_SENT: "text-blue-300",
};

const EmployeeActivityTimeline = ({ tasks = [] }) => {
  /**
   * Receives:
   * - [singleTask] when task selected
   * - multiple tasks for employee-wide timeline
   */

  const timeline = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];

    return tasks
      .flatMap(task => {
        const fromActivity = (task.activityTimeline || []).map(event => ({
          ...event,
          taskTitle: task.title,
        }));

        const syntheticRequests = [];
        (task.modificationRequests || []).forEach((req) => {
          syntheticRequests.push({
            action: "MODIFICATION_REQUESTED",
            createdAt: req.requestedAt || req.createdAt || req.updatedAt,
            taskTitle: task.title,
            actorName: req.requestedBy?.name || "admin",
            role: req.requestedBy?.role || "admin",
            details: `Request (${req.requestType || "edit"}) · ${req.status || "pending"} · ${req.reason || "-"}`,
          });
        });
        (task.employeeModificationRequests || []).forEach((req) => {
          syntheticRequests.push({
            action: "EMPLOYEE_MODIFICATION_REQUESTED",
            createdAt: req.requestedAt || req.createdAt || req.updatedAt,
            taskTitle: task.title,
            actorName: req.requestedBy?.name || "employee",
            role: req.requestedBy?.role || "employee",
            details: `Request (${req.requestType || "edit"}) · ${req.status || "pending"} · ${req.reason || "-"}`,
          });
        });
        (task.extensionRequests || []).forEach((req) => {
          syntheticRequests.push({
            action: "EXTENSION_REQUESTED",
            createdAt: req.requestedAt || req.createdAt || req.updatedAt,
            taskTitle: task.title,
            actorName: req.requestedBy?.name || "employee",
            role: req.requestedBy?.role || "employee",
            details: `Extension ${req.status || "pending"} · Due ${req.newDueDate ? new Date(req.newDueDate).toLocaleDateString() : "-"} · ${req.reason || "-"}`,
          });
        });

        return [...fromActivity, ...syntheticRequests];
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.time) -
          new Date(a.createdAt || a.time)
      );
  }, [tasks]);

  if (timeline.length === 0) {
    return (
      <div className="text-gray-400 text-sm">
        No activity recorded.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeline.map((event, index) => (
        <div
          key={index}
          className="bg-[#020617] border border-gray-700 p-3 rounded"
        >
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <span
              className={`text-sm font-semibold ${
                EVENT_COLOR[event.action] || "text-gray-400"
              }`}
            >
              {event.action.replace(/_/g, " ")}
            </span>

            <span className="text-xs text-gray-400">
              {event.createdAt
                ? new Date(event.createdAt).toLocaleString()
                : "—"}
            </span>
          </div>

          {/* TASK */}
          <div className="text-sm text-gray-300 mt-1">
            Task:{" "}
            <span className="font-medium">
              {event.taskTitle}
            </span>
          </div>

          {/* ACTOR */}
          <div className="text-xs text-gray-500 mt-1">
            Actor: {event.actorName || event.actor || event.performedBy?.name || "system"}
          </div>

          {/* ✅ COMMENT MESSAGE (THIS WAS MISSING) */}
          {event.action === "COMMENT_ADDED" && event.message && (
            <div className="mt-2 text-sm text-white bg-black/40 p-2 rounded">
              “{event.message}”
            </div>
          )}

          {/* ✅ DETAILS (e.g., reasons for reopen/decline) */}
          {event.details && (
            <div className="mt-2 text-sm text-white bg-black/40 p-2 rounded">
              {event.details}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default EmployeeActivityTimeline;


