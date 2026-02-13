import React, { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Auth/Login";
import AdminDashboard from "./components/Dashboard/AdminDashboard";
import EmployeeDashboard from "./components/Dashboard/EmployeeDashboard";
import EmployeeInsights from "./components/Admin/EmployeeInsights/EmployeeInsights";
import EmployeeTaskPage from "./components/Employee/EmployeeTaskPage";
import TaskDetails from "./components/TaskDetails/TaskDetails";
import TaskTimeline from "./components/TaskDetails/TaskTimeline";
import MeetingRecordingPlayer from "./components/meetings/MeetingRecordingPlayer";
import { AuthContext } from "./context/AuthProvider";
import AppErrorBoundary from "./components/Shared/AppErrorBoundary";

const App = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Restoring session...
      </div>
    );
  }

  return (
    <AppErrorBoundary>
    <Routes>
      {/* ROOT — auth aware */}
      <Route
        path="/"
        element={
          user
            ? user.role === "admin"
              ? <Navigate to="/admin" replace />
              : <Navigate to="/employee" replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* Login */}
      <Route path="/login" element={<Login />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          ["admin", "superadmin"].includes(user?.role)
            ? <AdminDashboard />
            : <Navigate to="/login" replace />
        }
      />

      {/* Employee Insights - FIXED ROUTE: Removed :employeeId */}
      <Route
        path="/admin/employee-insights"
        element={
          ["admin", "superadmin"].includes(user?.role)
            ? <EmployeeInsights />
            : <Navigate to="/login" replace />
        }
      />

      {/* Employee */}
      <Route
        path="/employee"
        element={
          user?.role === "employee"
            ? <EmployeeDashboard />
            : <Navigate to="/login" replace />
        }
      />

      {/* Employee task */}
      <Route
        path="/employee/tasks/:id"
        element={
          user?.role === "employee"
            ? <EmployeeTaskPage />
            : <Navigate to="/login" replace />
        }
      />

      {/* Task Details */}
      <Route
        path="/task-details/:id"
        element={
          user ? <TaskDetails /> : <Navigate to="/login" replace />
        }
      />

      {/* Task Timeline */}
      <Route
        path="/task-timeline/:id"
        element={
          user ? <TaskTimeline /> : <Navigate to="/login" replace />
        }
      />

      {/* Meeting Recording Player */}
      <Route
        path="/meeting-recording"
        element={
          user ? <MeetingRecordingPlayer /> : <Navigate to="/login" replace />
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppErrorBoundary>
  );
};

export default App;
