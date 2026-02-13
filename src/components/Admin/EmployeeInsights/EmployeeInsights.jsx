import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../../context/AuthProvider";
import EmployeeSearch from "./EmployeeSearch";
import EmployeeInsightView from "./EmployeeInsightView";

const EmployeeInsights = () => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Restore employee data when returning from task details
  useEffect(() => {
    console.log("🔄 Location changed, checking for returned data...");
    console.log("📍 location.state:", location.state);
    
    if (location.state?.returnedEmployee) {
      console.log("✅ Restoring employee from navigation state:", location.state.returnedEmployee.name);
      setSelectedEmployee(location.state.returnedEmployee);
      setEmployeeData(location.state.returnedEmployeeData);
      setTasks(location.state.returnedTasks || []);
      
      // If a specific task should be highlighted, set it
      if (location.state?.returnedTaskId) {
        console.log("🎯 Setting selected task:", location.state.returnedTaskId);
        setSelectedTaskId(location.state.returnedTaskId);
      }
    } else if (location.state?.selectedEmployeeId && !selectedEmployee) {
      // Allow deep-linking from other sections
      setSelectedEmployee({ _id: location.state.selectedEmployeeId });
    }
  }, [location]);

  useEffect(() => {
    if (!selectedEmployee) return;

    const fetchInsights = async () => {
      setLoading(true);
      setError(null);

      try {
        const employeeId = selectedEmployee?._id || selectedEmployee?.id;
        if (!employeeId) {
          throw new Error("Invalid employee");
        }

        const token =
          user?.token ||
          (() => {
            try {
              const storedUser = localStorage.getItem("user");
              return storedUser ? JSON.parse(storedUser).token : null;
            } catch {
              return null;
            }
          })();

        if (!token) throw new Error("Unauthorized");

        const res = await fetch(
          `http://localhost:4000/api/admin/employee-insights/${employeeId}`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) throw new Error(data.error || "Employee not found");
          if (res.status === 401 || res.status === 403) throw new Error(data.error || "Unauthorized");
          throw new Error(data.error || "Failed to load employee insights");
        }

        setEmployeeData(data.employee || null);
        setTasks(data.tasks || []);
      } catch (err) {
        console.error(err);
        setEmployeeData(null);
        setTasks([]);
        setError(err.message || "Failed to load employee insights");
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [selectedEmployee]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskIdFromUrl = params.get("taskId");

    if (taskIdFromUrl) {
      console.log("🔁 Restoring task from URL:", taskIdFromUrl);
      setSelectedTaskId(taskIdFromUrl);
    }
  }, [location.search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Employee Insights</h1>
            <p className="text-sm text-gray-400">Performance, workload, and task history</p>
          </div>
          <button
            onClick={() =>
              navigate("/admin", {
                state: {
                  activeSection: "employeeInsights",
                  selectedEmployeeId: employeeData?._id || selectedEmployee?._id,
                },
              })
            }
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm"
          >
            ← Back
          </button>
        </div>
      {!employeeData && (
        <EmployeeSearch onSelect={setSelectedEmployee} />
      )}

      {error && (
        <div className="bg-red-900/40 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400">
          Loading employee insights…
        </div>
      )}

      {!loading && employeeData && (
        <EmployeeInsightView
          employee={employeeData}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onChangeEmployee={() => {
            setSelectedEmployee(null);
            setEmployeeData(null);
            setTasks([]);
            setError(null);
            setSelectedTaskId(null);
          }}
        />
      )}

      {!loading && !employeeData && !error && (
        <div className="text-gray-400">
          Select an employee to view insights.
        </div>
      )}
      </div>
    </div>
  );
};

export default EmployeeInsights;
