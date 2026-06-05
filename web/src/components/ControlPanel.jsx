import React from "react";
import { TOPICS, TONES, QUICK_CITIES } from "../presets.js";
import AutomatePanel from "./AutomatePanel.jsx";
import LocationSearch from "./LocationSearch.jsx";

export default function ControlPanel({
  selected,
  topics,
  setTopics,
  voice,
  setVoice,
  voices,
  tone,
  setTone,
  duration,
  setDuration,
  onPickCity,
  onGenerate,
  canGenerate,
  automate,
  onOpenLibrary,
  libraryCount = 0,
}) {
  const toggleTopic = (id) =>
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  return (
    <div className="panel">
      <div className="brand">
        <span className="brand-dot" />
        NEWS&nbsp;GLOBE
      </div>
      <p className="tagline">Point at the planet. Get a custom AI news podcast.</p>

      <button className="library-btn" onClick={onOpenLibrary}>
        🗂 Past briefings{libraryCount ? ` (${libraryCount})` : ""}
      </button>

      <Section step="1" title="Where in the world?">
        <LocationSearch onSelect={onPickCity} />
        <div className={`location-readout ${selected ? "active" : ""}`}>
          {selected ? (
            <>
              <div className="loc-name">📍 {selected.name}</div>
              <div className="loc-sub">
                {selected.country ? selected.country + " · " : ""}
                {selected.lat.toFixed(2)}, {selected.lng.toFixed(2)}
              </div>
            </>
          ) : (
            <div className="loc-empty">Search above, tap a city on the globe, or click anywhere</div>
          )}
        </div>
        <div className="chips">
          {QUICK_CITIES.map((c) => (
            <button
              key={c.name}
              className={`chip ${selected?.name === c.name ? "on" : ""}`}
              onClick={() => onPickCity(c)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Section>

      <Section step="2" title="What's the story? (optional)">
        <div className="chips">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              className={`chip ${topics.includes(t.id) ? "on" : ""}`}
              onClick={() => toggleTopic(t.id)}
            >
              <span className="chip-emoji">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section step="3" title="Voice & vibe">
        <label className="field-label">Anchor voice</label>
        <div className="select-grid">
          {voices.map((v) => (
            <button key={v} className={`chip ${voice === v ? "on" : ""}`} onClick={() => setVoice(v)}>
              {v}
            </button>
          ))}
        </div>
        <label className="field-label" style={{ marginTop: 14 }}>
          Delivery
        </label>
        <select className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
          {TONES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="field-label" style={{ marginTop: 14 }}>
          Length · <b>{formatDuration(duration)}</b>
        </label>
        <input
          className="slider"
          type="range"
          min="20"
          max="180"
          step="5"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </Section>

      <AutomatePanel {...automate} canSchedule={canGenerate} />

      <button className="generate" disabled={!canGenerate} onClick={onGenerate}>
        {canGenerate ? "✦ Generate Briefing" : missingLabel()}
      </button>
    </div>
  );
}

function missingLabel() {
  // Topics are optional now — only a place is required.
  return "Pick a place on the map";
}

function formatDuration(s) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}:00` : `${m}:${String(r).padStart(2, "0")}`;
}

function Section({ step, title, children }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="section-step">{step}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}
