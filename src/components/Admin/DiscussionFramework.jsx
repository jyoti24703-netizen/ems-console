const DiscussionFramework = ({
  tasks = [],
  selectedTaskId,
  onSelectTask,
}) => {
  return (
    <div className="grid grid-cols-12 gap-4 h-full">

      {/* ================= LEFT PANEL ================= */}
      <div className="col-span-4 bg-[#020617] border border-gray-700 rounded p-4 space-y-4">

        {/* FILTER FRAMEWORK */}
        <div>
          <h4 className="text-sm font-semibold mb-2">FILTERS</h4>

          <div className="space-y-3 text-xs text-gray-400">

            <div>
              <p className="font-medium text-gray-300">STATUS</p>
              <p>Assigned · Accepted · Active · In Progress · Completed · Verified · Failed</p>
            </div>

            <div>
              <p className="font-medium text-gray-300">SLA</p>
              <p>On Time · Overdue</p>
            </div>

            <div>
              <p className="font-medium text-gray-300">TIMELINE</p>
              <p>Has Activity · Reopened · Failed Events</p>
            </div>

            <div className="opacity-50">
              <p className="font-medium text-gray-300">DATE (coming soon)</p>
              <p>Today · Last 7 days · Custom</p>
            </div>

            <div className="opacity-50">
              <p className="font-medium text-gray-300">ACTOR (coming soon)</p>
              <p>System · Employee · Admin</p>
            </div>

            <div className="opacity-50">
              <p className="font-medium text-gray-300">RISK (coming soon)</p>
              <p>SLA Breach · Reopened · Declined</p>
            </div>

          </div>
        </div>

        {/* TASK LIST */}
        <div>
          <h4 className="text-sm font-semibold mb-2">TASKS</h4>

          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {tasks.map((task) => {
              const active = task._id === selectedTaskId;

              return (
                <div
                  key={task._id}
                  onClick={() => onSelectTask(task._id)}
                  className={`p-3 rounded border cursor-pointer text-sm
                    ${
                      active
                        ? "bg-blue-600 border-blue-500"
                        : "bg-[#020617] border-gray-700 hover:bg-gray-800"
                    }`}
                >
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-gray-300">{task.status}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= RIGHT PANEL ================= */}
      <div className="col-span-8 bg-[#020617] border border-gray-700 rounded p-4 space-y-6">

        {/* DISCUSSION */}
        <div>
          <h4 className="text-sm font-semibold mb-2">MESSAGES</h4>
          <div className="text-gray-400 text-sm">
            Discussion content will appear here.
          </div>
        </div>

        {/* ADMIN NOTES */}
        <div className="opacity-50">
          <h4 className="text-sm font-semibold mb-2">ADMIN NOTES (coming soon)</h4>
          <p className="text-xs text-gray-400">
            Internal remarks · Warning flags
          </p>
        </div>

        {/* AUDIT */}
        <div className="opacity-50">
          <h4 className="text-sm font-semibold mb-2">AUDIT (coming soon)</h4>
          <p className="text-xs text-gray-400">
            Status change log · Admin override
          </p>
        </div>

        {/* REVIEWS */}
        <div className="opacity-50">
          <h4 className="text-sm font-semibold mb-2">REVIEWS (coming soon)</h4>
          <p className="text-xs text-gray-400">
            Verification feedback · QA notes
          </p>
        </div>

      </div>
    </div>
  );
};

export default DiscussionFramework;
