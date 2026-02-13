import { useEffect, useMemo, useRef, useState } from "react";

const PRIORITY_ORDER = { CRITICAL: 0, IMPORTANT: 1, INFO: 2 };

const DEFAULT_COOLDOWN_MS = 2 * 60 * 1000;

const getSessionKey = (role, sessionKey, suffix) => `ems_notify_${role}_${sessionKey || "default"}_${suffix}`;

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage || window.localStorage || null;
};

const loadSessionMap = (key) => {
  try {
    const storage = getStorage();
    if (!storage) return {};
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (_err) {
    return {};
  }
};

const saveSessionMap = (key, value) => {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  } catch (_err) {
    // ignore session storage failures
  }
};

const getTone = (policy = {}) => {
  const hour = new Date().getHours();
  const quietStart = Number.isFinite(Number(policy.quietHoursStart)) ? Number(policy.quietHoursStart) : 22;
  const quietEnd = Number.isFinite(Number(policy.quietHoursEnd)) ? Number(policy.quietHoursEnd) : 7;
  if (quietStart === quietEnd) return "default";
  const isSoftWindow = quietStart > quietEnd
    ? (hour >= quietStart || hour < quietEnd)
    : (hour >= quietStart && hour < quietEnd);
  if (isSoftWindow) return "soft";
  return "default";
};

const formatMessage = (item, tone) => {
  if (tone === "soft") {
    if (item.softMessage) return item.softMessage;
    if (item.message) return `${item.message} When you're ready.`;
  }
  return item.message || "";
};

const SmartNotifications = ({ role = "user", items = [], sessionKey = "", policy = {} }) => {
  const dismissedKey = getSessionKey(role, sessionKey, "dismissed");
  const shownKey = getSessionKey(role, sessionKey, "shown");
  const ackKey = getSessionKey(role, sessionKey, "ack");
  const snoozeKey = getSessionKey(role, sessionKey, "snooze");

  const [dismissed, setDismissed] = useState(() => loadSessionMap(dismissedKey));
  const [shown, setShown] = useState(() => loadSessionMap(shownKey));
  const [acknowledged, setAcknowledged] = useState(() => loadSessionMap(ackKey));
  const [snoozed, setSnoozed] = useState(() => loadSessionMap(snoozeKey));
  const [visibleToasts, setVisibleToasts] = useState([]);

  const timersRef = useRef({});

  const sortedItems = useMemo(() => {
    return [...items]
      .filter(item => item && item.id)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99));
  }, [items]);

  const tone = getTone(policy);

  const criticalItem = useMemo(() => {
    return sortedItems.find(item => {
      if (item.priority !== "CRITICAL") return false;
      // Late-evening behavior: suppress non-blocking critical modals.
      if (tone === "soft" && item.blocking !== true) return false;
      // Enterprise behavior: once acknowledged in this login session, do not show again.
      if (acknowledged[item.id]) return false;
      if (dismissed[item.id]) return false;
      return true;
    });
  }, [sortedItems, acknowledged, dismissed, tone]);

  useEffect(() => {
    saveSessionMap(dismissedKey, dismissed);
  }, [dismissed, dismissedKey]);

  useEffect(() => {
    saveSessionMap(shownKey, shown);
  }, [shown, shownKey]);

  useEffect(() => {
    saveSessionMap(ackKey, acknowledged);
  }, [acknowledged, ackKey]);

  useEffect(() => {
    saveSessionMap(snoozeKey, snoozed);
  }, [snoozed, snoozeKey]);

  useEffect(() => {
    const dedupeWindowMs = Math.max(1, Number(policy?.dedupeWindowMinutes || 120)) * 60 * 1000;
    const maxImportantToasts = Math.max(1, Number(policy?.maxImportantToasts || 3));
    const now = Date.now();

    const newImportant = sortedItems.filter(item => {
      const downgradedCritical = item.priority === "CRITICAL" && tone === "soft" && item.blocking !== true;
      if (!(item.priority === "IMPORTANT" || downgradedCritical)) return false;
      // Enterprise behavior: once dismissed/shown in this login session, do not show again.
      if (dismissed[item.id]) return false;
      const snoozedUntil = Number(snoozed[item.id] || 0);
      if (snoozedUntil > now) return false;
      const shownAt = Number(shown[item.id] || 0);
      if (shownAt && now - shownAt < dedupeWindowMs) return false;
      return true;
    });

    if (newImportant.length === 0) return;

    const nextToShow = newImportant.slice(0, maxImportantToasts);
    setVisibleToasts(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const merged = [...prev];
      nextToShow.forEach(item => {
        if (!existingIds.has(item.id)) {
          merged.push(item);
        }
      });
      return merged;
    });

    setShown(prev => {
      const updated = { ...prev };
      nextToShow.forEach(item => { updated[item.id] = Date.now(); });
      return updated;
    });
  }, [sortedItems, dismissed, shown, snoozed, tone, policy]);

  useEffect(() => {
    visibleToasts.forEach(item => {
      if (!item.autoDismissMs) return;
      if (timersRef.current[item.id]) return;
      timersRef.current[item.id] = setTimeout(() => {
        setVisibleToasts(prev => prev.filter(t => t.id !== item.id));
        setDismissed(prev => ({ ...prev, [item.id]: true }));
      }, item.autoDismissMs);
    });

    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [visibleToasts]);

  const dismissToast = (id) => {
    setVisibleToasts(prev => prev.filter(t => t.id !== id));
    setDismissed(prev => ({ ...prev, [id]: true }));
  };

  const snoozeToast = (id) => {
    const minutes = Math.max(5, Number(policy?.importantSnoozeMinutes || 30));
    const until = Date.now() + minutes * 60 * 1000;
    setVisibleToasts(prev => prev.filter(t => t.id !== id));
    setSnoozed(prev => ({ ...prev, [id]: until }));
  };

  const acknowledgeCritical = () => {
    if (!criticalItem) return;
    setAcknowledged(prev => ({ ...prev, [criticalItem.id]: Date.now() }));
    setDismissed(prev => ({ ...prev, [criticalItem.id]: true }));
    if (criticalItem.onAcknowledge) criticalItem.onAcknowledge();
  };

  return (
    <>
      {criticalItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div className="max-w-lg w-full bg-[#0f172a] border border-red-700 rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-red-700/40">
              <div className="text-xs uppercase tracking-widest text-red-400">Critical</div>
              <h3 className="text-xl font-semibold text-white mt-1">{criticalItem.title}</h3>
              <p className="text-sm text-gray-300 mt-2">{formatMessage(criticalItem, tone)}</p>
            </div>
            <div className="p-5 flex flex-wrap gap-3 justify-end">
              {criticalItem.onClick && (
                <button
                  onClick={criticalItem.onClick}
                  className="px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                >
                  {criticalItem.actionLabel || "Open"}
                </button>
              )}
              <button
                onClick={acknowledgeCritical}
                className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-200"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] w-[640px] max-w-[92vw] space-y-3 pointer-events-none">
        {visibleToasts.map(item => (
          <div
            key={item.id}
            className="w-full bg-[#0f172a] border border-gray-800 rounded-xl shadow-xl p-4 pointer-events-auto animate-[fadeIn_.2s_ease-out]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-blue-300">Important</div>
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="text-xs text-gray-300 mt-1">{formatMessage(item, tone)}</div>
              </div>
              <button
                onClick={() => dismissToast(item.id)}
                className="text-xs text-gray-400 hover:text-white"
              >
                x
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              {item.onClick && (
                <button
                  onClick={() => {
                    item.onClick();
                    if (item.dismissOnClick !== false) dismissToast(item.id);
                  }}
                  className="text-xs px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {item.actionLabel || "Open"}
                </button>
              )}
              {item.dismissible !== false && (
                <button
                  onClick={() => dismissToast(item.id)}
                  className="text-xs px-3 py-2 rounded bg-gray-800 text-gray-300 hover:text-white"
                >
                  Dismiss
                </button>
              )}
              <button
                onClick={() => snoozeToast(item.id)}
                className="text-xs px-3 py-2 rounded bg-gray-800 text-gray-300 hover:text-white"
              >
                Snooze
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default SmartNotifications;

