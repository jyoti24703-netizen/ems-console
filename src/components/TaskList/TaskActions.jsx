import React from "react";
import {
  acceptTask,
  rejectTask,
  completeTask,
} from "../../api/taskActions";

const TaskActions = ({ task, onChange }) => {
  const handle = async (action) => {
    try {
      await action(task._id);
      onChange(); // refetch tasks after action
    } catch (err) {
      alert(err.message || "Action failed");
    }
  };

  if (task.status === "assigned") {
    return (
      <div className="flex gap-3 mt-3">
        <button
          className="px-3 py-1 bg-green-600 rounded"
          onClick={() => handle(acceptTask)}
        >
          Accept
        </button>
        <button
          className="px-3 py-1 bg-red-600 rounded"
          onClick={() => handle(rejectTask)}
        >
          Reject
        </button>
      </div>
    );
  }

  if (task.status === "accepted") {
    return (
      <div className="mt-3">
        <button
          className="px-3 py-1 bg-blue-600 rounded"
          onClick={() => handle(completeTask)}
        >
          Mark Complete
        </button>
      </div>
    );
  }

  return null;
};

export default TaskActions;




