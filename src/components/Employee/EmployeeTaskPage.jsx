import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";
import TaskDetailPanel from "./TaskDetailPanel";

const EmployeeTaskPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH SINGLE TASK ================= */
  const fetchTask = async () => {
    try {
      const res = await fetch(
        `http://localhost:4000/api/tasks/${id}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      const data = await res.json();
      setTask(data.task || null);
    } catch (err) {
      console.error("Failed to load task", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [id, user.token]);

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-black text-white">
      <header className="flex items-center gap-4 px-8 py-4 bg-[#020617] border-b border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="text-sm px-3 py-1 rounded bg-gray-800 hover:bg-gray-700"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Task Details</h1>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        {loading && <p className="text-gray-400">Loading task...</p>}

        {!loading && !task && (
          <p className="text-red-400">Task not found.</p>
        )}

        {!loading && task && (
          <TaskDetailPanel task={task} token={user.token} onTaskRefresh={fetchTask} />
        )}
      </main>
    </div>
  );
};

export default EmployeeTaskPage;
