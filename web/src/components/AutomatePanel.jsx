import React, { useState } from "react";

const FREQS = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "hourly", label: "Hourly" },
];

export default function AutomatePanel({
  config,
  autoUpload,
  setAutoUpload,
  platforms,
  setPlatforms,
  schedules,
  canSchedule,
  onCreateSchedule,
  onDeleteSchedule,
  onRunSchedule,
}) {
  const [freq, setFreq] = useState("daily");
  const [time, setTime] = useState("08:00");
  const [busy, setBusy] = useState(false);

  const togglePlatform = (p) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const create = async () => {
    setBusy(true);
    try {
      await onCreateSchedule({ freq, time });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section automate">
      <div className="section-head">
        <span className="section-step">⚡</span>
        <h3>Automate</h3>
      </div>

      {/* Auto-publish */}
      <div className="toggle-row">
        <div>
          <div className="toggle-title">Auto-publish</div>
          <div className="toggle-sub">
            {config.uploadConfigured
              ? "Post the render via Upload-Post"
              : "Set UPLOAD_POST_USER in .env to enable"}
          </div>
        </div>
        <button
          className={`switch ${autoUpload ? "on" : ""}`}
          disabled={!config.uploadConfigured}
          onClick={() => setAutoUpload((v) => !v)}
          aria-label="toggle auto-publish"
        >
          <span className="knob" />
        </button>
      </div>

      {(autoUpload || schedules.length > 0) && config.uploadConfigured && (
        <div className="chips" style={{ marginTop: 4 }}>
          {config.platforms.map((p) => (
            <button
              key={p}
              className={`chip small ${platforms.includes(p) ? "on" : ""}`}
              onClick={() => togglePlatform(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Scheduling */}
      <div className="schedule-builder">
        <div className="field-label" style={{ marginTop: 16 }}>
          Recurring briefing
        </div>
        <div className="schedule-controls">
          <select className="select compact" value={freq} onChange={(e) => setFreq(e.target.value)}>
            {FREQS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          {freq !== "hourly" && (
            <input
              className="time-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
          <button className="chip add" disabled={!canSchedule || busy} onClick={create}>
            {busy ? "…" : "+ Schedule"}
          </button>
        </div>
        {!canSchedule && <div className="hint-text">Pick a place + topic first</div>}
      </div>

      {schedules.length > 0 && (
        <div className="schedule-list">
          {schedules.map((s) => (
            <div key={s.id} className="schedule-item">
              <div className="sched-main">
                <div className="sched-name">{s.name}</div>
                <div className="sched-meta">
                  {s.freq === "hourly" ? "hourly" : `${s.freq} ${s.targetTime}`} ·{" "}
                  {s.timezone?.split("/").pop()}
                  {s.autoUpload
                    ? s.publishAtTime
                      ? ` · posts at ${s.targetTime} → ${s.platforms.join(", ")}`
                      : ` · posts when ready → ${s.platforms.join(", ")}`
                    : ""}
                  {s.lastResult ? (s.lastResult.ok ? " · ✓ ran" : " · ✗ failed") : ""}
                </div>
              </div>
              <div className="sched-actions">
                <button className="icon-btn" title="Run now" onClick={() => onRunSchedule(s.id)}>
                  ▷
                </button>
                <button className="icon-btn danger" title="Delete" onClick={() => onDeleteSchedule(s.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
