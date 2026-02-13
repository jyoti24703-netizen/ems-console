import React from 'react';
import { useNavigate } from 'react-router-dom';

const EmployeeTaskTable = ({
  tasks = [],
  selectedTaskId,
  onSelectTask,
  employee = null,
}) => {
  const navigate = useNavigate();

  if (!tasks.length) {
    return (
      <div className="text-gray-400 text-sm bg-[#020617] p-4 rounded">
        No tasks match the selected filters.
      </div>
    );
  }

  // Helper function to get SLA status
  const getSLAStatus = (task) => {
    if (!task.dueDate) return { text: "No due date", color: "text-gray-400" };
    
    const status = task.status;
    if (["completed", "verified", "failed"].includes(status)) {
      const completedAt = task.completedAt || task.updatedAt;
      if (completedAt && new Date(completedAt) > new Date(task.dueDate)) {
        return { text: "Late", color: "text-yellow-400" };
      }
      return { text: "Completed", color: "text-green-400" };
    }
    
    if (new Date(task.dueDate) < new Date()) {
      return { text: "Overdue", color: "text-red-400" };
    }
    
    return { text: "On Track", color: "text-green-400" };
  };

  // Helper function to get last activity
  const getLastActivity = (task) => {
    const timeline = task.activityTimeline || [];
    if (timeline.length === 0) return "—";
    
    const lastEvent = timeline[timeline.length - 1];
    const actionMap = {
      "TASK_ASSIGNED": "Assigned",
      "TASK_ACCEPTED": "Accepted",
      "TASK_IN_PROGRESS": "Started",
      "TASK_COMPLETED": "Completed",
      "TASK_VERIFIED": "Verified",
      "TASK_FAILED": "Failed",
      "TASK_REOPENED": "Reopened",
      "MESSAGE_SENT": "Message",
      "FILE_UPLOADED": "File uploaded",
      "TASK_DECLINED": "Declined",
      "TASK_CREATED": "Created",
      "COMMENT_ADDED": "Comment added"
    };
    
    const actionText = actionMap[lastEvent.action] || lastEvent.action.replace(/_/g, ' ');
    const date = new Date(lastEvent.createdAt).toLocaleDateString('en-GB');
    return `${actionText} on ${date}`;
  };

  // Helper function to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  // Helper function to get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return 'bg-green-900/30 text-green-400';
      case 'failed':
      case 'declined_by_employee':
      case 'declined_by_admin':
        return 'bg-red-900/30 text-red-400';
      case 'in_progress':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'accepted':
        return 'bg-blue-900/30 text-blue-400';
      default:
        return 'bg-gray-800 text-gray-400';
    }
  };

  const handleViewTask = (e, task) => {
    e.stopPropagation();

    console.log("🔍 Viewing task from employee insights:", {
      taskId: task._id,
      employeeId: employee?._id,
    });

    const navigationState = {
      fromEmployeeInsights: true,
      employeeId: employee?._id,
      employeeName: employee?.name,
      taskId: task._id,
      returnPath: "/admin/employee-insights",
      // Pass employee data to restore the view when coming back
      returnedEmployee: employee,
      returnedEmployeeData: employee,
      returnedTasks: tasks,
      returnedTaskId: task._id,
      activeSection: "employeeInsights",
      returnState: {
        returnedEmployee: employee,
        returnedEmployeeData: employee,
        returnedTasks: tasks,
        returnedTaskId: task._id,
        selectedEmployeeId: employee?._id,
        scrollPosition: window.scrollY,
        activeTab: "tasks"
      }
    };

    navigate(`/task-details/${task._id}`, {
      state: navigationState,
      replace: false,
    });
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const slaStatus = getSLAStatus(task);
        const lastActivity = getLastActivity(task);

        return (
          <div
            key={task._id}
            onClick={() => onSelectTask?.(task._id)}
            className={`border p-4 rounded cursor-pointer transition ${
              selectedTaskId === task._id
                ? "bg-blue-900/40 border-blue-500"
                : "bg-[#020617] border-gray-700 hover:border-gray-500"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1 flex-1">
                {/* Task Title with Status Indicator */}
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-2 h-2 mt-2 rounded-full ${
                      task.status === "completed" || task.status === "verified"
                        ? "bg-green-500"
                        : task.status === "failed"
                        ? "bg-red-500"
                        : task.status === "in_progress"
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                  ></div>

                  <div className="flex-1">
                    <h4 className="font-semibold">{task.title}</h4>

                    {/* Task Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                      <div>
                        <p className="text-xs text-gray-400">Status</p>
                        <span
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Assigned</p>
                        <p className="text-sm">{formatDate(task.createdAt)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Due Date</p>
                        <div className="text-sm">
                          {task.dueDate ? formatDate(task.dueDate) : "—"}
                          {task.dueDate &&
                            new Date(task.dueDate) < new Date() &&
                            !["completed", "verified", "failed"].includes(
                              task.status
                            ) && (
                              <p className="text-xs text-red-400 mt-1">
                                {Math.floor(
                                  (new Date() - new Date(task.dueDate)) /
                                    (1000 * 60 * 60 * 24)
                                )}{" "}
                                days overdue
                              </p>
                            )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">SLA Result</p>
                        <p
                          className={`text-sm font-medium ${slaStatus.color}`}
                        >
                          {slaStatus.text}
                        </p>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <p className="text-xs text-gray-400">Last Activity</p>
                      <p className="text-sm text-gray-300">{lastActivity}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Task Button */}
              <div className="ml-4 flex flex-col items-end space-y-2">
                <button
                  onClick={(e) => handleViewTask(e, task)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium px-3 py-1 bg-blue-900/20 hover:bg-blue-900/40 rounded transition"
                >
                  View Task →
                </button>

                {/* Quick Status Indicator */}
                <div className="text-xs text-gray-400">
                  <div className="flex items-center space-x-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        task.discussion && task.discussion.length > 0
                          ? "bg-green-500"
                          : "bg-gray-500"
                      }`}
                    ></div>
                    <span>
                      {task.discussion ? task.discussion.length : 0} messages
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Events Count */}
            <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
              <div>{(task.activityTimeline || []).length} timeline events</div>
              <div>
                {task.priority && (
                  <span
                    className={`px-2 py-1 rounded ${
                      task.priority === "high"
                        ? "bg-red-900/30 text-red-400"
                        : task.priority === "medium"
                        ? "bg-yellow-900/30 text-yellow-400"
                        : "bg-green-900/30 text-green-400"
                    }`}
                  >
                    {task.priority} priority
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EmployeeTaskTable;
