import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config/api";

const EmployeeSearch = ({ onSelect }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) throw new Error("Unauthorized");

        const token = JSON.parse(storedUser).token;
        if (!token) throw new Error("Unauthorized");

        const res = await fetch(
          `${API_BASE_URL}/api/admin/employees`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load employees");

        setEmployees(data.employees || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#1f2933] p-4 rounded text-gray-400">
        Loading employees…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1f2933] p-4 rounded text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-[#1f2933] p-4 rounded space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">
        Select Employee
      </h3>

      {employees.length === 0 && (
        <p className="text-sm text-gray-400">No employees found.</p>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {employees.map((emp) => (
          <button
            key={emp._id}
            onClick={() => onSelect(emp)}
            className="w-full text-left p-3 rounded bg-[#020617] hover:bg-[#0f172a] border border-gray-700"
          >
            <div className="font-medium">{emp.name}</div>
            <div className="text-xs text-gray-400">{emp.email}</div>
            <div className="text-xs text-gray-500">
              Status: {emp.status}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmployeeSearch;




