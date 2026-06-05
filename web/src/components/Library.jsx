import React from "react";

function timeAgo(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function Library({ briefings, onPlay, onDelete, onBack }) {
  return (
    <div className="panel library-panel">
      <div className="library-head">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="brand" style={{ fontSize: 16 }}>
          <span className="brand-dot" />
          LIBRARY
        </div>
      </div>
      <p className="tagline">{briefings.length} past briefing{briefings.length === 1 ? "" : "s"}</p>

      {briefings.length === 0 ? (
        <div className="library-empty">
          No briefings yet.
          <br />
          Generate one and it'll show up here.
        </div>
      ) : (
        <div className="library-grid">
          {briefings.map((b) => (
            <div key={b.id} className="lib-card" onClick={() => onPlay(b)}>
              <div className="lib-thumb" style={{ borderColor: b.accent }}>
                {b.posterUrl ? (
                  <img src={b.posterUrl} alt={b.title} loading="lazy" />
                ) : (
                  <div className="lib-thumb-fallback" style={{ background: b.accent }} />
                )}
                <span className="lib-play">▶</span>
                {b.durationSeconds ? (
                  <span className="lib-dur">{formatDur(b.durationSeconds)}</span>
                ) : null}
                <button
                  className="lib-del"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(b.id);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="lib-meta">
                <div className="lib-title" style={{ color: b.accent }}>
                  {b.title}
                </div>
                <div className="lib-sub">
                  {b.location?.name || ""}
                  {b.topics?.length ? ` · ${b.topics.slice(0, 2).join(", ")}` : ""}
                </div>
                <div className="lib-date">
                  {timeAgo(b.createdAt)}
                  {b.upload && b.upload.ok ? " · 🚀 posted" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDur(s) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
