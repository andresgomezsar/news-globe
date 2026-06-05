import React from "react";

export default function ResultView({ result, onReset }) {
  const {
    videoUrl,
    title,
    subtitle,
    script,
    headlines = [],
    keyPlayers = [],
    summary,
    sentiment,
    captionMethod,
    durationSeconds,
    upload,
  } = result;

  return (
    <div className="panel result-panel">
      <div className="brand">
        <span className="brand-dot live" />
        BRIEFING&nbsp;READY
      </div>
      <h2 className="result-title">{title}</h2>
      <p className="tagline">{subtitle}</p>

      <div className="video-frame">
        <video src={videoUrl} controls autoPlay playsInline />
      </div>

      <div className="result-actions">
        <a className="btn-secondary" href={videoUrl} download={`${title || "briefing"}.mp4`}>
          ⤓ Download MP4
        </a>
        <button className="btn-secondary" onClick={onReset}>
          ↻ New briefing
        </button>
      </div>

      <div className="meta-row">
        <span>{durationSeconds ? `${durationSeconds.toFixed(0)}s` : ""}</span>
        <span>captions: {captionMethod}</span>
        {sentiment && <span>tone: {sentiment}</span>}
      </div>

      {upload && !upload.skipped && (
        <div className={`publish-banner ${upload.ok ? "ok" : "fail"}`}>
          {upload.ok ? "🚀 Published via Upload-Post" : `Upload failed: HTTP ${upload.httpStatus || "?"}`}
        </div>
      )}

      {keyPlayers.length > 0 && (
        <div className="key-players">
          <div className="field-label">Key players (detected)</div>
          <div className="chips">
            {keyPlayers.map((k) => (
              <span key={k} className="chip small static">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {headlines.length > 0 && (
        <div className="headlines">
          <div className="field-label">Sources</div>
          {headlines.map((h, i) => (
            <a key={i} href={h.url} target="_blank" rel="noreferrer" className="headline">
              <span className="headline-source">{h.source}</span>
              <span className="headline-title">{h.title}</span>
            </a>
          ))}
        </div>
      )}

      {script && (
        <details className="script-details">
          <summary>Full transcript</summary>
          <p>{script}</p>
        </details>
      )}
    </div>
  );
}
