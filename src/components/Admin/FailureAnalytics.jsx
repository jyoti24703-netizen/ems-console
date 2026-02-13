import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthProvider";
import {
import { API_BASE_URL } from "../../config/api";
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";

const FailureAnalytics = () => {
  const { user } = useContext(AuthContext);
  const [failureData, setFailureData] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [systemSignals, setSystemSignals] = useState(null);

  const chartColors = ["#ef4444", "#f59e0b", "#f97316", "#3b82f6", "#8b5cf6", "#22c55e", "#64748b"];

  const fetchFailureIntelligence = async (days) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tasks/intelligence/failures?timeframe=${days}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      const data = await res.json();
      if (data.success) {
        if (data.intelligence) {
          setFailureData({
            summary: data.summary || {},
            intelligence: data.intelligence
          });
        } else if (data.patterns) {
          setFailureData({ patterns: data.patterns, tasks: data.tasks || [] });
        } else {
          setFailureData(null);
        }
      } else {
        setFailureData(null);
        setError(data.error || "Failed to load failure intelligence");
      }
    } catch (err) {
      console.error("Failed to fetch failure intelligence:", err);
      setFailureData(null);
      setError(err.message || "Failed to load failure intelligence");
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemSignals = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      const tasks = data.tasks || [];
      const now = new Date();
      const closedStatuses = ["completed", "verified", "failed", "declined_by_employee", "deleted", "withdrawn"];
      const openTasks = tasks.filter(t => !closedStatuses.includes(t.status));
      const overdueOpen = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
      const reopenedActive = tasks.filter(t => t.status === "reopened");
      const declinedTasks = tasks.filter(t => t.status === "declined_by_employee");
      const urgentHigh = openTasks.filter(t => {
        if (!t.dueDate) return false;
        const pr = (t.priority || "").toLowerCase();
        if (!["high", "critical"].includes(pr)) return false;
        const daysUntilDue = Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 1 && daysUntilDue >= 0;
      });
      const noResponse = openTasks.filter(t => {
        if ((t.status || "").toLowerCase() !== "assigned") return false;
        if (t.acceptedAt) return false;
        const ageHours = (now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        return ageHours >= 24;
      });
      setSystemSignals({
        openTasks: openTasks.length,
        overdueOpen: overdueOpen.length,
        reopenedActive: reopenedActive.length,
        declinedTasks: declinedTasks.length,
        urgentHigh: urgentHigh.length,
        noResponse: noResponse.length
      });
    } catch (_err) {
      setSystemSignals(null);
    }
  };

  useEffect(() => {
    fetchFailureIntelligence(timeframe);
    fetchSystemSignals();
  }, [timeframe]);

  const intelligence = failureData?.intelligence;
  const summary = failureData?.summary || {};

  const failureTypeData = useMemo(() => {
    if (!intelligence?.failureTypes) return [];
    return Object.entries(intelligence.failureTypes)
      .map(([name, details]) => ({ name, value: details.count || 0 }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [intelligence]);

  const departmentData = useMemo(() => {
    if (!intelligence?.departmentFailures) return [];
    return Object.entries(intelligence.departmentFailures)
      .map(([name, details]) => ({ name, value: details.totalFailures || 0 }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [intelligence]);

  const rootCauseData = useMemo(() => {
    if (!intelligence?.rootCauses) return [];
    return Object.entries(intelligence.rootCauses)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [intelligence]);

  const topEmployees = useMemo(() => {
    if (!intelligence?.employeeFailures) return [];
    return intelligence.employeeFailures.slice(0, 6);
  }, [intelligence]);

  const trendData = useMemo(() => {
    if (!intelligence?.trend) return [];
    return Object.entries(intelligence.trend)
      .map(([date, details]) => ({
        date,
        total: details.total || 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [intelligence]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 animate-pulse">
          Analyzing failure patterns...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 p-6 rounded-lg text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!failureData) {
    return (
      <div className="bg-gray-800 p-12 rounded-lg text-center">
        <p className="text-gray-400">No failure data available</p>
      </div>
    );
  }

  if (failureData.patterns) {
    const { patterns } = failureData;
    const topEmployeesLegacy = patterns.byEmployeeArray || [];
    const topReasons = patterns.byReasonArray || [];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold">Failure Intelligence</h3>
            <p className="text-sm text-gray-400">
              Summary based on failed tasks in selected timeframe
            </p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                className={`px-3 py-1 rounded text-sm ${
                  timeframe === days
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Total Failures</div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {patterns.totalFailures || 0}
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Late Submissions</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">
              {patterns.lateSubmissions || 0}
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Quality Issues</div>
            <div className="text-2xl font-bold text-orange-400 mt-1">
              {patterns.qualityIssues || 0}
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Avg Time To Failure</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {patterns.averageTimeToFailure || 0}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Top Employees (Failures)</h4>
            {topEmployeesLegacy.length === 0 ? (
              <p className="text-gray-400 text-sm">No data</p>
            ) : (
              <div className="space-y-2">
                {topEmployeesLegacy.slice(0, 6).map((item) => (
                  <div key={item.employeeId} className="flex justify-between text-sm">
                    <span className="text-gray-300">{item.name}</span>
                    <span className="text-red-400">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Top Failure Reasons</h4>
            {topReasons.length === 0 ? (
              <p className="text-gray-400 text-sm">No data</p>
            ) : (
              <div className="space-y-2">
                {topReasons.slice(0, 6).map((item, idx) => (
                  <div key={`${item.reason}-${idx}`} className="flex justify-between text-sm">
                    <span className="text-gray-300 truncate">{item.reason}</span>
                    <span className="text-yellow-400">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (intelligence) {
    const totalFailures = summary.totalFailures ?? 0;
    const failureRate = summary.failureRate ?? 0;
    const commonFailure = summary.mostCommonFailureType || "None";

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold">Failure Intelligence</h3>
            <p className="text-sm text-gray-400">
              Enterprise view of risk patterns, root causes, and trend signals.
            </p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                className={`px-3 py-1 rounded text-sm ${
                  timeframe === days
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Total Failures</div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {totalFailures}
            </div>
            <div className="text-xs text-gray-500 mt-1">within {summary.totalTasks ?? 0} tasks</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Failure Rate</div>
            <div className="text-2xl font-bold text-orange-400 mt-1">
              {failureRate}%
            </div>
            <div className="text-xs text-gray-500 mt-1">share of all tasks</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Most Common</div>
            <div className="text-lg font-semibold text-yellow-300 mt-2">
              {commonFailure}
            </div>
            <div className="text-xs text-gray-500 mt-1">primary failure type</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Root Causes Tracked</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {rootCauseData.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">distinct causes</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Open Tasks</div>
            <div className="text-2xl font-bold">{systemSignals?.openTasks ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">currently active</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Overdue Open</div>
            <div className="text-2xl font-bold text-red-400">{systemSignals?.overdueOpen ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">risk exposure</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Urgent High Priority</div>
            <div className="text-2xl font-bold text-orange-400">{systemSignals?.urgentHigh ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">due within 24h</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">No Response</div>
            <div className="text-2xl font-bold text-yellow-400">{systemSignals?.noResponse ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">assigned & unaccepted</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Reopened Active</div>
            <div className="text-2xl font-bold text-purple-400">{systemSignals?.reopenedActive ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">quality risk</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Declined Tasks</div>
            <div className="text-2xl font-bold text-gray-300">{systemSignals?.declinedTasks ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">capacity pressure</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Failure Types</h4>
            {failureTypeData.length === 0 ? (
              <p className="text-gray-400 text-sm">No failure types recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={failureTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Failure Trend</h4>
            {trendData.length === 0 ? (
              <p className="text-gray-400 text-sm">No trend data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Department Exposure</h4>
            {departmentData.length === 0 ? (
              <p className="text-gray-400 text-sm">No department failure data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={78}
                    labelLine
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {departmentData.map((entry, idx) => (
                      <Cell key={entry.name} fill={chartColors[idx % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Root Causes</h4>
            {rootCauseData.length === 0 ? (
              <p className="text-gray-400 text-sm">No root causes logged.</p>
            ) : (
              <div className="space-y-2">
                {rootCauseData.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate">{item.name}</span>
                    <span className="text-yellow-400">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Top Employees (Failures)</h4>
            {topEmployees.length === 0 ? (
              <p className="text-gray-400 text-sm">No employee failure data.</p>
            ) : (
              <div className="space-y-2">
                {topEmployees.map((item) => (
                  <div key={item.employee?._id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-gray-200">{item.employee?.name || "Unknown"}</div>
                      <div className="text-xs text-gray-500">{item.employee?.email}</div>
                    </div>
                    <span className="text-red-400">{item.totalFailures}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Recommendations</h4>
            {intelligence.recommendations && intelligence.recommendations.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-300">
                {intelligence.recommendations.slice(0, 6).map((rec, idx) => (
                  <li key={`${rec}-${idx}`} className="bg-gray-700/50 rounded px-3 py-2">
                    {rec}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">No recommendations generated.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default FailureAnalytics;
