import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthProvider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from "recharts";

const MeetingAnalytics = ({ meetingId, timeRange = "month", meetingsData = [] }) => {
  const { user } = useContext(AuthContext);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  useEffect(() => {
    setLoading(true);
    setAnalytics(null);
    if (meetingId) {
      fetchMeetingAnalytics();
    } else if (user?.role === "admin") {
      fetchAdminAggregateAnalytics();
    } else {
      fetchUserAnalytics();
    }
  }, [meetingId, timeRange, user?.role, meetingsData]);

  const fetchMeetingAnalytics = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/meetings/${meetingId}/analytics`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAnalytics = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/meetings/user/stats?period=${timeRange}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch user analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminAggregateAnalytics = async () => {
    try {
      const meetings = Array.isArray(meetingsData)
        ? Object.values(
            meetingsData.reduce((acc, m) => {
              if (m?._id) acc[m._id] = m;
              return acc;
            }, {})
          )
        : [];

      const meetingsById = Object.values(
        meetings.reduce((acc, m) => {
          acc[m._id] = m;
          return acc;
        }, {})
      );

      const byStatus = {
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      };
      const actionByStatus = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        blocked: 0
      };

      let totalInvitees = 0;
      let attended = 0;
      let accepted = 0;
      let declined = 0;
      let tentative = 0;
      let pending = 0;
      let totalDuration = 0;
      let messageCount = 0;
      let totalActionItems = 0;
      let completedActionItems = 0;

      const uniqueParticipants = new Set();
      const uniqueInvitees = new Set();

      meetingsById.forEach((meeting) => {
        const status = meeting.status || "scheduled";
        if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
          byStatus[status] += 1;
        }

        totalDuration += Number(meeting.analytics?.actualDuration || meeting.duration || 0);

        const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
        const hasMarkedAttendance = attendees.some(a => Boolean(a?.attended));

        attendees.forEach((att) => {
          const attendeeId = att?.employee?._id || att?.employee;
          if (attendeeId) uniqueInvitees.add(String(attendeeId));

          totalInvitees += 1;
          if (att?.attended) {
            attended += 1;
          } else if (!hasMarkedAttendance && (att?.rsvpStatus === "accepted" || att?.rsvpStatus === "tentative")) {
            // Fallback for meetings where attendance was not marked yet.
            attended += 1;
          }

          if (att?.rsvpStatus === "accepted") accepted += 1;
          else if (att?.rsvpStatus === "declined") declined += 1;
          else if (att?.rsvpStatus === "tentative") tentative += 1;
          else pending += 1;
        });

        const discussion = Array.isArray(meeting.discussion) ? meeting.discussion : [];
        messageCount += discussion.length;
        discussion.forEach((msg) => {
          const senderId = msg?.sender?._id || msg?.sender;
          if (senderId) uniqueParticipants.add(String(senderId));
        });

        const actionItems = Array.isArray(meeting.actionItems) ? meeting.actionItems : [];
        totalActionItems += actionItems.length;
        actionItems.forEach((item) => {
          const st = item?.status || "pending";
          if (Object.prototype.hasOwnProperty.call(actionByStatus, st)) {
            actionByStatus[st] += 1;
          }
          if (st === "completed") completedActionItems += 1;
        });
      });

      const denominator = uniqueInvitees.size || totalInvitees || 1;
      const participationRate = Number(((uniqueParticipants.size / denominator) * 100).toFixed(1));
      const attendanceRate = totalInvitees > 0
        ? Number(((attended / totalInvitees) * 100).toFixed(1))
        : 0;

      setAnalytics({
        totalMeetings: meetingsById.length,
        averageDuration: meetingsById.length > 0 ? totalDuration / meetingsById.length : 0,
        byStatus,
        attendance: {
          total: totalInvitees,
          attended,
          accepted,
          declined,
          tentative,
          pending,
          attendanceRate
        },
        engagement: {
          activeParticipants: uniqueParticipants.size,
          participationRate,
          messageCount,
          messagesPerParticipant: uniqueParticipants.size > 0
            ? Number((messageCount / uniqueParticipants.size).toFixed(1))
            : 0,
          actionItemsCount: totalActionItems,
          actionItemCompletionRate: totalActionItems > 0
            ? Number(((completedActionItems / totalActionItems) * 100).toFixed(1))
            : 0
        },
        actionItems: {
          total: totalActionItems,
          byStatus: actionByStatus,
          completionRate: totalActionItems > 0
            ? Number(((completedActionItems / totalActionItems) * 100).toFixed(1))
            : 0
        }
      });
    } catch (err) {
      console.error("Failed to fetch admin aggregate analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const resolved = useMemo(() => {
    if (!analytics) return null;

    const hasAttendance = !!analytics.attendance;
    const attendanceTotal = hasAttendance
      ? analytics.attendance.total || 0
      : analytics.invited || analytics.totalMeetings || 0;
    const attendanceAttended = hasAttendance
      ? analytics.attendance.attended || 0
      : analytics.attended || 0;
    const attendancePending = hasAttendance
      ? analytics.attendance.pending || 0
      : Math.max(attendanceTotal - attendanceAttended, 0);

    const attendance = hasAttendance
      ? {
          total: analytics.attendance.total || 0,
          attended: analytics.attendance.attended || 0,
          accepted: analytics.attendance.accepted || 0,
          declined: analytics.attendance.declined || 0,
          tentative: analytics.attendance.tentative || 0,
          pending: analytics.attendance.pending || 0,
          attendanceRate: parseFloat(analytics.attendance.attendanceRate || 0)
        }
      : {
          total: attendanceTotal,
          attended: attendanceAttended,
          accepted: 0,
          declined: 0,
          tentative: 0,
          pending: attendancePending,
          attendanceRate: attendanceTotal > 0
            ? parseFloat(((attendanceAttended / attendanceTotal) * 100).toFixed(1))
            : 0
        };

    const engagement = analytics.engagement || {
      activeParticipants: 0,
      participationRate: 0,
      messageCount: 0,
      messagesPerParticipant: 0,
      actionItemsCount: analytics.actionItems?.total || 0,
      actionItemCompletionRate: analytics.actionItems?.completionRate || 0
    };

    const timing = analytics.timing || {};
    const averageDuration = analytics.averageDuration || timing.actualDuration || 0;

    return {
      ...analytics,
      attendance,
      engagement,
      timing,
      averageDuration
    };
  }, [analytics]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-4xl mb-4">Analytics</div>
        <h3 className="text-xl font-semibold mb-2">No Analytics Data</h3>
        <p className="text-gray-400">Analytics data will appear after meetings are held and tracked.</p>
      </div>
    );
  }

  const attendanceChartData = resolved.attendance.accepted ||
    resolved.attendance.declined ||
    resolved.attendance.tentative
    ? [
        { name: "Attended", value: resolved.attendance.attended || 0 },
        { name: "Accepted", value: resolved.attendance.accepted || 0 },
        { name: "Declined", value: resolved.attendance.declined || 0 },
        { name: "Tentative", value: resolved.attendance.tentative || 0 },
        { name: "Pending", value: resolved.attendance.pending || 0 }
      ]
    : [
        { name: "Attended", value: resolved.attendance.attended || 0 },
        { name: "Missed", value: Math.max((resolved.attendance.total || 0) - (resolved.attendance.attended || 0), 0) }
      ];

  const renderPieLabel = ({ name, percent, value }) => {
    if (!value || percent < 0.09) return "";
    return `${name}: ${(percent * 100).toFixed(0)}%`;
  };

  const statusChartData = resolved.byStatus
    ? [
        { name: "Scheduled", value: resolved.byStatus.scheduled || 0 },
        { name: "In Progress", value: resolved.byStatus.in_progress || 0 },
        { name: "Completed", value: resolved.byStatus.completed || 0 },
        { name: "Cancelled", value: resolved.byStatus.cancelled || 0 }
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-2">
        <button
          className={`px-4 py-2 font-medium ${activeTab === "overview" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-gray-300"}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === "attendance" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-gray-300"}`}
          onClick={() => setActiveTab("attendance")}
        >
          Attendance
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === "engagement" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-gray-300"}`}
          onClick={() => setActiveTab("engagement")}
        >
          Engagement
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Meetings</p>
                  <p className="text-3xl font-bold mt-2">
                    {resolved.totalMeetings || resolved.attendance.total || 0}
                  </p>
                </div>
                <div className="text-blue-500 text-2xl">Meetings</div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Attendance Rate</p>
                  <p className="text-3xl font-bold mt-2">
                    {resolved.attendance.attendanceRate || 0}%
                  </p>
                </div>
                <div className="text-green-500 text-2xl">Attendance</div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Avg Duration</p>
                  <p className="text-3xl font-bold mt-2">
                    {Math.round(resolved.averageDuration || 0)}m
                  </p>
                </div>
                <div className="text-purple-500 text-2xl">Duration</div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Engagement</p>
                  <p className="text-3xl font-bold mt-2">
                    {resolved.engagement.participationRate || 0}%
                  </p>
                </div>
                <div className="text-yellow-500 text-2xl">Engagement</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Attendance Overview</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={attendanceChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderPieLabel}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {attendanceChartData.map((_item, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Status Mix</h3>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="name" stroke="#aaa" />
                    <YAxis stroke="#aaa" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-gray-400 text-sm">
                  Status: {resolved.basic?.status || "N/A"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Attendance Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendanceChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderPieLabel}
                  outerRadius={90}
                  dataKey="value"
                >
                  {attendanceChartData.map((_item, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Attendance Metrics</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Total Invited</span>
                <span className="font-semibold">{resolved.attendance.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Attended</span>
                <span className="font-semibold">{resolved.attendance.attended || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending</span>
                <span className="font-semibold">{resolved.attendance.pending || 0}</span>
              </div>
              {resolved.attendance.accepted > 0 && (
                <div className="flex justify-between">
                  <span>Accepted</span>
                  <span className="font-semibold">{resolved.attendance.accepted || 0}</span>
                </div>
              )}
              {resolved.attendance.declined > 0 && (
                <div className="flex justify-between">
                  <span>Declined</span>
                  <span className="font-semibold">{resolved.attendance.declined || 0}</span>
                </div>
              )}
              {resolved.attendance.tentative > 0 && (
                <div className="flex justify-between">
                  <span>Tentative</span>
                  <span className="font-semibold">{resolved.attendance.tentative || 0}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "engagement" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Engagement Metrics</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Active Participants</span>
                <span className="font-semibold">{resolved.engagement.activeParticipants || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Participation Rate</span>
                <span className="font-semibold">{resolved.engagement.participationRate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span>Messages</span>
                <span className="font-semibold">{resolved.engagement.messageCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Messages / Participant</span>
                <span className="font-semibold">{resolved.engagement.messagesPerParticipant || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Action Items</span>
                <span className="font-semibold">{resolved.engagement.actionItemsCount || resolved.actionItems?.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Action Completion</span>
                <span className="font-semibold">{resolved.engagement.actionItemCompletionRate || resolved.actionItems?.completionRate || 0}%</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Action Items by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: "Pending", value: resolved.actionItems?.byStatus?.pending || 0 },
                { name: "In Progress", value: resolved.actionItems?.byStatus?.in_progress || 0 },
                { name: "Completed", value: resolved.actionItems?.byStatus?.completed || 0 },
                { name: "Blocked", value: resolved.actionItems?.byStatus?.blocked || 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingAnalytics;
