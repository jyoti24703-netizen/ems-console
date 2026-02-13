import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY_PREFIX = "ems.chatbot.v2";

const DEFAULT_SUGGESTIONS = [
  "What should I do next?",
  "How do I request an extension?",
  "How do I respond to a modification request?",
  "Where can I see task timeline?",
  "How do I use community status and polls?",
  "I am getting an error"
];

const INTENTS = [
  {
    keywords: ["request modification", "modification", "edit request", "delete request"],
    build: () => ({
      text: "You can submit a modification request directly from the task.",
      steps: [
        "Open the task card",
        "Go to Requests or Task Details",
        "Select edit/delete and add a clear reason",
        "Submit and monitor decision in Requests"
      ]
    })
  },
  {
    keywords: ["extension", "extend", "due date"],
    build: () => ({
      text: "Use extension requests when the reason is concrete and time-bound.",
      steps: [
        "Open the task",
        "Click Request Extension",
        "Choose a realistic due date",
        "Add blockers and expected completion"
      ]
    })
  },
  {
    keywords: ["timeline", "activity", "history"],
    build: () => ({
      text: "Timeline gives full audit visibility.",
      steps: [
        "Open Task Details",
        "Switch to Timeline/Activity",
        "Review latest actions and SLA timestamps"
      ]
    })
  },
  {
    keywords: ["meeting", "rsvp", "attendance", "reschedule"],
    build: () => ({
      text: "Meeting actions are managed from the Meetings module.",
      steps: [
        "Open Meetings",
        "Pick a meeting card",
        "RSVP/attendance/discussion from the card details",
        "Use Reschedule only when needed"
      ]
    })
  },
  {
    keywords: ["notice", "announcement", "policy"],
    build: () => ({
      text: "Notices track visibility and responses.",
      steps: [
        "Open Notices",
        "Read priority/current notices first",
        "Comment or acknowledge when required"
      ]
    })
  },
  {
    keywords: ["notification", "alert", "popup"],
    build: () => ({
      text: "Notifications are grouped by source to reduce noise.",
      steps: [
        "Open Notifications",
        "Filter by source/action",
        "Open item to jump to exact module"
      ]
    })
  },
  {
    keywords: ["community", "status", "poll", "tag", "@", "post"],
    build: () => ({
      text: "Use Community for collaborative updates and quick alignment.",
      steps: [
        "Create post or status from Community",
        "Use @name to tag teammates",
        "Use polls for decisions (with clear options)",
        "Track replies and reactions from Notifications"
      ],
      tips: [
        "Use short, specific post titles",
        "Set a clear poll question and close time",
        "Tag only relevant teammates to avoid noise"
      ],
      cta: "Open Community -> Create Post"
    })
  },
  {
    keywords: ["sign in", "login", "log in", "sign up", "register", "auth"],
    build: (context) => ({
      text: "Authentication flow is role-governed in EMS.",
      steps: context?.role === "admin"
        ? [
            "Admin signs in with admin credentials",
            "Admin creates employees from Employee Management",
            "Employees sign in using assigned credentials"
          ]
        : [
            "Use assigned employee credentials to sign in",
            "Contact admin for account creation/reset",
            "Do not share credentials across users"
          ],
      cta: "If blocked, capture exact error and module path"
    })
  },
  {
    keywords: ["error", "failed", "not working", "500", "403", "401"],
    build: () => ({
      text: "Let us isolate the issue quickly.",
      steps: [
        "Copy exact error text",
        "Note the module and action",
        "Check token/session state",
        "Share API/console message"
      ]
    })
  }
];

const normalize = (value) => String(value || "").toLowerCase().trim();

const formatResponse = (payload) => {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  const lines = [];
  if (payload.text) lines.push(payload.text);
  if (payload.steps?.length) {
    lines.push("Steps:");
    payload.steps.forEach((step) => lines.push(`- ${step}`));
  }
  if (payload.tips?.length) {
    lines.push("Tips:");
    payload.tips.forEach((tip) => lines.push(`- ${tip}`));
  }
  if (payload.cta) lines.push(`Next: ${payload.cta}`);
  return lines.join("\n");
};

const getContextSummary = (context, stats) => {
  if (!stats) return "";
  if (context?.role === "admin") {
    const parts = [];
    if (stats.pendingReviews) parts.push(`${stats.pendingReviews} pending reviews`);
    if (stats.pendingExtensions) parts.push(`${stats.pendingExtensions} pending extensions`);
    if (stats.pendingModifications) parts.push(`${stats.pendingModifications} pending modifications`);
    if (stats.pendingReopens) parts.push(`${stats.pendingReopens} pending reopen responses`);
    if (stats.overdue) parts.push(`${stats.overdue} overdue tasks`);
    return parts.length ? `Priority queue: ${parts.join(", ")}.` : "No high-priority items right now.";
  }

  const parts = [];
  if (stats.assigned) parts.push(`${stats.assigned} assigned`);
  if (stats.overdue) parts.push(`${stats.overdue} overdue`);
  if (stats.pendingMods) parts.push(`${stats.pendingMods} pending modifications`);
  if (stats.pendingExt) parts.push(`${stats.pendingExt} pending extensions`);
  if (stats.pendingReopens) parts.push(`${stats.pendingReopens} pending reopen responses`);
  return parts.length ? `Your queue: ${parts.join(", ")}.` : "You are currently caught up.";
};

const getPriorityPrompts = (context) => {
  const stats = context?.stats || {};
  const prompts = [];

  if (context?.role === "admin") {
    if (stats.pendingReviews > 0) prompts.push("Show me tasks awaiting review");
    if (stats.pendingExtensions > 0) prompts.push("How do I approve extension requests?");
    if (stats.pendingModifications > 0) prompts.push("How do I respond to modification requests?");
    if (stats.overdue > 0) prompts.push("How should I triage overdue tasks?");
  } else {
    if (stats.overdue > 0) prompts.push("How should I handle overdue tasks?");
    if (stats.pendingMods > 0) prompts.push("How do I respond to a modification request?");
    if (stats.pendingExt > 0) prompts.push("How can I track extension decisions?");
    if (stats.pendingReopens > 0) prompts.push("How do I respond to reopen requests?");
  }

  return prompts.slice(0, 4);
};

const resolveAnswer = (question, context) => {
  const q = normalize(question);

  if (q === "/clear") {
    return "Use the Clear button in the header to reset this conversation.";
  }
  if (q === "/help") {
    return [
      "Available commands:",
      "- /help -> show commands",
      "- /clear -> reset conversation",
      "",
      "You can also ask about tasks, requests, meetings, notices, community, and login flow."
    ].join("\n");
  }

  if (q.includes("what should i do") || q.includes("next")) {
    const summary = getContextSummary(context, context?.stats);
    const roleLine = context?.role === "admin"
      ? "Focus order: Reviews -> Requests -> SLA risk."
      : "Focus order: Overdue -> Requests -> Active submissions.";
    return `${summary}\n${roleLine}`;
  }

  const matched = INTENTS.find((intent) =>
    intent.keywords.some((k) => q.includes(k))
  );

  if (matched) {
    return formatResponse(matched.build(context, context?.stats));
  }

  if (context?.role === "admin") {
    return "I can help with reviews, requests, meetings, SLA, notices, community, and notifications. Ask one module at a time, or type /help.";
  }
  return "I can help with tasks, requests, timelines, meetings, notices, community, and notifications. Ask one module at a time, or type /help.";
};

const getGreeting = (context) => {
  const role = context?.role === "admin" ? "Admin" : "Employee";
  const hour = new Date().getHours();
  const dayTone = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${dayTone}, ${role}. I am your workflow assistant. Ask about tasks, requests, meetings, community, or SLA. Type /help for commands.`;
};

const toTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const newMessage = (role, text) => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  role,
  text,
  ts: new Date().toISOString()
});

const ChatbotWidget = ({ title = "EMS Help Bot", context }) => {
  const storageKey = useMemo(() => {
    const role = context?.role || "user";
    const screen = context?.screen || "global";
    return `${STORAGE_KEY_PREFIX}.${role}.${screen}`;
  }, [context?.role, context?.screen]);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState([newMessage("bot", getGreeting(context))]);

  const scrollerRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // Ignore corrupted local cache.
    }
    setMessages([newMessage("bot", getGreeting(context))]);
  }, [storageKey, context]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-80)));
    } catch {
      // Storage can fail in strict browsers; fail silently.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, typing, open]);

  const baseSuggestions = useMemo(() => {
    if (context?.role === "admin") {
      return [
        "What should I do next?",
        "Show me tasks awaiting review",
        "How do I approve extension requests?",
        "How do I respond to modification requests?",
        "Where can I see meeting analytics?",
        "How do I use community status and polls?"
      ];
    }
    if (context?.screen === "meetings") {
      return [
        "How do I RSVP to a meeting?",
        "Where can I see meeting discussion?",
        "How do I mark attendance?"
      ];
    }
    if (context?.screen === "requests") {
      return [
        "How do I respond to a modification request?",
        "Where can I request an extension?",
        "How do I see SLA status?"
      ];
    }
    return DEFAULT_SUGGESTIONS;
  }, [context]);

  const priorityPrompts = useMemo(() => getPriorityPrompts(context), [context]);

  const suggestions = useMemo(() => {
    const merged = [...priorityPrompts, ...baseSuggestions];
    return Array.from(new Set(merged)).slice(0, 8);
  }, [priorityPrompts, baseSuggestions]);

  const closeWidget = () => setOpen(false);

  const openWidget = () => {
    setOpen(true);
    setUnread(0);
  };

  const clearConversation = () => {
    const reset = [newMessage("bot", getGreeting(context))];
    setMessages(reset);
    setUnread(0);
  };

  const send = (rawText) => {
    const question = String(rawText || "").trim();
    if (!question || typing) return;

    const userMsg = newMessage("user", question);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    const reply = resolveAnswer(question, context);
    const delay = 500 + Math.min(1000, question.length * 15);

    window.setTimeout(() => {
      const botMsg = newMessage("bot", reply);
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
      if (!open) {
        setUnread((u) => u + 1);
      }
    }, delay);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="w-[390px] max-w-[92vw] bg-[#0f172a] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0b1220]">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-pink-300 to-purple-300 flex items-center justify-center text-[10px] font-semibold text-gray-900">
                AI
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-100">{title}</div>
                <div className="text-[10px] text-gray-400">Live workflow guidance</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearConversation}
                className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:text-white"
              >
                Clear
              </button>
              <button
                onClick={closeWidget}
                className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>

          <div ref={scrollerRef} className="px-4 py-3 space-y-3 max-h-[390px] overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-xl px-3 py-2 whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-100 border border-gray-700"
                  }`}
                >
                  <div className="text-xs leading-relaxed">{msg.text}</div>
                  <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-blue-100" : "text-gray-400"}`}>
                    {toTime(msg.ts)}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300">
                  Assistant is typing...
                </div>
              </div>
            )}

            <div className="pt-1">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Quick Prompts</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => send("/help")}
                  className="text-[11px] px-2 py-1 rounded bg-gray-900 text-gray-200 border border-gray-700 hover:text-white hover:bg-gray-700"
                >
                  /help
                </button>
                <button
                  onClick={() => clearConversation()}
                  className="text-[11px] px-2 py-1 rounded bg-gray-900 text-gray-200 border border-gray-700 hover:text-white hover:bg-gray-700"
                >
                  /clear
                </button>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-3 py-3 border-t border-gray-800 bg-[#0b1220]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send(input);
                }}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white"
                placeholder="Ask about tasks, requests, meetings, SLA..."
              />
              <button
                onClick={() => send(input)}
                disabled={typing}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded text-xs"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={openWidget}
          className="relative bg-[#0f172a] border border-gray-800 text-white rounded-full shadow-lg px-3 py-2 flex items-center gap-2 hover:bg-[#111c33]"
        >
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-pink-300 to-purple-300 flex items-center justify-center text-gray-900 font-semibold text-xs">
            AI
          </span>
          <span className="text-xs font-semibold">Assistant</span>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default ChatbotWidget;
