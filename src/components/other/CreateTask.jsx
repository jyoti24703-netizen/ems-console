import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthProvider";

const CreateTask = () => {
  const { user } = useContext(AuthContext);

  if (!user || user.role !== "admin") return null;

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [category, setCategory] = useState("");

  const submitHandler = (e) => {
    e.preventDefault();

    // TEMP: just log (backend comes next)
    console.log({
      taskTitle,
      taskDescription,
      taskDate,
      assignTo,
      category,
    });

    setTaskTitle("");
    setTaskDescription("");
    setTaskDate("");
    setAssignTo("");
    setCategory("");
  };

  return (
    <div className="p-5 bg-[#1c1c1c] mt-5 rounded text-white">
      <h2 className="text-xl font-semibold mb-4">Create Task</h2>

      <form onSubmit={submitHandler} className="flex flex-wrap justify-between">
        <div className="w-1/2">
          <input
            className="w-4/5 mb-3 p-2 bg-transparent border border-gray-500 rounded"
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />

          <input
            type="date"
            className="w-4/5 mb-3 p-2 bg-transparent border border-gray-500 rounded"
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
          />

          <input
            className="w-4/5 mb-3 p-2 bg-transparent border border-gray-500 rounded"
            placeholder="Assign to"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
          />

          <input
            className="w-4/5 mb-3 p-2 bg-transparent border border-gray-500 rounded"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div className="w-2/5">
          <textarea
            className="w-full h-40 p-2 bg-transparent border border-gray-500 rounded"
            placeholder="Description"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />

          <button className="mt-4 w-full bg-emerald-500 py-2 rounded">
            Create Task
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTask;
