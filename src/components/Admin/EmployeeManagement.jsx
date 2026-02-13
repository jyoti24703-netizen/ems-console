import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";
import { API_BASE_URL } from "../../config/api";

const EmployeeManagement = ({ statusFilter = "all", defaultTab = "register" }) => {
  const { user } = useContext(AuthContext);

  /* ================= TAB STATE ================= */
  const [activeTab, setActiveTab] = useState("register");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [allTasks, setAllTasks] = useState([]); // ADDED: Store all tasks

  /* ================= DATA ================= */
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("none");
  const [statusFilterState, setStatusFilterState] = useState(statusFilter);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  /* ================= FETCH ALL DATA ================= */
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error("Fetch employees failed", err);
    }
  };

  // ADDED: Fetch all tasks once
  const fetchAllTasks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await res.json();
      setAllTasks(data.tasks || []);
    } catch (err) {
      console.error("Fetch all tasks failed", err);
    }
  };

  useEffect(() => {
    if (user) {
      Promise.all([fetchEmployees(), fetchAllTasks()]);
    }
  }, [user]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    setStatusFilterState(statusFilter);
  }, [statusFilter]);

  /* ================= FETCH EMPLOYEE TASKS ================= */
  const fetchEmployeeTasks = async (employeeId) => {
    if (!employeeId) return;
    
    try {
      setLoadingTasks(true);
      // Use allTasks instead of making another API call
      const filteredTasks = allTasks.filter(
        task => task.assignedTo?._id === employeeId
      );
      setEmployeeTasks(filteredTasks);
    } catch (err) {
      console.error("Filter employee tasks failed", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  /* ================= HANDLE EMPLOYEE SELECTION ================= */
  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    fetchEmployeeTasks(employee._id);
  };

  /* ================= ADDED: CALCULATE ALL METRICS PROPERLY ================= */
  const calculateEmployeeMetrics = (tasks) => {
    const totalTasks = tasks.length;
    
    // Completed tasks (verified status)
    const completedTasks = tasks.filter(t => t.status === "verified").length;
    
    // Pending tasks
    const pendingTasks = tasks.filter(t => 
      ["assigned", "accepted", "in_progress", "reopened", "completed"].includes(t.status)
    ).length;
    
    // OVERDUE TASKS: Use backend virtual field or calculate
    const overdueTasks = tasks.filter(t => {
      // First check if backend provides isOverdue virtual field
      if (t.isOverdue !== undefined) {
        return t.isOverdue === true;
      }
      
      // Fallback calculation
      if (!t.dueDate) return false;
      const status = t.status;
      if (["completed", "verified", "failed", "declined_by_employee"].includes(status)) {
        return false;
      }
      return new Date(t.dueDate) < new Date();
    }).length;
    
    // REOPENED TASKS: Check activity timeline
    const reopenedTasks = tasks.filter(t => {
      const timeline = t.activityTimeline || [];
      return timeline.some(event => event.action === "TASK_REOPENED");
    }).length;
    
    // Failed/declined tasks
    const failedTasks = tasks.filter(t => 
      ["failed", "declined_by_employee"].includes(t.status)
    ).length;
    
    // On-time tasks (verified and not overdue)
    const onTimeTasks = tasks.filter(t => {
      if (t.status !== "verified") return false;
      if (!t.dueDate) return true;
      const completedAt = t.completedAt || t.updatedAt;
      if (!completedAt) return false;
      return new Date(completedAt) <= new Date(t.dueDate);
    }).length;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const onTimeRate = totalTasks > 0 ? Math.round((onTimeTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      reopenedTasks,
      failedTasks,
      onTimeTasks,
      completionRate,
      onTimeRate
    };
  };

  const metrics = calculateEmployeeMetrics(employeeTasks);

  /* ================= ADDED: GET TASK STATUS WITH COLOR ================= */
  const getTaskStatusInfo = (task) => {
    const statusConfig = {
      'assigned': { label: 'Assigned', color: 'bg-gray-500', text: 'text-gray-400' },
      'accepted': { label: 'Accepted', color: 'bg-blue-500', text: 'text-blue-400' },
      'in_progress': { label: 'In Progress', color: 'bg-yellow-500', text: 'text-yellow-400' },
      'completed': { label: 'Completed', color: 'bg-purple-500', text: 'text-purple-400' },
      'verified': { label: 'Verified', color: 'bg-green-500', text: 'text-green-400' },
      'reopened': { label: 'Reopened', color: 'bg-orange-500', text: 'text-orange-400' },
      'failed': { label: 'Failed', color: 'bg-red-500', text: 'text-red-400' },
      'declined_by_employee': { label: 'Declined', color: 'bg-red-700', text: 'text-red-400' }
    };
    
    return statusConfig[task.status] || { label: task.status, color: 'bg-gray-500', text: 'text-gray-400' };
  };

  /* ================= ADDED: GET TASK SLA STATUS ================= */
  const getTaskSLAStatus = (task) => {
    // Use backend virtual field if available
    if (task.isOverdue !== undefined) {
      return task.isOverdue ? 'Overdue' : 'On Track';
    }
    
    // Fallback calculation
    if (!task.dueDate) return 'No Deadline';
    
    const status = task.status;
    if (["completed", "verified", "failed", "declined_by_employee"].includes(status)) {
      return 'Completed';
    }
    
    const today = new Date();
    const dueDate = new Date(task.dueDate);
    
    if (dueDate < today) return 'Overdue';
    
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    
    return 'On Track';
  };

  /* ================= REGISTER EMPLOYEE ================= */
  const createEmployee = async () => {
    try {
      setMessage("");

      if (!form.name || !form.email || !form.password) {
        setMessage("All fields are required");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setForm({ name: "", email: "", password: "" });
      setMessage("Employee registered successfully");
      fetchEmployees();
    } catch (err) {
      setMessage(err.message);
    }
  };

  /* ================= TOGGLE STATUS ================= */
  const toggleStatus = async (id) => {
    await fetch(
      `${API_BASE_URL}/api/admin/employees/${id}/toggle`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      }
    );
    fetchEmployees();
  };

  /* ================= DELETE EMPLOYEE ================= */
  const deleteEmployee = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?"))
      return;

    await fetch(
      `${API_BASE_URL}/api/admin/employees/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      }
    );
    fetchEmployees();
    if (selectedEmployee?._id === id) {
      setSelectedEmployee(null);
      setEmployeeTasks([]);
    }
  };

  /* ================= FILTER + SORT PIPELINE ================= */
  let filteredEmployees = employees.filter((emp) => {
    const matchesSearch = `${emp.name} ${emp.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilterState === "all" ? true : emp.status === statusFilterState;
    return matchesSearch && matchesStatus;
  });

  if (sortBy === "az") {
    filteredEmployees.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sortBy === "za") {
    filteredEmployees.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (sortBy === "active") {
    filteredEmployees.sort((a, b) =>
      a.status === "active" ? -1 : 1
    );
  }

  if (sortBy === "disabled") {
    filteredEmployees.sort((a, b) =>
      a.status !== "active" ? -1 : 1
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Employee Management</h2>

      {/* ================= HORIZONTAL TABS ================= */}
      <div className="flex gap-4 mb-6 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab("register")}
          className={`px-4 py-2 rounded-t ${
            activeTab === "register"
              ? "bg-blue-600"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          Register Employee
        </button>

        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2 rounded-t ${
            activeTab === "list"
              ? "bg-blue-600"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          Employee List
        </button>

        {selectedEmployee && (
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-t ${
              activeTab === "profile"
                ? "bg-blue-600"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            Employee Profile
          </button>
        )}
      </div>

      {/* ================= REGISTER TAB ================= */}
      {activeTab === "register" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Register Form */}
          <div className="bg-[#1f2933] p-6 rounded-lg">
            <h3 className="font-semibold text-lg mb-4">Register New Employee</h3>

            {message && (
              <p className={`text-sm p-3 rounded mb-4 ${
                message.includes("success") ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
              }`}>
                {message}
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                <input
                  className="w-full p-3 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter employee full name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Address</label>
                <input
                  className="w-full p-3 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter employee email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Temporary Password</label>
                <input
                  type="password"
                  className="w-full p-3 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  placeholder="Set temporary password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>

              <button
                onClick={createEmployee}
                className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded font-medium transition-colors"
              >
                Register Employee
              </button>
            </div>
          </div>

          {/* Registration Info */}
          <div className="bg-[#1f2933] p-6 rounded-lg">
            <h3 className="font-semibold text-lg mb-4">Registration Guidelines</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="p-3 bg-blue-900/20 rounded border border-blue-700/30">
                <p className="font-medium mb-1">✓ Account Creation</p>
                <p className="text-gray-400">Employee will receive login credentials via email</p>
              </div>
              
              <div className="p-3 bg-yellow-900/20 rounded border border-yellow-700/30">
                <p className="font-medium mb-1">✓ Password Reset</p>
                <p className="text-gray-400">Employee can reset password on first login</p>
              </div>
              
              <div className="p-3 bg-purple-900/20 rounded border border-purple-700/30">
                <p className="font-medium mb-1">✓ Access Permissions</p>
                <p className="text-gray-400">Employee role grants access to task dashboard only</p>
              </div>
              
              <div className="p-3 bg-green-900/20 rounded border border-green-700/30">
                <p className="font-medium mb-1">✓ System Access</p>
                <p className="text-gray-400">Default status is "active" - can be disabled later</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= LIST TAB ================= */}
      {activeTab === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee List */}
          <div className="lg:col-span-2">
            <div className="bg-[#1f2933] p-6 rounded-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-lg">Employee Directory</h3>
                <div className="flex gap-2">
                  <input
                    className="p-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="p-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="none">Sort by</option>
                    <option value="az">A → Z</option>
                    <option value="za">Z → A</option>
                    <option value="active">Active First</option>
                    <option value="disabled">Disabled First</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp._id}
                    className={`p-4 rounded border transition-all cursor-pointer ${
                      selectedEmployee?._id === emp._id
                        ? "border-blue-500 bg-blue-900/20"
                        : "border-gray-700 bg-[#020617] hover:bg-gray-800/30"
                    }`}
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="font-semibold">
                              {emp.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            <p className="text-sm text-gray-400">{emp.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 text-xs rounded-full ${
                            emp.status === "active"
                              ? "bg-green-900/50 text-green-400 border border-green-700/50"
                              : "bg-red-900/50 text-red-400 border border-red-700/50"
                          }`}
                        >
                          {emp.status}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(emp._id);
                          }}
                          className="px-3 py-1 text-xs bg-yellow-700 hover:bg-yellow-600 rounded"
                        >
                          {emp.status === "active" ? "Disable" : "Enable"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEmployee(emp._id);
                          }}
                          className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Employee Quick View */}
          <div>
            {selectedEmployee ? (
              <div className="bg-[#1f2933] p-6 rounded-lg sticky top-6">
                <h3 className="font-semibold text-lg mb-4">Employee Quick View</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded">
                    <div className="w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center">
                      <span className="font-bold text-lg">
                        {selectedEmployee.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{selectedEmployee.name}</p>
                      <p className="text-sm text-gray-400">{selectedEmployee.email}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-gray-800/30 rounded">
                      <p className="text-sm text-gray-400">Status</p>
                      <p className={`font-medium ${
                        selectedEmployee.status === "active" ? "text-green-400" : "text-red-400"
                      }`}>
                        {selectedEmployee.status}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-800/30 rounded">
                      <p className="text-sm text-gray-400">Joined</p>
                      <p className="font-medium">
                        {selectedEmployee.createdAt 
                          ? new Date(selectedEmployee.createdAt).toLocaleDateString() 
                          : "Not available"}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-800/30 rounded">
                      <p className="text-sm text-gray-400">Assigned Tasks</p>
                      <p className="font-medium">{employeeTasks.length}</p>
                    </div>

                    <button
                      onClick={() => setActiveTab("profile")}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
                    >
                      View Full Profile
                    </button>

                    <button
                      onClick={() => {
                        setSelectedEmployee(null);
                        setEmployeeTasks([]);
                      }}
                      className="w-full bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1f2933] p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Quick View</h3>
                <div className="text-center p-6">
                  <p className="text-gray-400">Select an employee from the list to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PROFILE TAB (UPDATED WITH NEW METRICS) ================= */}
      {activeTab === "profile" && selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Profile */}
          <div className="lg:col-span-2">
            <div className="bg-[#1f2933] p-6 rounded-lg">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-900/50 flex items-center justify-center">
                    <span className="font-bold text-2xl">
                      {selectedEmployee.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl">{selectedEmployee.name}</h3>
                    <p className="text-gray-400">{selectedEmployee.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-3 py-1 text-xs rounded-full ${
                        selectedEmployee.status === "active"
                          ? "bg-green-900/50 text-green-400 border border-green-700/50"
                          : "bg-red-900/50 text-red-400 border border-red-700/50"
                      }`}>
                        {selectedEmployee.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        Joined: {selectedEmployee.createdAt 
                          ? new Date(selectedEmployee.createdAt).toLocaleDateString() 
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("list")}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Back to List
                </button>
              </div>

              {/* ADDED: Enhanced Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">Total Tasks</p>
                  <p className="text-2xl font-bold">{metrics.totalTasks}</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">Verified</p>
                  <p className="text-2xl font-bold text-green-400">{metrics.completedTasks}</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">{metrics.pendingTasks}</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">Overdue</p>
                  <p className={`text-2xl font-bold ${metrics.overdueTasks > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {metrics.overdueTasks}
                  </p>
                </div>
              </div>

              {/* ADDED: Additional Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">Reopened</p>
                  <p className="text-2xl font-bold text-orange-400">{metrics.reopenedTasks}</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">Failed/Declined</p>
                  <p className="text-2xl font-bold text-red-400">{metrics.failedTasks}</p>
                </div>
                <div className="bg-gray-800/30 p-4 rounded">
                  <p className="text-sm text-gray-400">On Time Rate</p>
                  <p className="text-2xl font-bold text-blue-400">{metrics.onTimeRate}%</p>
                </div>
              </div>

              {/* ADDED: Completion Rate Bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-400">Completion Rate</p>
                  <p className="text-sm font-medium">{metrics.completionRate}%</p>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${metrics.completionRate}%` }}
                  ></div>
                </div>
              </div>

              {/* ADDED: Enhanced Recent Tasks Display */}
              <div>
                <h4 className="font-semibold mb-4">Recent Tasks ({employeeTasks.length})</h4>
                {loadingTasks ? (
                  <div className="text-center p-6">
                    <p className="text-gray-400">Loading tasks...</p>
                  </div>
                ) : employeeTasks.length > 0 ? (
                  <div className="space-y-3">
                    {employeeTasks.slice(0, 5).map(task => {
                      const statusInfo = getTaskStatusInfo(task);
                      const slaStatus = getTaskSLAStatus(task);
                      const isReopened = task.activityTimeline?.some(e => e.action === "TASK_REOPENED");
                      
                      return (
                        <div key={task._id} className="p-3 border border-gray-700 rounded hover:bg-gray-800/30 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{task.title}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-1 text-xs rounded ${statusInfo.color} ${statusInfo.text}`}>
                                  {statusInfo.label}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded ${
                                  slaStatus === 'Overdue' ? 'bg-red-900/50 text-red-400' :
                                  slaStatus === 'On Track' ? 'bg-green-900/50 text-green-400' :
                                  'bg-blue-900/50 text-blue-400'
                                }`}>
                                  {slaStatus}
                                </span>
                                {task.dueDate && (
                                  <span className="text-xs text-gray-500">
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Show reopened badge */}
                            {isReopened && (
                              <span className="ml-2 px-2 py-1 text-xs bg-orange-900/50 text-orange-400 rounded">
                                🔄 Reopened
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-gray-700 rounded">
                    <p className="text-gray-400">No tasks assigned yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Panel with Added Summary */}
          <div>
            <div className="bg-[#1f2933] p-6 rounded-lg sticky top-6">
              <h3 className="font-semibold text-lg mb-4">Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => toggleStatus(selectedEmployee._id)}
                  className="w-full bg-yellow-700 hover:bg-yellow-600 px-4 py-3 rounded font-medium transition-colors"
                >
                  {selectedEmployee.status === "active" ? "Disable Employee" : "Enable Employee"}
                </button>

                <button
                  onClick={() => deleteEmployee(selectedEmployee._id)}
                  className="w-full bg-red-700 hover:bg-red-600 px-4 py-3 rounded font-medium transition-colors"
                >
                  Delete Employee
                </button>

                {/* ADDED: Performance Summary */}
                <div className="p-4 bg-blue-900/20 rounded border border-blue-700/30">
                  <p className="text-sm font-medium mb-2">Performance Summary</p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>✓ Verified: {metrics.completedTasks} tasks</p>
                    <p>✓ Overdue: {metrics.overdueTasks} tasks</p>
                    <p>✓ Reopened: {metrics.reopenedTasks} times</p>
                    <p>✓ On Time: {metrics.onTimeRate}% rate</p>
                  </div>
                </div>

                <div className="p-4 bg-purple-900/20 rounded border border-purple-700/30">
                  <p className="text-sm font-medium mb-2">Need more insights?</p>
                  <p className="text-xs text-gray-400">
                    View detailed performance analytics and task history in Employee Insights section.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
