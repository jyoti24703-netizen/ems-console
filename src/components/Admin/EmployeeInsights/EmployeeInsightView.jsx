import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import EmployeeTaskTable from "./EmployeeTaskTable";
import DiscussionSummary from "./DiscussionSummary";
import EmployeeActivityTimeline from "./EmployeeActivityTimeline";
import FailureIntelligenceSummary from "./FailureIntelligenceSummary";

/* ================= UI STATUS OPTIONS ================= */
const STATUS_OPTIONS = [
  "all",
  "active",
  "assigned",
  "reopened",
  "completed",
  "verified",
  "failed",
  "declined",
  "withdrawn",
  "archived",
  "overdue",
];

/* ================= STATUS NORMALIZATION ================= */
const normalizeStatus = (status) => {
  return status;
};

/* ================= SLA CALCULATIONS ================= */
const minutesBetween = (a, b) =>
  a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null;

const calculateSLAStats = (tasks = []) => {
  let acceptTimes = [];
  let completeTimes = [];
  let overdue = 0;
  let reopened = 0;
  let declined = 0;
  let lateSubmissions = 0;
  let noResponse = 0;

  tasks.forEach((task) => {
    const timeline = task.activityTimeline || [];

    const assigned = timeline.find(e => e.action === "TASK_ASSIGNED")?.createdAt;
    const accepted = timeline.find(e => e.action === "TASK_ACCEPTED")?.createdAt;
    const completed = timeline.find(e =>
      ["TASK_COMPLETED", "TASK_FAILED"].includes(e.action)
    )?.createdAt;

    if (assigned && accepted) {
      acceptTimes.push(minutesBetween(assigned, accepted));
    }

    if (accepted && completed) {
      completeTimes.push(minutesBetween(accepted, completed));
      
      // Late submission detection
      if (task.dueDate && completed && new Date(completed) > new Date(task.dueDate)) {
        lateSubmissions++;
      }
    }

    // No response detection (assigned but not accepted within 24h and no discussion)
    if (assigned && !accepted) {
      const hoursSinceAssignment = (new Date() - new Date(assigned)) / (1000 * 60 * 60);
      const hasDiscussion = task.discussion && task.discussion.length > 0;
      if (hoursSinceAssignment > 24 && !hasDiscussion) {
        noResponse++;
      }
    }

    if (
      task.dueDate &&
      !["completed", "verified", "failed"].includes(normalizeStatus(task.status)) &&
      new Date(task.dueDate) < new Date()
    ) {
      overdue++;
    }

    reopened += timeline.filter(e => e.action === "TASK_REOPENED").length;

    if (
      ["failed", "declined_by_employee", "declined_by_admin"].includes(task.status)
    ) {
      declined++;
    }
  });

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : "—";

  return {
    avgAcceptance: avg(acceptTimes),
    avgCompletion: avg(completeTimes),
    overdue,
    reopened,
    declined,
    lateSubmissions,
    noResponse,
  };
};

/* ================= DATE HELPER FUNCTIONS ================= */
const parseDMY = (dateStr) => {
  if (!dateStr) return null;
  
  // Handle dd/mm/yyyy format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 0) {
        return new Date(year, month - 1, day);
      }
    }
  }
  
  // Handle other formats
  return new Date(dateStr);
};

const formatToDMY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatToYYYYMMDD = (dateStr) => {
  // Convert dd/mm/yyyy to yyyy-mm-dd for input[type="date"]
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
};

const parseYYYYMMDD = (dateStr) => {
  // Convert yyyy-mm-dd to dd/mm/yyyy
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

const EmployeeInsightView = ({ employee, tasks = [], onChangeEmployee }) => {
  const [activeTab, setActiveTab] = useState("tasks");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const navigate = useNavigate();

  /* ================= FILTER STATE ================= */
  const [statusFilter, setStatusFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  /* ================= DATE FILTER STATE ================= */
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null,
  });

  /* ================= ADMIN NOTICE STATE ================= */
  const [adminNotice, setAdminNotice] = useState("");
  const [noticeHistory, setNoticeHistory] = useState([]);

  // ✅ FIXED: Handle viewing task details - SIMPLIFIED
  const handleViewTaskDetails = (task) => {
    console.log("🚀 Navigating to task details:", task._id);
    
      const navigationState = { 
        fromEmployeeInsights: true,
        employeeId: employee._id,
        employeeName: employee.name,
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
          selectedEmployeeId: employee._id,
          scrollPosition: window.scrollY,
          activeTab: "tasks"
        }
      };
    
    navigate(`/task-details/${task._id}`, {
      state: navigationState
    });
  };

  /* ================= HEADER METRICS ================= */
  const totalTasks = tasks.length;

  const overdueCount = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const status = normalizeStatus(task.status);
    if (["completed", "verified", "failed", "declined_by_employee", "declined_by_admin", "withdrawn"].includes(status)) return false;
    return new Date(task.dueDate) < new Date();
  }).length;

  const onTimeCount = totalTasks - overdueCount;
  const slaIndicator = overdueCount === 0 ? "✅" : overdueCount <= 2 ? "⚠️" : "❌";

  /* ================= FILTERED TASKS ================= */
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const normalizedStatus = normalizeStatus(task.status);
      const isOverdue =
        task.dueDate &&
        !["completed", "verified", "failed"].includes(normalizedStatus) &&
        new Date(task.dueDate) < new Date();
      const isDeclined = task.status === "declined_by_employee";
      const isArchived = !!task.isArchived;

      if (statusFilter !== "all") {
        if (statusFilter === "active" && !["accepted", "in_progress"].includes(normalizedStatus)) return false;
        if (statusFilter === "declined" && !isDeclined) return false;
        if (statusFilter === "archived" && !isArchived) return false;
        if (statusFilter === "overdue" && !isOverdue) return false;
        if (!["active", "declined", "archived", "overdue"].includes(statusFilter) && normalizedStatus !== statusFilter) {
          return false;
        }
      }

      if (slaFilter !== "all") {
        if (slaFilter === "overdue" && !isOverdue) return false;
        if (slaFilter === "on_time" && isOverdue) return false;
      }

      if (
        searchQuery &&
        !task.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      /* ================= DATE RANGE FILTER ================= */
      if (dateRange.from || dateRange.to) {
        // Try to get the assigned date from timeline first, then fallback to createdAt
        const timeline = task.activityTimeline || [];
        const assignedEvent = timeline.find(e => e.action === "TASK_ASSIGNED");
        const assignedDate = assignedEvent ? assignedEvent.createdAt : task.createdAt;
        
        if (!assignedDate) return true; // If no date, include the task
        
        const taskDate = parseDMY(assignedDate);
        if (!taskDate || isNaN(taskDate.getTime())) return true; // If date parsing fails, include the task

        // Reset time part for proper date comparison
        const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
        
        if (dateRange.from) {
          const fromDate = parseDMY(dateRange.from);
          if (fromDate && !isNaN(fromDate.getTime())) {
            const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
            if (taskDateOnly < fromDateOnly) {
              return false;
            }
          }
        }
        
        if (dateRange.to) {
          const toDate = parseDMY(dateRange.to);
          if (toDate && !isNaN(toDate.getTime())) {
            const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
            if (taskDateOnly > toDateOnly) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [tasks, statusFilter, slaFilter, searchQuery, dateRange]);

  const requestRows = useMemo(() => {
    const rows = [];
    tasks.forEach((task) => {
      (task.modificationRequests || []).forEach((req) => {
        rows.push({
          id: `mod_admin_${task._id}_${req._id}`,
          taskId: task._id,
          taskTitle: task.title,
          source: "admin",
          kind: "modification",
          requestType: req.requestType || "edit",
          status: req.status || "pending",
          reason: req.reason || "-",
          createdAt: req.requestedAt || req.createdAt || req.updatedAt,
          actedAt: req.reviewedAt || req.respondedAt || req.updatedAt,
        });
      });

      (task.employeeModificationRequests || []).forEach((req) => {
        rows.push({
          id: `mod_employee_${task._id}_${req._id}`,
          taskId: task._id,
          taskTitle: task.title,
          source: "employee",
          kind: "modification",
          requestType: req.requestType || "edit",
          status: req.status || "pending",
          reason: req.reason || "-",
          createdAt: req.requestedAt || req.createdAt || req.updatedAt,
          actedAt: req.reviewedAt || req.respondedAt || req.updatedAt,
        });
      });

      (task.extensionRequests || []).forEach((req) => {
        const isAdminRequest =
          req.requestedBy?.role === "admin" ||
          String(req.requestedBy?._id || req.requestedBy || "") === String(task.createdBy?._id || task.createdBy || "");
        rows.push({
          id: `ext_${task._id}_${req._id}`,
          taskId: task._id,
          taskTitle: task.title,
          source: isAdminRequest ? "admin" : "employee",
          kind: "extension",
          requestType: "extension",
          status: req.status || "pending",
          reason: req.reason || "-",
          createdAt: req.requestedAt || req.createdAt || req.updatedAt,
          actedAt: req.reviewedAt || req.updatedAt,
        });
      });

      if (task.reopenReason || task.reopenDueAt || task.reopenSlaStatus) {
        rows.push({
          id: `reopen_${task._id}`,
          taskId: task._id,
          taskTitle: task.title,
          source: "admin",
          kind: "reopen",
          requestType: "reopen",
          status: task.reopenSlaStatus || "pending",
          reason: task.reopenReason || "-",
          createdAt: task.updatedAt,
          actedAt: task.reopenAcceptedAt || task.reopenViewedAt || task.updatedAt,
        });
      }
    });

    return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [tasks]);

  /* ================= DERIVE SELECTED TASK ================= */
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return filteredTasks.find(t => t._id === selectedTaskId) || null;
  }, [filteredTasks, selectedTaskId]);

  const selectedTaskRequestRows = useMemo(() => {
    if (!selectedTask?._id) return [];
    return requestRows.filter((row) => String(row.taskId) === String(selectedTask._id));
  }, [requestRows, selectedTask]);

  /* ================= AUTO-RESET SELECTION WHEN FILTER CHANGES ================= */
  useEffect(() => {
    setSelectedTaskId(null);
  }, [statusFilter, slaFilter, searchQuery, dateRange]);

  /* ================= ADMIN NOTICE HANDLER ================= */
  const handleSendNotice = () => {
    if (!adminNotice.trim()) return;
    
    const newNotice = {
      id: Date.now(),
      message: adminNotice,
      timestamp: new Date().toISOString(),
      sentBy: "Admin",
      type: "notice"
    };
    
    setNoticeHistory([newNotice, ...noticeHistory]);
    setAdminNotice("");
    
    // In real app, this would be an API call
    console.log("Admin notice sent:", newNotice);
  };

  if (!employee) {
    return <div className="text-gray-400">Select an employee to view insights.</div>;
  }

  return (
    <div className="flex flex-col h-full w-full space-y-4">

      {/* ================= A. EMPLOYEE HEADER CARD ================= */}
      <div className="bg-[#1f2933] p-4 rounded flex flex-wrap gap-6 items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{employee.name}</h3>
          <p className="text-sm text-gray-400">{employee.email}</p>
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <span>
            Status:{" "}
            <span className={employee.status === "active" ? "text-green-400" : "text-red-400"}>
              {employee.status}
            </span>
          </span>

          <span>
            Joined:{" "}
            {employee.createdAt
              ? formatToDMY(employee.createdAt)
              : "—"}
          </span>

          <span>Total Tasks: {totalTasks}</span>

          <span>
            SLA: {onTimeCount} on-time / {overdueCount} overdue {slaIndicator}
          </span>
        </div>

        <button
          onClick={onChangeEmployee}
          className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded"
        >
          Change Employee
        </button>
      </div>

      {/* ================= TABS ================= */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {[
          ["tasks", "Tasks"],
          ["discussion", "Discussions"],
          ["requests", "Request Center"],
          ["sla", "SLA & Metrics"],
          ["timeline", "Activity Timeline"],
          ["failure", "Failure Intelligence"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-t ${
              activeTab === key ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ================= CONTENT ================= */}
      <div className="flex-1 overflow-y-auto bg-[#020617] p-4 rounded">

        {/* ================= B. TASK FILTERS SECTION ================= */}
        {(activeTab === "tasks" || activeTab === "discussion" || activeTab === "requests" || activeTab === "timeline") && (
          <div className="space-y-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded text-sm ${
                    statusFilter === status
                      ? "bg-blue-600"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {status.replace("_", " ").toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value)}
                className="bg-gray-900 border border-gray-700 px-3 py-2 rounded text-sm"
              >
                <option value="all">All SLA</option>
                <option value="on_time">On Time</option>
                <option value="overdue">Overdue</option>
              </select>

              <input
                type="date"
                value={dateRange.from ? formatToYYYYMMDD(dateRange.from) : ''}
                onChange={(e) =>
                  setDateRange(prev => ({ 
                    ...prev, 
                    from: e.target.value ? parseYYYYMMDD(e.target.value) : null 
                  }))
                }
                className="bg-gray-900 border border-gray-700 px-3 py-2 rounded text-sm"
                placeholder="From date"
              />

              <input
                type="date"
                value={dateRange.to ? formatToYYYYMMDD(dateRange.to) : ''}
                onChange={(e) =>
                  setDateRange(prev => ({ 
                    ...prev, 
                    to: e.target.value ? parseYYYYMMDD(e.target.value) : null 
                  }))
                }
                className="bg-gray-900 border border-gray-700 px-3 py-2 rounded text-sm"
                placeholder="To date"
              />

              <input
                type="text"
                placeholder="Search by task title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 px-3 py-2 rounded text-sm"
              />
            </div>
          </div>
        )}

        {/* ================= C. EMPLOYEE TASK TABLE ================= */}
        {activeTab === "tasks" && (
          <EmployeeTaskTable
            tasks={filteredTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            employee={employee}
            onViewTaskDetails={handleViewTaskDetails}
          />
        )}

        {/* ================= D. DISCUSSION SUMMARY ================= */}
        {activeTab === "discussion" && (
          <div className="grid grid-cols-12 gap-4 h-full">

            {/* ================= LEFT: TASK LIST ================= */}
            <div className="col-span-4 bg-[#020617] border border-gray-700 rounded p-3 overflow-y-auto">
              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => setSelectedTaskId(task._id)}
                  className={`p-2 rounded cursor-pointer text-sm border mb-1 ${
                    selectedTaskId === task._id
                      ? "bg-blue-600 border-blue-500"
                      : "border-gray-700 hover:bg-gray-800"
                  }`}
                >
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="text-xs text-gray-400">
                    {task.status.replace("_", " ")}
                  </div>
                </div>
              ))}
            </div>

            {/* ================= RIGHT: DISCUSSION PANEL ================= */}
            <div className="col-span-8 bg-[#020617] border border-gray-700 rounded p-4 overflow-y-auto">
              {!selectedTask ? (
                <div className="text-gray-400 text-sm h-full flex items-center justify-center">
                  Select a task to view discussion.
                </div>
              ) : (
                <DiscussionSummary task={selectedTask} />
              )}
            </div>
          </div>
        )}

        {activeTab === "requests" && (
          <div className="grid grid-cols-12 gap-4 h-full">
            <div className="col-span-4 bg-[#020617] border border-gray-700 rounded p-3 overflow-y-auto">
              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => setSelectedTaskId(task._id)}
                  className={`p-2 rounded cursor-pointer text-sm border mb-1 ${
                    selectedTaskId === task._id
                      ? "bg-blue-600 border-blue-500"
                      : "border-gray-700 hover:bg-gray-800"
                  }`}
                >
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="text-xs text-gray-400">{task.status.replace("_", " ")}</div>
                </div>
              ))}
            </div>

            <div className="col-span-8 bg-[#020617] border border-gray-700 rounded p-4 overflow-y-auto">
              {!selectedTask ? (
                <div className="text-gray-400 text-sm h-full flex items-center justify-center">
                  Select a task to view related requests.
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-200 truncate pr-2">
                      Request Center - {selectedTask.title}
                    </h4>
                    <div className="text-xs text-gray-400">{selectedTaskRequestRows.length} request(s)</div>
                  </div>

                  {selectedTaskRequestRows.length === 0 ? (
                    <div className="text-gray-400 text-sm">No requests found for this task.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTaskRequestRows.map((row) => (
                        <div key={row.id} className="border border-gray-700 rounded p-3 bg-[#0b1220]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-gray-200">
                              {row.kind} / {row.requestType} / {row.source}
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-200">{row.status}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">Reason: {row.reason}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Created: {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                            {" · "}
                            Last update: {row.actedAt ? new Date(row.actedAt).toLocaleString() : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= E. SLA & RESPONSE BEHAVIOR ================= */}
        {activeTab === "sla" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {(() => {
                const stats = calculateSLAStats(filteredTasks);
                return (
                  <>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">Avg Acceptance</div>
                      <div className="text-lg font-semibold">{stats.avgAcceptance} min</div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">Avg Completion</div>
                      <div className="text-lg font-semibold">{stats.avgCompletion} min</div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">Overdue Tasks</div>
                      <div className={`text-lg font-semibold ${stats.overdue > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {stats.overdue}
                      </div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">Reopened Tasks</div>
                      <div className={`text-lg font-semibold ${stats.reopened > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {stats.reopened}
                      </div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">Declined Tasks</div>
                      <div className="text-lg font-semibold">{stats.declined}</div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">Late Submissions</div>
                      <div className={`text-lg font-semibold ${stats.lateSubmissions > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {stats.lateSubmissions}
                      </div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">No Response</div>
                      <div className={`text-lg font-semibold ${stats.noResponse > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {stats.noResponse}
                      </div>
                    </div>
                    <div className="bg-[#020617] p-4 rounded border border-gray-700">
                      <div className="text-gray-400 text-sm">On Time Rate</div>
                      <div className="text-lg font-semibold">
                        {filteredTasks.length > 0 
                          ? `${Math.round((onTimeCount / filteredTasks.length) * 100)}%`
                          : "—"}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ================= G. ADMIN NOTICE ================= */}
            <div className="mt-6 bg-[#020617] border border-gray-700 rounded p-4">
              <h4 className="font-semibold text-gray-300 mb-3">
                Admin Notice (One-Way Communication)
              </h4>
              
              <textarea
                value={adminNotice}
                onChange={(e) => setAdminNotice(e.target.value)}
                placeholder="Send a notice to this employee (logged & immutable)..."
                className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm h-24 mb-3"
                rows="4"
              />
              
              <div className="flex justify-between items-center">
                <button
                  onClick={handleSendNotice}
                  disabled={!adminNotice.trim()}
                  className={`px-4 py-2 rounded text-sm ${
                    adminNotice.trim()
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-800 cursor-not-allowed"
                  }`}
                >
                  Send Notice
                </button>
                
                <span className="text-xs text-gray-500">
                  Notices are logged and cannot be edited or deleted
                </span>
              </div>
              
              {/* Notice History */}
              {noticeHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h5 className="text-sm font-medium text-gray-400 mb-2">Recent Notices</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {noticeHistory.slice(0, 5).map((notice) => (
                      <div key={notice.id} className="text-sm border-l-2 border-blue-500 pl-2 py-1">
                        <div className="flex justify-between">
                          <span className="text-gray-300">{notice.message}</span>
                          <span className="text-gray-500 text-xs">
                            {new Date(notice.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ================= F. EMPLOYEE ACTIVITY TIMELINE ================= */}
        {activeTab === "timeline" && (
          <div className="grid grid-cols-12 gap-4 h-full">

            <div className="col-span-4 bg-[#020617] border border-gray-700 rounded p-3 overflow-y-auto">
              {filteredTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => setSelectedTaskId(task._id)}
                  className={`p-2 rounded cursor-pointer text-sm border mb-1 ${
                    selectedTaskId === task._id
                      ? "bg-blue-600 border-blue-500"
                      : "border-gray-700 hover:bg-gray-800"
                  }`}
                >
                  {task.title}
                </div>
              ))}
            </div>

            <div className="col-span-8 bg-[#020617] border border-gray-700 rounded p-4 overflow-y-auto">
              <EmployeeActivityTimeline
                tasks={selectedTask ? [selectedTask] : filteredTasks}
              />
            </div>
          </div>
        )}

        {/* ================= FAILURE INTELLIGENCE ================= */}
        {activeTab === "failure" && (
          <div className="space-y-6">
            <FailureIntelligenceSummary tasks={filteredTasks} />
            
            {/* Additional Failure Intelligence Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#020617] border border-gray-700 rounded p-4">
                <h4 className="font-semibold text-gray-300 mb-3">Pattern Analysis</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Tasks with multiple reopenings</span>
                    <span className="text-sm">
                      {(() => {
                        const multiReopen = filteredTasks.filter(task => 
                          (task.activityTimeline || []).filter(e => e.action === "TASK_REOPENED").length >= 2
                        ).length;
                        return `${multiReopen} tasks`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Delayed acceptance (&gt;24h)</span>
                    <span className="text-sm">
                      {(() => {
                        const delayedAccept = filteredTasks.filter(task => {
                          const timeline = task.activityTimeline || [];
                          const assigned = timeline.find(e => e.action === "TASK_ASSIGNED")?.createdAt;
                          const accepted = timeline.find(e => e.action === "TASK_ACCEPTED")?.createdAt;
                          if (assigned && accepted) {
                            const hours = (new Date(accepted) - new Date(assigned)) / (1000 * 60 * 60);
                            return hours > 24;
                          }
                          return false;
                        }).length;
                        return `${delayedAccept} tasks`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Failed Tasks (admin failed)</span>
                    <span className="text-sm">
                      {filteredTasks.filter(task => task.status === "failed").length} tasks
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Declined by Employee</span>
                    <span className="text-sm">
                      {filteredTasks.filter(task => task.status === "declined_by_employee").length} tasks
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#020617] border border-gray-700 rounded p-4">
                <h4 className="font-semibold text-gray-300 mb-3">SLA Breach Analysis</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Average overdue days</span>
                    <span className="text-sm">
                      {(() => {
                        const overdueTasks = filteredTasks.filter(task => {
                          if (!task.dueDate) return false;
                          const status = normalizeStatus(task.status);
                          if (["completed", "verified", "failed"].includes(status)) return false;
                          return new Date(task.dueDate) < new Date();
                        });
                        
                        if (overdueTasks.length === 0) return "—";
                        
                        const totalDays = overdueTasks.reduce((sum, task) => {
                          const diff = new Date() - new Date(task.dueDate);
                          return sum + Math.floor(diff / (1000 * 60 * 60 * 24));
                        }, 0);
                        
                        return `${Math.round(totalDays / overdueTasks.length)} days`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Most common failure reason</span>
                    <span className="text-sm">
                      {(() => {
                        const failedTasks = filteredTasks.filter(task => task.status === "failed");
                        
                        if (failedTasks.length === 0) return "No failures";
                        
                        const reasons = failedTasks.map(task => task.failureReason || "No reason provided");
                        const counts = {};
                        reasons.forEach(reason => {
                          counts[reason] = (counts[reason] || 0) + 1;
                        });
                        
                        const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                        return mostCommon ? `${mostCommon[0]} (${mostCommon[1]}×)` : "No data";
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Response rate</span>
                    <span className="text-sm">
                      {(() => {
                        const respondedTasks = filteredTasks.filter(task => 
                          (task.discussion || []).length > 0
                        );
                        return filteredTasks.length > 0 
                          ? `${Math.round((respondedTasks.length / filteredTasks.length) * 100)}%`
                          : "—";
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeInsightView;

