import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";

const AllTask = () => {
  const { user } = useContext(AuthContext);

  // safety guard
  if (!user || user.role !== "admin") return null;

  return (
    <div className="bg-[#1c1c1c] p-5 rounded mt-5 text-white">
      <div className="bg-red-400 mb-3 py-2 px-4 flex justify-between rounded text-black">
        <h2 className="text-lg font-medium w-1/5">Employee</h2>
        <h3 className="text-lg font-medium w-1/5">New</h3>
        <h5 className="text-lg font-medium w-1/5">Active</h5>
        <h5 className="text-lg font-medium w-1/5">Completed</h5>
        <h5 className="text-lg font-medium w-1/5">Failed</h5>
      </div>

      <div className="text-gray-400 text-center py-6">
        No task data yet.  
        <br />
        <span className="text-sm">
          (This will be populated from backend in the next step)
        </span>
      </div>
    </div>
  );
};

export default AllTask;
