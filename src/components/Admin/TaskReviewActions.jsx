import { useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api";

const failureTypes = [
  { value: "quality_not_met", label: "Quality Not Met" },
  { value: "overdue_timeout", label: "Overdue Timeout" },
  { value: "incomplete_work", label: "Incomplete Work" },
  { value: "technical_issues", label: "Technical Issues" },
  { value: "communication_breakdown", label: "Communication Breakdown" },
  { value: "resource_constraints", label: "Resource Constraints" },
  { value: "other", label: "Other" },
];

const toAbsoluteUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
};

const TaskReviewActions = ({ task, token, onUpdated, canManageReviews = true, canManageTasks = true }) => {
  const [reviewNote, setReviewNote] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [failureType, setFailureType] = useState("quality_not_met");
  const [reopenReason, setReopenReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [archiveAfter, setArchiveAfter] = useState(false);
  const [archiveNote, setArchiveNote] = useState("");
  const [archiveNow, setArchiveNow] = useState(false);

  const hasWorkSubmission = useMemo(() => {
    const work = task.workSubmission || {};
    const hasLink = !!work.link && work.link.trim().length > 0;
    const hasFiles = (work.files?.length || 0) > 0;
    const hasNote = !!work.employeeNote && work.employeeNote.trim().length > 0;
    return hasLink || hasFiles || hasNote;
  }, [task.workSubmission]);
  const submissionFiles = task.workSubmission?.files || [];

  const canVerify =
    canManageReviews &&
    (task.canAdminVerify || task.status === "completed" || task.status === "reopened");
  const canFail =
    canManageReviews &&
    (task.canAdminFail ||
      task.status === "completed" ||
      task.status === "reopened" ||
      (task.status === "in_progress" && task.isOverdue));
  const canReopen = canManageReviews && (task.canAdminReopen || task.status === "verified");
  const canArchive = canManageTasks && ["verified", "failed"].includes(task.status);

  const decisionState = useMemo(() => {
    if (task.status === "verified") return { label: "Verified", cls: "bg-green-600/20 text-green-300 border-green-700" };
    if (task.status === "failed") return { label: "Failed", cls: "bg-red-600/20 text-red-300 border-red-700" };
    if (task.status === "reopened") return { label: "Reopened", cls: "bg-orange-600/20 text-orange-300 border-orange-700" };
    if (task.status === "completed") return { label: "Awaiting Review", cls: "bg-purple-600/20 text-purple-300 border-purple-700" };
    return { label: (task.status || "unknown").replace(/_/g, " "), cls: "bg-gray-700/20 text-gray-300 border-gray-700" };
  }, [task.status]);

  const verifyTask = async () => {
    if (!canVerify) {
      alert("❌ Cannot verify task in current state");
      return;
    }
    if (task.status === "completed" && !hasWorkSubmission) {
      alert("❌ Cannot verify: Employee has not submitted work yet!");
      return;
    }
    if (!reviewNote.trim() || reviewNote.trim().length < 5) {
      alert("Please provide a review note (minimum 5 characters)");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: reviewNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verify failed");

      if (archiveAfter) {
        if (!archiveNote.trim() || archiveNote.trim().length < 5) {
          alert("Archive note must be at least 5 characters");
        } else {
          const archiveRes = await fetch(
            `${API_BASE_URL}/api/tasks/${task._id}/archive`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ archiveNote: archiveNote.trim() }),
            }
          );
          const archiveData = await archiveRes.json();
          if (!archiveRes.ok) throw new Error(archiveData.error || "Archive failed");
        }
      }

      setReviewNote("");
      setArchiveAfter(false);
      setArchiveNote("");
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const failTask = async () => {
    if (!canFail) {
      alert("❌ Cannot fail task in current state");
      return;
    }
    if (!failureReason.trim() || failureReason.trim().length < 5) {
      alert("Please provide a failure reason (minimum 5 characters)");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/fail`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: failureReason.trim(),
          failureType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fail task failed");
      setFailureReason("");
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reopenTask = async () => {
    if (!canReopen) {
      alert("❌ Only verified tasks can be reopened");
      return;
    }
    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      alert("Please provide a reopen reason (minimum 5 characters)");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/reopen`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reopen failed");
      setReopenReason("");
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const archiveTask = async () => {
    if (!["verified", "failed"].includes(task.status)) {
      alert("❌ Only verified or failed tasks can be archived");
      return;
    }
    if (!archiveNote.trim() || archiveNote.trim().length < 5) {
      alert("Archive note must be at least 5 characters");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archiveNote: archiveNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Archive failed");
      setArchiveNote("");
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-700 pt-3 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-white">Evaluation Actions</div>
          <div className="text-xs text-gray-400 mt-0.5">Review evidence, then issue a decision with audit-safe notes.</div>
        </div>
        <span className={`px-2.5 py-1 text-xs rounded border ${decisionState.cls}`}>
          {decisionState.label}
        </span>
        <button
          onClick={() => setShowActions((prev) => !prev)}
          className="text-sm text-gray-300 hover:text-white"
        >
          {showActions ? "▼ Hide" : "▶ Open"}
        </button>
      </div>

      {!showActions && (
        <div className="text-xs text-gray-400">Open to evaluate submission evidence, then approve, fail, or reopen.</div>
      )}

      {showActions && (
        <>
      <div className="bg-gray-900 border border-gray-700 rounded p-3">
        <button
          onClick={() => setShowSubmission((prev) => !prev)}
          className="text-sm text-gray-300 hover:text-white"
        >
          {showSubmission ? "▼" : "▶"} Submission Evidence
        </button>
        {showSubmission && (
          <div className="mt-3 text-sm text-gray-300 space-y-2">
            {hasWorkSubmission ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-400">
                  <div>Status: <span className="text-gray-200">{task.workSubmission?.submissionStatus || "submitted"}</span></div>
                  <div>Version: <span className="text-gray-200">v{task.workSubmission?.version || 1}</span></div>
                  <div>Submitted: <span className="text-gray-200">{task.workSubmission?.submittedAt ? new Date(task.workSubmission.submittedAt).toLocaleString() : "-"}</span></div>
                </div>
                {task.workSubmission?.link && (
                  <a
                    href={task.workSubmission.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 break-all underline"
                  >
                    Open work link
                  </a>
                )}
                {submissionFiles.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-gray-400">Submitted files ({submissionFiles.length})</div>
                    {submissionFiles.map((file, idx) => {
                      const fileUrl = toAbsoluteUrl(file?.url);
                      if (!fileUrl) {
                        return (
                          <div
                            key={`${file?.name || "file"}-${idx}`}
                            className="text-gray-300 break-all"
                          >
                            {file?.name || `File ${idx + 1}`}
                          </div>
                        );
                      }
                      return (
                        <a
                          key={`${file?.url || file?.name || "file"}-${idx}`}
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-blue-300 hover:text-blue-200 underline break-all"
                        >
                          {file?.name || `File ${idx + 1}`}
                        </a>
                      );
                    })}
                  </div>
                )}
                {task.workSubmission?.employeeNote && (
                  <div className="text-gray-300 break-words">
                    Employee note: {task.workSubmission.employeeNote}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-400">No work submission found.</div>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
        <div className="font-semibold text-white">Approve Submission</div>
        <div className="text-xs text-gray-400">Policy: approval note required (minimum 5 characters).</div>
        {task.status === "verified" && (
          <div className="text-sm font-bold text-green-400">
            Verified
          </div>
        )}
        {task.status === "verified" && task.adminNote && (
          <div className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded p-2">
            <span className="font-bold">Admin Remark:</span> {task.adminNote}
          </div>
        )}
        <textarea
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder={canVerify ? "Approval note (quality, coverage, next steps) - min 5 chars" : "Task not ready for verification"}
          className="w-full p-2 rounded bg-slate-800 text-white text-sm outline-none disabled:opacity-50"
          disabled={!canVerify}
          rows={3}
        />
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={archiveAfter}
              onChange={(e) => setArchiveAfter(e.target.checked)}
              disabled={!canVerify}
            />
            Archive after verify
          </label>
          {archiveAfter && (
            <input
              type="text"
              placeholder="Archive note (min 5 chars)"
              className="flex-1 p-2 rounded bg-slate-800 text-white text-sm outline-none disabled:opacity-50"
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              disabled={!canVerify}
            />
          )}
        </div>
        <button
          disabled={loading || !canVerify || !reviewNote.trim() || reviewNote.trim().length < 5}
          onClick={verifyTask}
          className="px-4 py-1 bg-green-600 rounded text-white disabled:opacity-50"
        >
          {canVerify ? "Verify Work" : "Not Ready"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
        <div className="font-semibold text-white">Mark as Failed</div>
        <div className="text-xs text-gray-400">Policy: reason-required failure decision for quality traceability.</div>
        {task.status === "failed" && (
          <div className="text-sm font-bold text-red-400">
            Failed
          </div>
        )}
        {task.status === "failed" && task.failureReason && (
          <div className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded p-2">
            <span className="font-bold">Failure Reason:</span> {task.failureReason}
          </div>
        )}
        <select
          className="w-full p-2 rounded bg-slate-800 text-white text-sm outline-none disabled:opacity-50"
          value={failureType}
          onChange={(e) => setFailureType(e.target.value)}
          disabled={!canFail}
        >
          {failureTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={failureReason}
          onChange={(e) => setFailureReason(e.target.value)}
          placeholder={canFail ? "Failure reason (min 5 chars)" : "Cannot fail this task"}
          className="w-full p-2 rounded bg-slate-800 text-white text-sm outline-none disabled:opacity-50"
          disabled={!canFail}
        />
        <button
          disabled={loading || !canFail || !failureReason.trim() || failureReason.trim().length < 5}
          onClick={failTask}
          className="px-4 py-1 bg-red-600 rounded text-white disabled:opacity-50"
        >
          {canFail ? "Mark as Failed" : "Not Applicable"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
        <div className="font-semibold text-white">Reopen Task</div>
        <div className="text-xs text-gray-400">Policy: reopen allowed only from verified state with reason.</div>
        <textarea
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          placeholder={canReopen ? "Why are you reopening? (min 5 chars)" : "Task not verified yet"}
          className="w-full p-2 rounded bg-slate-800 text-white text-sm outline-none disabled:opacity-50"
          disabled={!canReopen}
          rows={3}
        />
        <button
          disabled={loading || !canReopen || !reopenReason.trim() || reopenReason.trim().length < 5}
          onClick={reopenTask}
          className="px-4 py-1 bg-orange-600 rounded text-white disabled:opacity-50"
        >
          {canReopen ? "Reopen Task" : "Task Not Verified"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
        <div className="font-semibold text-white">Archive Task</div>
        <div className="text-xs text-gray-400">
          Only verified or failed tasks can be archived.
        </div>
        {!canManageTasks && (
          <div className="text-xs text-amber-300">Missing capability: `manage_tasks`</div>
        )}
        <textarea
          value={archiveNote}
          onChange={(e) => setArchiveNote(e.target.value)}
          placeholder="Archive note (min 5 chars)"
          className="w-full p-2 rounded bg-slate-800 text-white text-sm outline-none disabled:opacity-50"
          disabled={!canArchive}
          rows={2}
        />
        <button
          disabled={
            loading ||
            !canArchive ||
            !archiveNote.trim() ||
            archiveNote.trim().length < 5
          }
          onClick={archiveTask}
          className="px-4 py-1 bg-purple-600 rounded text-white disabled:opacity-50"
        >
          Archive Task
        </button>
      </div>
        </>
      )}
    </div>
  );
};

export default TaskReviewActions;




