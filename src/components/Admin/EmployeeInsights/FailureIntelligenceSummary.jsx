import { useMemo } from "react";

const FailureIntelligenceSummary = ({ tasks = [] }) => {
  const metrics = useMemo(() => {
    const now = new Date();

    let lateSubmissions = 0;
    let noResponse = 0;
    let repeatedReopens = 0;
    let declinedByEmployee = 0;
    let slaBreaches = 0;

    tasks.forEach((task) => {
      const status = task.status;
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;

      // Late submission
      if (
        dueDate &&
        task.completedAt &&
        new Date(task.completedAt) > dueDate
      ) {
        lateSubmissions++;
      }

      // No response (assigned but never accepted)
      if (
        status === "assigned" &&
        dueDate &&
        dueDate < now
      ) {
        noResponse++;
      }

      // Reopened more than once
      if (Array.isArray(task.activityTimeline)) {
        const reopenCount = task.activityTimeline.filter(
          (e) => e.type === "TASK_REOPENED"
        ).length;

        if (reopenCount > 1) {
          repeatedReopens++;
        }
      }

      // Declined by employee
      if (status === "declined_by_employee") {
        declinedByEmployee++;
      }

      // SLA breach (overdue & not closed)
      if (
        dueDate &&
        dueDate < now &&
        !["completed", "verified"].includes(status)
      ) {
        slaBreaches++;
      }
    });

    return {
      lateSubmissions,
      noResponse,
      repeatedReopens,
      declinedByEmployee,
      slaBreaches,
    };
  }, [tasks]);

  const Card = ({ title, value, note, tone }) => (
    <div
      className={`p-4 rounded border ${
        tone === "danger"
          ? "border-red-700 bg-red-900/20"
          : tone === "warning"
          ? "border-yellow-700 bg-yellow-900/20"
          : "border-gray-700 bg-[#020617]"
      }`}
    >
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{note}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        title="Late Submissions"
        value={metrics.lateSubmissions}
        note="Tasks completed after due date"
        tone="warning"
      />

      <Card
        title="No Response"
        value={metrics.noResponse}
        note="Assigned but never accepted"
        tone="danger"
      />

      <Card
        title="Repeated Reopenings"
        value={metrics.repeatedReopens}
        note="Tasks reopened multiple times"
        tone="warning"
      />

      <Card
        title="Declined by Employee"
        value={metrics.declinedByEmployee}
        note="Explicit refusal by employee"
        tone="danger"
      />

      <Card
        title="SLA Breaches"
        value={metrics.slaBreaches}
        note="Overdue and unresolved tasks"
        tone="danger"
      />
    </div>
  );
};

export default FailureIntelligenceSummary;
