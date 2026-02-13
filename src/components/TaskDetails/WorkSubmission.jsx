import React, { useState } from "react";

const WorkSubmission = ({ task, onSubmit }) => {
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState(null);

  /* ============================
     STATUS-BASED UI LOCKING
  ============================ */

  // 🔒 Already submitted (waiting review)
  if (task.status === "completed") {
    return (
      <div className="mt-4 bg-gray-800 p-4 rounded border border-gray-700">
        <p className="text-yellow-400 font-semibold">
          ✔ Work submitted successfully
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Submitted on:{" "}
          {task.completedAt
            ? new Date(task.completedAt).toLocaleString()
            : "—"}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Waiting for admin review.
        </p>
      </div>
    );
  }

  // 🔒 Final state
  if (task.status === "verified") {
    return (
      <div className="mt-4 bg-green-900/20 p-4 rounded border border-green-700">
        <p className="text-green-400 font-semibold">
          ✔ Task verified by admin
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Verified on:{" "}
          {task.reviewedAt
            ? new Date(task.reviewedAt).toLocaleString()
            : "—"}
        </p>
      </div>
    );
  }

  // 🔁 Rejected – allow resubmission
  if (task.status === "failed") {
    return (
      <div className="mt-4">
        <p className="text-red-400 text-sm mb-2">
          ❌ Rejected by admin. Please resubmit.
        </p>
        {task.failureReason && (
          <div className="bg-red-900/30 p-3 rounded mb-3 text-sm text-red-300">
            <strong>Reason:</strong> {task.failureReason}
          </div>
        )}
        {/* fall through to submission form */}
      </div>
    );
  }

  // 🚫 Cannot submit unless accepted
  if (task.status !== "accepted") {
    return null;
  }

  /* ============================
     SUBMISSION FORM (VALID)
  ============================ */
  return (
    <div className="mt-4 bg-[#1f1f1f] p-4 rounded border border-gray-700">
      <h3 className="text-sm font-semibold mb-2">Work Submission</h3>

      <textarea
        className="w-full p-2 bg-black border border-gray-700 rounded text-sm"
        placeholder="Explain what you worked on..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        type="text"
        className="w-full mt-2 p-2 bg-black border border-gray-700 rounded text-sm"
        placeholder="GitHub / Website link (optional)"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />

      <input
        type="file"
        className="mt-2 text-sm"
        accept=".pdf,.doc,.docx"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button
        onClick={() =>
          onSubmit({
            description,
            link,
            file,
          })
        }
        className="mt-3 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
      >
        Submit Work
      </button>
    </div>
  );
};

export default WorkSubmission;



