import React from "react";

const TaskListNumbers = ({ data }) => {
  // ✅ HARDENED SAFE DEFAULT (STEP 7.1.3)
  const counts = data?.taskCounts || {
    new: 0,
    accepted: 0,
    completed: 0,
    failed: 0,
  };

  return (
    <div className="grid grid-cols-4 gap-6 my-8">
      <div className="bg-blue-500 p-6 rounded text-white">
        <h2>New Task</h2>
        <p className="text-2xl">{counts.new}</p>
      </div>

      <div className="bg-green-500 p-6 rounded text-white">
        <h2>Completed</h2>
        <p className="text-2xl">{counts.completed}</p>
      </div>

      <div className="bg-yellow-500 p-6 rounded text-white">
        <h2>Accepted</h2>
        <p className="text-2xl">{counts.accepted}</p>
      </div>

      <div className="bg-red-500 p-6 rounded text-white">
        <h2>Failed</h2>
        <p className="text-2xl">{counts.failed}</p>
      </div>
    </div>
  );
};

export default TaskListNumbers;
