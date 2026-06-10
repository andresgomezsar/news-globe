import React, { useEffect, useRef } from "react";

const ALL_STAGES = [
  { id: "news", label: "Editor scanning the wires", icon: "📡" },
  { id: "script", label: "Writing the script", icon: "✍️" },
  { id: "voice", label: "Generating the voice", icon: "🎙️" },
  { id: "captions", label: "Captions + intelligence", icon: "💬" },
  { id: "director", label: "Visual director", icon: "🎞️" },
  { id: "render", label: "Rendering the broadcast", icon: "🎬" },
  { id: "upload", label: "Publishing to social", icon: "🚀" },
];

export default function ProgressView({ currentStage, log, script, renderProgress, error, onReset, withUpload }) {
  const logRef = useRef();
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);

  const STAGES = withUpload ? ALL_STAGES : ALL_STAGES.filter((s) => s.id !== "upload");
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="panel progress-panel">
      <div className="brand">
        <span className="brand-dot spin" />
        ON&nbsp;AIR
      </div>
      <p className="tagline">Producing your briefing…</p>

      <div className="stages">
        {STAGES.map((s, i) => {
          const state = error
            ? i < currentIdx
              ? "done"
              : i === currentIdx
                ? "error"
                : "idle"
            : i < currentIdx
              ? "done"
              : i === currentIdx
                ? "active"
                : "idle";
          return (
            <div key={s.id} className={`stage ${state}`}>
              <span className="stage-icon">{state === "done" ? "✓" : s.icon}</span>
              <span className="stage-label">{s.label}</span>
              {s.id === "render" && state === "active" && renderProgress > 0 && (
                <span className="stage-pct">{Math.round(renderProgress * 100)}%</span>
              )}
              {state === "active" && <span className="stage-pulse" />}
            </div>
          );
        })}
      </div>

      {script && (
        <div className="live-script">
          <div className="field-label">Script</div>
          <p>{script}</p>
        </div>
      )}

      <div className="log" ref={logRef}>
        {log.map((line, i) => (
          <div key={i} className="log-line">
            <span className="log-arrow">›</span> {line}
          </div>
        ))}
        {error && <div className="log-line err">✗ {error}</div>}
      </div>

      {error && (
        <button className="btn-secondary" style={{ marginTop: 16 }} onClick={onReset}>
          ↻ Start over
        </button>
      )}
    </div>
  );
}
