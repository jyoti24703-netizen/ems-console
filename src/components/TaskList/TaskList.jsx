import React from "react";

const statusBadge = (status) => {
  const map = {
    assigned: "bg-gray-600",
    accepted: "bg-blue-600",
    completed: "bg-yellow-600",
    verified: "bg-green-700",
    rejected: "bg-red-700",
  };
  return map[status] || "bg-gray-500";
};

const TaskList = ({
  tasks,
  selectedTaskId,
  onSelect,        // ✅ new (id-based)
  onSelectTask,    // ✅ legacy (task-based)
}) => {
  if (!tasks.length) {
    return <p className="text-gray-400 mt-4">No tasks assigned.</p>;
  }

  return (
    <div className="space-y-2 mt-4">
      {tasks.map(task => (
        <div
          key={task._id}
          onClick={() => {
            // 🔹 ADD: safe dual support (no breaking change)
            if (onSelect) onSelect(task._id);
            if (onSelectTask) onSelectTask(task);
          }}
          className={`cursor-pointer p-3 rounded border 
            ${task._id === selectedTaskId
              ? "border-blue-500 bg-[#1f2933]"
              : "border-gray-700 hover:bg-[#141b24]"}
          `}
        >
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold">
              {task.title}
            </h4>
            <span
              className={`text-xs px-2 py-1 rounded ${statusBadge(task.status)}`}
            >
              {task.status}
            </span>
          </div>

          {task.submittedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Submitted:{" "}
              {new Date(task.submittedAt).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default TaskList;









