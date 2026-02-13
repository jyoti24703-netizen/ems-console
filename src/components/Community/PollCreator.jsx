import React, { useState } from "react";

const PollCreator = ({ onPollCreated }) => {
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(7);

  const addOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const removeOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index, value) => {
    const next = [...pollOptions];
    next[index] = value;
    setPollOptions(next);
  };

  const handleCreatePoll = () => {
    if (!pollQuestion.trim()) {
      alert("Poll question is required");
      return;
    }

    const validOptions = pollOptions.filter((opt) => opt.trim().length > 0);
    if (validOptions.length < 2) {
      alert("At least 2 poll options are required");
      return;
    }

    const pollData = {
      question: pollQuestion.trim(),
      options: validOptions.map((opt) => ({
        text: opt.trim(),
        votes: []
      })),
      duration: pollDuration,
      expiresAt: new Date(Date.now() + pollDuration * 24 * 60 * 60 * 1000)
    };

    onPollCreated(pollData);
  };

  return (
    <div className="bg-[#0b1220] p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h4 className="font-semibold text-white">Poll Builder</h4>
        <span className="text-xs text-gray-400">
          {pollOptions.filter((o) => o.trim()).length}/{pollOptions.length} options
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-400 block mb-2">Poll Question *</label>
          <input
            type="text"
            placeholder="What would you like to ask?"
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-gray-400 block mb-2">Options *</label>
          <div className="space-y-2">
            {pollOptions.map((option, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded text-white"
                  value={option}
                  onChange={(e) => updateOption(idx, e.target.value)}
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => removeOption(idx)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                    type="button"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>

          {pollOptions.length < 6 && (
            <button
              onClick={addOption}
              className="mt-2 text-sm text-blue-400 hover:text-blue-300"
              type="button"
            >
              + Add Option
            </button>
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-gray-400 block mb-2">Poll Duration</label>
          <select
            className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white"
            value={pollDuration}
            onChange={(e) => setPollDuration(parseInt(e.target.value, 10))}
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>

        <button
          onClick={handleCreatePoll}
          className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
          type="button"
        >
          Save Poll Draft
        </button>
      </div>
    </div>
  );
};

export default PollCreator;
