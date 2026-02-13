import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthProvider";
import MeetingAnalytics from "./MeetingAnalytics";
import MeetingTemplates from "./MeetingTemplates";
import { API_BASE_URL } from "../../config/api";

const MeetingManager = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showActionItemsModal, setShowActionItemsModal] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [analyticsMeetingId, setAnalyticsMeetingId] = useState("all");
  const [discussion, setDiscussion] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const toAbsoluteAssetUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
  };
  const [newNote, setNewNote] = useState("");
  const [newActionItem, setNewActionItem] = useState({
    description: "",
    assignedTo: "",
    dueDate: "",
    resourceType: "none",
    resourceLabel: "",
    resourceUrl: "",
    resourceFile: null
  });
  const [newRecording, setNewRecording] = useState({
    url: "",
    type: "video",
    duration: 0,
    recordingFile: null
  });
  const [attendanceData, setAttendanceData] = useState([]);
  const buildRecordingPlayerUrl = (recording) => {
    if (!recording?.url) return "#";
    const params = new URLSearchParams({
      src: toAbsoluteAssetUrl(recording.url),
      name: recording.fileName || "meeting-recording.mp4",
      mime: recording.mimeType || "video/mp4"
    });
    return `/meeting-recording?${params.toString()}`;
  };
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    agenda: "",
    meetingDate: "",
    meetingTime: "",
    duration: 60,
    meetingLink: "",
    audience: "selected",
    selectedEmployees: [],
    isRecurring: false,
    recurrencePattern: "none"
  });
  const defaultMeetingForm = {
    title: "",
    description: "",
    agenda: "",
    meetingDate: "",
    meetingTime: "",
    duration: 60,
    meetingLink: "",
    audience: "selected",
    selectedEmployees: [],
    isRecurring: false,
    recurrencePattern: "none"
  };

  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: "",
    newTime: "",
    reason: ""
  });

  // ✅ Template selection handler
  const handleTemplateSelect = (template) => {
    setForm({
      ...defaultMeetingForm,
      title: template.title || "",
      agenda: template.agenda || "",
      duration: template.duration || 60,
      recurrencePattern: template.recurrencePattern || "none",
      tags: template.tags || []
    });
    setShowCreateModal(true);
    setActiveTab("upcoming");
  };

  // Fetch meetings
  const fetchMeetings = async (type = "upcoming") => {
    try {
      if (type === "templates") return;
      if (type === "analytics") {
        const [upcomingRes, pastRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/meetings/upcoming`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API_BASE_URL}/api/meetings/past`, {
            headers: { Authorization: `Bearer ${user.token}` },
          })
        ]);
        const upcomingData = await upcomingRes.json();
        const pastData = await pastRes.json();
        const combinedRaw = [
          ...(upcomingData.meetings || []),
          ...(pastData.meetings || [])
        ];
        const combined = Object.values(
          combinedRaw.reduce((acc, m) => {
            if (m?._id) acc[m._id] = m;
            return acc;
          }, {})
        ).sort((a, b) => new Date(b.meetingDateTime) - new Date(a.meetingDateTime));
        setMeetings(combined);
        return;
      }

      const endpoint = type === "upcoming" ? "/upcoming" : "/past";
      const res = await fetch(`${API_BASE_URL}/api/meetings${endpoint}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees - FIXED VERSION
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setEmployees([]); // ✅ Set empty array on error
    }
  };

  // Fetch discussion
  const fetchDiscussion = async (meetingId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/discussion`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDiscussion(data.discussion || []);
      }
    } catch (err) {
      console.error("Failed to fetch discussion:", err);
    }
  };

  // Fetch full meeting details
  const fetchMeetingDetails = async (meetingId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/details/${meetingId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSelectedMeeting(data.meeting);
      }
    } catch (err) {
      console.error("Failed to fetch meeting details:", err);
    }
  };

  // Load attendance data when modal opens
  const loadAttendanceData = (meeting) => {
    const attendeesById = new Map(
      (meeting.attendees || []).map(attendee => [attendee.employee?._id || attendee.employee, attendee])
    );
    const meetingStart = meeting.meetingDateTime ? new Date(meeting.meetingDateTime).getTime() : null;

    const attendance = employees
      .filter(emp => emp.status !== "inactive")
      .map(emp => {
        const existing = attendeesById.get(emp._id);
        const joinTime = existing?.joinTime ? new Date(existing.joinTime).toISOString().slice(0, 16) : "";
        const lateJoin = meetingStart && existing?.joinTime
          ? new Date(existing.joinTime).getTime() > meetingStart
          : false;
        return {
          employeeId: emp._id,
          employeeName: emp.name,
          attended: existing?.attended || false,
          rsvpStatus: existing?.rsvpStatus || "pending",
          joinTime,
          lateJoin
        };
      });
    setAttendanceData(attendance);
  };

  // Initial bootstrap: load employee directory once.
  useEffect(() => {
    const initData = async () => {
      await fetchEmployees();
    };
    initData();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMeetings(activeTab);
  }, [activeTab]);

  // Create meeting - DEBUG VERSION
  const handleCreateMeeting = async () => {
    console.log("🚀 START: handleCreateMeeting function called!");
    console.log("📝 Form data:", form);
    
    try {
      if (!form.title || !form.meetingDate || !form.meetingTime) {
        alert("Title, date, and time are required");
        return;
      }
      if (form.audience !== "all" && form.selectedEmployees.length === 0) {
        alert("Select at least one employee or choose 'All Employees'.");
        return;
      }

      // ✅ FIXED PAYLOAD - matches backend expectations
      const payload = {
        title: form.title,
        description: form.description || "",
        agenda: form.agenda || "",
        meetingDate: form.meetingDate,
        meetingTime: form.meetingTime,
        duration: parseInt(form.duration) || 60,
        meetingLink: form.meetingLink || "",
        audience: form.audience === "all" ? "all" : form.selectedEmployees,
        isRecurring: form.isRecurring || false,
        recurrencePattern: form.isRecurring ? form.recurrencePattern : "none",
        notifyAttendees: true
      };

      console.log("📤 PAYLOAD BEING SENT TO BACKEND:", payload);
      console.log("🔑 User token (first 20 chars):", user.token?.substring(0, 20));

      const res = await fetch(`${API_BASE_URL}/api/meetings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 Response status:", res.status);
      
      const data = await res.json();
      console.log("📥 RESPONSE FROM BACKEND:", data);
      
      if (!res.ok) {
        console.error("Backend error response:", data);
        throw new Error(data.error || data.message || "Failed to create meeting");
      }

      alert("✅ Meeting created successfully!");
      setShowCreateModal(false);
      // Reset form
      setForm(defaultMeetingForm);
      fetchMeetings(activeTab);
    } catch (err) {
      console.error("❌ ERROR creating meeting:", err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Toggle employee selection
  const toggleEmployee = (employeeId) => {
    setForm(prev => ({
      ...prev,
      selectedEmployees: prev.selectedEmployees.includes(employeeId)
        ? prev.selectedEmployees.filter(id => id !== employeeId)
        : [...prev.selectedEmployees, employeeId]
    }));
  };

  // Cancel meeting
  const handleCancelMeeting = async (meetingId) => {
    if (!window.confirm("Are you sure you want to cancel this meeting?")) return;

    const reason = prompt("Please provide a cancellation reason:");
    if (!reason) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) throw new Error("Failed to cancel meeting");

      alert("✅ Meeting cancelled successfully");
      fetchMeetings(activeTab);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Reschedule meeting
  const handleReschedule = async () => {
    try {
      if (!rescheduleForm.newDate || !rescheduleForm.newTime) {
        alert("New date and time are required");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/meetings/${selectedMeeting._id}/reschedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(rescheduleForm),
      });

      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to reschedule");
      }

      alert("✅ Meeting rescheduled successfully!");
      setShowRescheduleModal(false);
      setRescheduleForm({ newDate: "", newTime: "", reason: "" });
      if (data.meeting) {
        setSelectedMeeting(data.meeting);
        setMeetings(prev =>
          prev.map(m => (m._id === data.meeting._id ? data.meeting : m))
        );
      }
      await fetchMeetings("upcoming");
      await fetchMeetings("past");
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Send message
  const handleSendMessage = async (meetingId) => {
    if (!newMessage.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ text: newMessage }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      setNewMessage("");
      fetchDiscussion(meetingId);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Add meeting note
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${selectedMeeting._id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ content: newNote }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to add note");

      alert("✅ Note added successfully!");
      setNewNote("");
      setShowNotesModal(false);
      fetchMeetingDetails(selectedMeeting._id);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Add action item
  const handleAddActionItem = async () => {
    if (!newActionItem.description || !newActionItem.assignedTo) {
      alert("Description and assignee are required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("description", newActionItem.description);
      formData.append("assignedTo", newActionItem.assignedTo);
      formData.append("dueDate", newActionItem.dueDate || "");
      formData.append("resourceType", newActionItem.resourceType || "none");
      formData.append("resourceLabel", newActionItem.resourceLabel || "");
      formData.append("resourceUrl", newActionItem.resourceUrl || "");
      if (newActionItem.resourceFile) {
        formData.append("resourceFile", newActionItem.resourceFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/meetings/${selectedMeeting._id}/action-items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to add action item");

      alert("✅ Action item added successfully!");
      setNewActionItem({
        description: "",
        assignedTo: "",
        dueDate: "",
        resourceType: "none",
        resourceLabel: "",
        resourceUrl: "",
        resourceFile: null
      });
      setShowActionItemsModal(false);
      fetchMeetingDetails(selectedMeeting._id);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Upload recording
  const validateRecordingFile = (file) => new Promise((resolve) => {
    if (!file) {
      resolve({ ok: true });
      return;
    }
    if (!file.type?.startsWith("video/")) {
      resolve({ ok: false, reason: "Please upload a valid video file." });
      return;
    }

    const probeUrl = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const hasVideoTrack = (probe.videoWidth || 0) > 0 && (probe.videoHeight || 0) > 0;
      URL.revokeObjectURL(probeUrl);
      if (!hasVideoTrack) {
        resolve({ ok: false, reason: "Uploaded file has no video track (audio-only)." });
        return;
      }
      resolve({ ok: true });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(probeUrl);
      resolve({ ok: false, reason: "Video codec is not browser-playable. Please upload H.264 MP4/WebM." });
    };
    probe.src = probeUrl;
  });

  const handleUploadRecording = async () => {
    if (!newRecording.url && !newRecording.recordingFile) {
      alert("Recording URL or file is required");
      return;
    }

    try {
      const validation = await validateRecordingFile(newRecording.recordingFile);
      if (!validation.ok) {
        alert(`❌ ${validation.reason}`);
        return;
      }

      const formData = new FormData();
      formData.append("url", newRecording.url || "");
      formData.append("type", newRecording.type || "video");
      formData.append("duration", String(newRecording.duration || 0));
      if (newRecording.recordingFile) {
        formData.append("recordingFile", newRecording.recordingFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/meetings/${selectedMeeting._id}/recording`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to upload recording");

      alert("✅ Recording uploaded successfully!");
      setNewRecording({ url: "", type: "video", duration: 0, recordingFile: null });
      setShowRecordingModal(false);
      fetchMeetingDetails(selectedMeeting._id);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Mark attendance
  const handleMarkAttendance = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/${selectedMeeting._id}/attendance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ attendance: attendanceData }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to mark attendance");

      alert("✅ Attendance recorded successfully!");
      setShowAttendanceModal(false);
      fetchMeetingDetails(selectedMeeting._id);
      fetchMeetings(activeTab);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Update meeting status
  const handleUpdateStatus = async (meetingId, newStatus) => {
    if (!window.confirm(`Change meeting status to "${newStatus}"?`)) return;

    try {
      if (newStatus === "in_progress") {
        const targetMeeting = meetings.find(m => m._id === meetingId) || selectedMeeting;
        if (targetMeeting && !canStartMeetingNow(targetMeeting)) {
          alert("You cannot start this meeting before its scheduled time. Reschedule first to start earlier.");
          return;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      alert(`✅ Meeting status updated to "${newStatus}"!`);
      fetchMeetings(activeTab);
      if (selectedMeeting && selectedMeeting._id === meetingId) {
        fetchMeetingDetails(meetingId);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // Open meeting details
  const openMeetingDetails = (meeting) => {
    setSelectedMeeting(meeting);
    setShowDetailsModal(true);
    fetchMeetingDetails(meeting._id);
    fetchDiscussion(meeting._id);
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMeetingStatusColor = (status) => {
    const colors = {
      scheduled: "bg-blue-600",
      in_progress: "bg-green-600",
      completed: "bg-gray-600",
      cancelled: "bg-red-600",
      expired: "bg-amber-700"
    };
    return colors[status] || "bg-gray-600";
  };

  const canStartMeetingNow = (meeting) => {
    if (!meeting?.meetingDateTime) return false;
    return Date.now() >= new Date(meeting.meetingDateTime).getTime();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Meeting Management</h2>
        <button
          onClick={() => {
            setForm(defaultMeetingForm);
            setShowCreateModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          + Create Meeting
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`px-4 py-2 rounded ${
            activeTab === "upcoming"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-gray-300"
          }`}
        >
          📅 Upcoming Meetings
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`px-4 py-2 rounded ${
            activeTab === "past"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-gray-300"
          }`}
        >
          📋 Past Meetings
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded ${
            activeTab === "analytics"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-gray-300"
          }`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 rounded ${
            activeTab === "templates"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-gray-300"
          }`}
        >
          📋 Templates
        </button>
      </div>

      {/* Analytics & Templates */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Meeting Analytics</h3>
              <p className="text-sm text-gray-400">Review attendance, engagement, and meeting performance.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Meeting</label>
              <select
                className="bg-gray-900 border border-gray-700 text-sm rounded px-3 py-2"
                value={analyticsMeetingId}
                onChange={(e) => setAnalyticsMeetingId(e.target.value)}
              >
                <option value="all">All Meetings</option>
                {meetings.map(meeting => (
                  <option key={meeting._id} value={meeting._id}>
                    {meeting.title} · {new Date(meeting.meetingDateTime).toLocaleDateString('en-GB')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <MeetingAnalytics
            meetingId={analyticsMeetingId === "all" ? null : analyticsMeetingId}
            meetingsData={meetings}
          />
        </div>
      )}
      {activeTab === "templates" && <MeetingTemplates onSelectTemplate={handleTemplateSelect} />}

      {/* Meetings List */}
      {(activeTab === "upcoming" || activeTab === "past") && (
        <>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="bg-gray-800 p-8 rounded-lg text-center">
              <p className="text-gray-400">
                {activeTab === "upcoming" 
                  ? "No upcoming meetings scheduled"
                  : "No past meetings found"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div 
                  key={meeting._id} 
                  className="bg-gray-800 border border-gray-700 p-6 rounded-lg hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => openMeetingDetails(meeting)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold text-white">{meeting.title}</h3>
                        <span className={`px-3 py-1 text-xs rounded text-white ${getMeetingStatusColor(meeting.isExpired ? "expired" : meeting.status)}`}>
                          {meeting.isExpired ? "expired" : meeting.status}
                        </span>
                      </div>
                      
                      <div className="mt-3 space-y-2 text-sm text-gray-300">
                        <p>📅 {formatDateTime(meeting.meetingDateTime)}</p>
                        <p>⏱️ Duration: {meeting.duration} minutes</p>
                        <p>
                          Audience:{" "}
                          <span className="font-medium text-gray-200">
                            {meeting.audienceType === "all" ? "All Employees (Auto-invited)" : "Selected Employees"}
                          </span>
                        </p>
                        {meeting.meetingLink && (
                          <p>
                            🔗 <a 
                              href={meeting.meetingLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Join Meeting
                            </a>
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="mt-4 flex flex-wrap gap-4">
                        <div className="text-sm">
                          <span className="text-gray-400">Notes: </span>
                          <span className="text-white">{meeting.notes?.length || 0}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-400">Action Items: </span>
                          <span className="text-white">{meeting.actionItems?.length || 0}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-400">Discussion: </span>
                          <span className="text-white">{meeting.discussion?.length || 0}</span>
                        </div>
                      </div>

                      {/* Attendees Preview */}
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-300 mb-2">
                          Attendees ({meeting.attendees?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {meeting.attendees?.slice(0, 5).map((attendee) => (
                            <span 
                              key={attendee._id} 
                              className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                            >
                              {attendee.employee?.name || "Unknown"}{" "}
                              <span className="text-gray-400">
                                (RSVP: {attendee.rsvpStatus || "pending"})
                              </span>
                            </span>
                          ))}
                          {meeting.attendees?.length > 5 && (
                            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                              +{meeting.attendees.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    {user.role === "admin" && activeTab === "upcoming" && (
                      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        {meeting.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedMeeting(meeting);
                                setShowRescheduleModal(true);
                              }}
                              className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-sm"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(meeting._id, "in_progress")}
                              disabled={!canStartMeetingNow(meeting)}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-2 rounded text-sm"
                            >
                              Start Meeting
                            </button>
                            <button
                              onClick={() => handleCancelMeeting(meeting._id)}
                              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            loadAttendanceData(meeting);
                            setShowAttendanceModal(true);
                          }}
                          disabled={meeting.status !== "in_progress"}
                          className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-2 rounded text-sm"
                          title={meeting.status !== "in_progress" ? "Start meeting first to mark attendance" : "Mark attendance"}
                        >
                          Mark Attendance
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Create New Meeting</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Meeting Title *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <textarea
                placeholder="Description"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <textarea
                placeholder="Agenda"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="3"
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={form.meetingDate}
                  onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                />
                <input
                  type="time"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={form.meetingTime}
                  onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    min="15"
                    step="15"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Meeting Link</label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={form.meetingLink}
                    onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                  />
                </div>
              </div>

              {/* Audience Selection */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Invite</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.audience === "all"}
                      onChange={() => setForm({ ...form, audience: "all", selectedEmployees: [] })}
                    />
                    <span>All Employees</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.audience === "selected"}
                      onChange={() => setForm({ ...form, audience: "selected" })}
                    />
                    <span>Selected Employees</span>
                  </label>
                </div>
              </div>

              {/* Employee Selection */}
              {form.audience === "selected" && (
                <div className="border border-gray-700 rounded p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-400 mb-2">
                    Select employees ({form.selectedEmployees.length} selected):
                  </p>
                  {employees.filter(e => e.status === "active").map((emp) => (
                    <label key={emp._id} className="flex items-center gap-2 py-1 hover:bg-gray-700 px-2 rounded">
                      <input
                        type="checkbox"
                        checked={form.selectedEmployees.includes(emp._id)}
                        onChange={() => toggleEmployee(emp._id)}
                      />
                      <span>{emp.name} ({emp.email})</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Recurring Meeting */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                  />
                  <span>Recurring Meeting</span>
                </label>
                
                {form.isRecurring && (
                  <select
                    className="w-full mt-2 p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={form.recurrencePattern}
                    onChange={(e) => setForm({ ...form, recurrencePattern: e.target.value })}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCreateMeeting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-medium"
                >
                  Create Meeting
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setForm(defaultMeetingForm);
                  }}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Details Modal with Discussion */}
      {showDetailsModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-semibold">{selectedMeeting.title}</h3>
                <span className={`inline-block mt-2 px-3 py-1 text-xs rounded text-white ${getMeetingStatusColor(selectedMeeting.isExpired ? "expired" : selectedMeeting.status)}`}>
                  {selectedMeeting.isExpired ? "expired" : selectedMeeting.status}
                </span>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Admin Actions */}
            {user.role === "admin" && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedMeeting.status === "scheduled" && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedMeeting._id, "in_progress")}
                      disabled={!canStartMeetingNow(selectedMeeting)}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-sm"
                    >
                      Start Meeting
                    </button>
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded text-sm"
                    >
                      Reschedule
                    </button>
                  </>
                )}
                {selectedMeeting.status === "in_progress" && (
                  <button
                    onClick={() => handleUpdateStatus(selectedMeeting._id, "completed")}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                  >
                    Complete Meeting
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowNotesModal(true);
                    setNewNote("");
                  }}
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm"
                >
                  Add Note
                </button>
                <button
                      onClick={() => {
                        setShowActionItemsModal(true);
                        setNewActionItem({
                          description: "",
                          assignedTo: "",
                          dueDate: "",
                          resourceType: "none",
                          resourceLabel: "",
                          resourceUrl: "",
                          resourceFile: null
                        });
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-sm"
                    >
                  Add Action Item
                </button>
                <button
                  onClick={() => {
                    setShowRecordingModal(true);
                    setNewRecording({ url: "", type: "video", duration: 0, recordingFile: null });
                  }}
                  className="bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded text-sm"
                >
                  Upload Recording
                </button>
                <button
                  onClick={() => {
                    if (selectedMeeting.status !== "in_progress") return;
                    setShowAttendanceModal(true);
                    loadAttendanceData(selectedMeeting);
                  }}
                  disabled={selectedMeeting.status !== "in_progress"}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-sm"
                  title={selectedMeeting.status !== "in_progress" ? "Start meeting to enable attendance." : "Mark attendance"}
                >
                  Mark Attendance
                </button>
                {selectedMeeting.status === "scheduled" && (
                  <button
                    onClick={() => handleCancelMeeting(selectedMeeting._id)}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
                  >
                    Cancel Meeting
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <p><strong>📅 Date:</strong> {formatDateTime(selectedMeeting.meetingDateTime)}</p>
              <p><strong>⏱️ Duration:</strong> {selectedMeeting.duration} minutes</p>
              {selectedMeeting.description && <p><strong>📝 Description:</strong> {selectedMeeting.description}</p>}
              {selectedMeeting.agenda && (
                <div>
                  <strong>📋 Agenda:</strong>
                  <p className="text-gray-400 whitespace-pre-wrap mt-1">{selectedMeeting.agenda}</p>
                </div>
              )}
              {selectedMeeting.meetingLink && (
                <p>
                  <strong>🔗 Link:</strong>{" "}
                  <a href={selectedMeeting.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    Join Meeting
                  </a>
                </p>
              )}
              {selectedMeeting.recording?.url && (
                <div className="space-y-2">
                  <p>
                    <strong>Recording:</strong>{" "}
                    <a
                      href={buildRecordingPlayerUrl(selectedMeeting.recording)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {selectedMeeting.recording.fileName || "meeting-recording.mp4"}
                    </a>
                  </p>
                  <p className="text-xs text-gray-400">Opens in a full-screen player tab.</p>
                </div>
              )}
            </div>

            {/* Meeting Notes */}
            {selectedMeeting.notes && selectedMeeting.notes.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">📝 Meeting Notes</h4>
                <div className="space-y-3">
                  {selectedMeeting.notes.map((note, idx) => (
                    <div key={idx} className="bg-gray-900 rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-white">
                          {note.addedBy?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(note.addedAt).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-gray-300">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {selectedMeeting.actionItems && selectedMeeting.actionItems.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">✅ Action Items</h4>
                <div className="space-y-3">
                  {selectedMeeting.actionItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-900 rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-white">{item.description}</span>
                          <span className={`ml-3 px-2 py-1 text-xs rounded ${
                            item.status === "completed" ? "bg-green-600" :
                            item.status === "in_progress" ? "bg-yellow-600" :
                            "bg-gray-600"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        {item.dueDate && (
                          <span className="text-xs text-gray-500">
                            Due: {new Date(item.dueDate).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        Assigned to: {item.assignedTo?.name || item.assignedTo?.email || "Unknown"}
                      </p>
                      {item.resource?.type && item.resource.type !== "none" && (
                        <p className="text-sm text-blue-300 mt-1">
                          Resource:{" "}
                          {(item.resource.url || item.resource.fileUrl) ? (
                            <a href={item.resource.url || item.resource.fileUrl} target="_blank" rel="noreferrer" className="underline">
                              {item.resource.label || item.resource.fileName || item.resource.url || item.resource.fileUrl}
                            </a>
                          ) : (
                            item.resource.label || "Document attached"
                          )}
                        </p>
                      )}
                      {item.submission?.status === "submitted" && (
                        <div className="text-xs text-green-300 mt-1 space-y-1">
                          <p>
                            Submitted by {item.submission.submittedBy?.name || "employee"} at{" "}
                            {item.submission.submittedAt ? new Date(item.submission.submittedAt).toLocaleString('en-GB') : "-"}
                          </p>
                          {item.submission.text && (
                            <p className="text-gray-300">Note: {item.submission.text}</p>
                          )}
                          {(item.submission.fileUrl || item.submission.url) && (
                            <a
                              href={item.submission.fileUrl || item.submission.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-blue-300"
                            >
                              Open submitted file/link
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discussion Section */}
            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-lg font-semibold mb-3">💬 Discussion ({discussion.length})</h4>
              
              <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto mb-4 space-y-3">
                {discussion.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No messages yet. Start the conversation!</p>
                ) : (
                  discussion.map((msg, idx) => (
                    <div key={idx} className="bg-gray-800 rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-blue-400">
                          {msg.senderName} 
                          <span className="text-xs text-gray-500 ml-2">({msg.senderRole})</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-gray-300">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage(selectedMeeting._id)}
                />
                <button
                  onClick={() => handleSendMessage(selectedMeeting._id)}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Reschedule Meeting</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">New Date *</label>
                <input
                  type="date"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={rescheduleForm.newDate}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">New Time *</label>
                <input
                  type="time"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  value={rescheduleForm.newTime}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, newTime: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Reason</label>
                <textarea
                  placeholder="Why is the meeting being rescheduled?"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                  rows="3"
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleReschedule}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-4 py-3 rounded font-medium"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Add Meeting Note</h3>
            
            <div className="space-y-4">
              <textarea
                placeholder="Enter meeting note..."
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="5"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddNote}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded font-medium"
                >
                  Add Note
                </button>
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Action Item Modal */}
      {showActionItemsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Add Action Item</h3>
            
            <div className="space-y-4">
              <textarea
                placeholder="Action item description *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                rows="3"
                value={newActionItem.description}
                onChange={(e) => setNewActionItem({...newActionItem, description: e.target.value})}
              />

              <select
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={newActionItem.assignedTo}
                onChange={(e) => setNewActionItem({...newActionItem, assignedTo: e.target.value})}
              >
                <option value="">Select Assignee *</option>
                {employees
                  .filter((e) => e.status !== "inactive")
                  .map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>

              <input
                type="date"
                placeholder="Due Date (Optional)"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={newActionItem.dueDate}
                onChange={(e) => setNewActionItem({...newActionItem, dueDate: e.target.value})}
              />

              <select
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={newActionItem.resourceType}
                onChange={(e) => setNewActionItem({...newActionItem, resourceType: e.target.value})}
              >
                <option value="none">No resource</option>
                <option value="link">Website / Form Link</option>
                <option value="document">Document Link (PDF/DOC)</option>
              </select>

              {newActionItem.resourceType !== "none" && (
                <>
                  <input
                    type="text"
                    placeholder="Resource label (optional)"
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={newActionItem.resourceLabel}
                    onChange={(e) => setNewActionItem({...newActionItem, resourceLabel: e.target.value})}
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    value={newActionItem.resourceUrl}
                    onChange={(e) => setNewActionItem({...newActionItem, resourceUrl: e.target.value})}
                  />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                    onChange={(e) => setNewActionItem({...newActionItem, resourceFile: e.target.files?.[0] || null})}
                  />
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddActionItem}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded font-medium"
                >
                  Add Action Item
                </button>
                <button
                  onClick={() => setShowActionItemsModal(false)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Recording Modal */}
      {showRecordingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Upload Recording</h3>
            
            <div className="space-y-4">
              <input
                type="url"
                placeholder="Recording URL *"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={newRecording.url}
                onChange={(e) => setNewRecording({...newRecording, url: e.target.value})}
              />

              <input
                type="file"
                accept="video/*"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                onChange={(e) => setNewRecording({...newRecording, recordingFile: e.target.files?.[0] || null})}
              />

              <input
                type="number"
                placeholder="Duration in minutes"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
                value={newRecording.duration}
                onChange={(e) => setNewRecording({...newRecording, duration: parseInt(e.target.value) || 0})}
              />

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUploadRecording}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 px-4 py-3 rounded font-medium"
                >
                  Upload Recording
                </button>
                <button
                  onClick={() => setShowRecordingModal(false)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Mark Attendance</h3>
            <div className="mb-4 text-sm text-gray-300">
              {attendanceData.filter(item => item.attended).length}/{attendanceData.length} present
              {" "}(
              {attendanceData.length > 0
                ? Math.round((attendanceData.filter(item => item.attended).length / attendanceData.length) * 100)
                : 0}
              %)
            </div>
            
            <div className="space-y-3">
              {attendanceData.map((item, index) => (
                <div key={item.employeeId} className="bg-gray-900 p-4 rounded space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                    <span className="font-medium text-white">{item.employeeName}</span>
                    <span className={`ml-3 px-2 py-1 text-xs rounded ${
                      item.rsvpStatus === "accepted" ? "bg-green-600" :
                      item.rsvpStatus === "declined" ? "bg-red-600" :
                      "bg-gray-600"
                    }`}>
                      RSVP: {item.rsvpStatus}
                    </span>
                    </div>
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">Present:</span>
                      <input
                        type="checkbox"
                        checked={item.attended}
                        onChange={(e) => {
                          const newData = [...attendanceData];
                          newData[index].attended = e.target.checked;
                          if (!e.target.checked) {
                            newData[index].lateJoin = false;
                            newData[index].joinTime = "";
                          }
                          setAttendanceData(newData);
                        }}
                        className="w-5 h-5"
                      />
                    </label>
                  </div>

                  {item.attended && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={item.lateJoin || false}
                          onChange={(e) => {
                            const newData = [...attendanceData];
                            newData[index].lateJoin = e.target.checked;
                            if (!e.target.checked) {
                              newData[index].joinTime = "";
                            }
                            setAttendanceData(newData);
                          }}
                        />
                        Late Join
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                        placeholder="Join time (optional)"
                        value={item.joinTime || ""}
                        onChange={(e) => {
                          const newData = [...attendanceData];
                          newData[index].joinTime = e.target.value;
                          setAttendanceData(newData);
                        }}
                        disabled={!item.lateJoin}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={handleMarkAttendance}
                className="flex-1 bg-orange-600 hover:bg-orange-700 px-4 py-3 rounded font-medium"
              >
                Save Attendance
              </button>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingManager;
