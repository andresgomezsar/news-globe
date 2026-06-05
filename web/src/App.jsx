import React, { useEffect, useState } from "react";
import GlobeView from "./components/GlobeView.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import ProgressView from "./components/ProgressView.jsx";
import ResultView from "./components/ResultView.jsx";
import Library from "./components/Library.jsx";
import { TONES, MAJOR_CITIES, nearestCity } from "./presets.js";
import {
  reverseGeocode,
  getVoices,
  getConfig,
  createJob,
  streamJob,
  listSchedules,
  createSchedule,
  deleteSchedule,
  runSchedule,
  listBriefings,
  deleteBriefing,
} from "./api.js";

export default function App() {
  const [phase, setPhase] = useState("config"); // config | running | done
  const [selected, setSelected] = useState(null);
  const [topics, setTopics] = useState(["technology"]);
  const [voices, setVoices] = useState(["onyx", "nova", "shimmer", "echo", "fable"]);
  const [voice, setVoice] = useState("verse");
  const [tone, setTone] = useState(TONES[0].id);
  const [duration, setDuration] = useState(45);

  const [stage, setStage] = useState(null);
  const [log, setLog] = useState([]);
  const [liveScript, setLiveScript] = useState("");
  const [renderProgress, setRenderProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Automation state
  const [config, setConfig] = useState({ uploadConfigured: false, platforms: ["tiktok"] });
  const [autoUpload, setAutoUpload] = useState(false);
  const [platforms, setPlatforms] = useState(["instagram"]);
  const [schedules, setSchedules] = useState([]);
  const [briefings, setBriefings] = useState([]);

  useEffect(() => {
    getVoices().then((v) => v.length && setVoices(v));
    getConfig().then(setConfig);
    refreshSchedules();
    refreshBriefings();
  }, []);

  const refreshSchedules = () => listSchedules().then(setSchedules);
  const refreshBriefings = () => listBriefings().then(setBriefings);

  const openLibrary = async () => {
    await refreshBriefings();
    setPhase("library");
  };
  const playBriefing = (b) => {
    setResult(b);
    setError(null);
    setPhase("done");
  };
  const removeBriefingById = async (id) => {
    setBriefings((bs) => bs.filter((b) => b.id !== id));
    await deleteBriefing(id);
    refreshBriefings();
  };

  // Tapping the globe snaps to the nearest major city (within ~600km) so it's
  // not pixel-precise; otherwise it reverse-geocodes the spot you hit.
  const handleSelect = async (lat, lng) => {
    const { city, km } = nearestCity(lat, lng);
    if (city && km < 600) {
      setSelected({ ...city });
      return;
    }
    setSelected({ lat, lng, name: "Locating…", country: "" });
    const geo = await reverseGeocode(lat, lng);
    setSelected({ lat, lng, ...geo });
  };

  const pickCity = (c) => setSelected({ ...c });

  const generate = async () => {
    if (!selected) return;
    setPhase("running");
    setStage("news");
    setLog([]);
    setLiveScript("");
    setRenderProgress(0);
    setResult(null);
    setError(null);

    try {
      const { jobId } = await createJob({
        location: {
          name: selected.name,
          country: selected.country,
          lat: selected.lat,
          lng: selected.lng,
        },
        topics,
        voice,
        tone,
        durationSeconds: duration,
        autoUpload,
        platforms,
      });

      streamJob(jobId, (ev) => {
        if (ev.type === "stage") setStage(ev.message);
        else if (ev.type === "log") {
          setLog((l) => [...l, ev.message]);
          if (ev.render != null) setRenderProgress(ev.render);
        } else if (ev.type === "script") setLiveScript(ev.message);
        else if (ev.type === "done") {
          setResult(ev);
          setPhase("done");
          refreshBriefings();
        } else if (ev.type === "error") {
          setError(ev.message);
        }
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const reset = () => {
    setPhase("config");
    setResult(null);
    setError(null);
    setStage(null);
    setLog([]);
  };

  const locationPayload = () =>
    selected && {
      name: selected.name,
      country: selected.country,
      lat: selected.lat,
      lng: selected.lng,
    };

  const handleCreateSchedule = async ({ freq, time }) => {
    if (!selected) return;
    const label = freq === "hourly" ? "hourly" : `${freq} ${time}`;
    await createSchedule({
      name: `${selected.name} • ${topics.join(", ") || "top stories"} (${label})`,
      freq,
      time,
      leadMinutes: 15,
      location: locationPayload(),
      topics,
      voice,
      tone,
      durationSeconds: duration,
      autoUpload,
      platforms,
    });
    refreshSchedules();
  };

  const handleDeleteSchedule = async (id) => {
    await deleteSchedule(id);
    refreshSchedules();
  };

  const handleRunSchedule = async (id) => {
    await runSchedule(id);
    setTimeout(refreshSchedules, 1500);
  };

  const automate = {
    config,
    autoUpload,
    setAutoUpload,
    platforms,
    setPlatforms,
    schedules,
    onCreateSchedule: handleCreateSchedule,
    onDeleteSchedule: handleDeleteSchedule,
    onRunSchedule: handleRunSchedule,
  };

  const accent = "#37e6c9";

  return (
    <div className="app">
      <GlobeView
        selected={selected}
        onSelect={handleSelect}
        onSelectCity={pickCity}
        cities={MAJOR_CITIES}
        accent={accent}
      />
      <div className="vignette" />

      <div className="sidebar">
        {phase === "config" && (
          <ControlPanel
            selected={selected}
            topics={topics}
            setTopics={setTopics}
            voice={voice}
            setVoice={setVoice}
            voices={voices}
            tone={tone}
            setTone={setTone}
            duration={duration}
            setDuration={setDuration}
            onPickCity={pickCity}
            onGenerate={generate}
            canGenerate={Boolean(selected)}
            automate={automate}
            onOpenLibrary={openLibrary}
            libraryCount={briefings.length}
          />
        )}
        {phase === "library" && (
          <Library
            briefings={briefings}
            onPlay={playBriefing}
            onDelete={removeBriefingById}
            onBack={reset}
          />
        )}
        {phase === "running" && (
          <ProgressView
            currentStage={stage}
            log={log}
            script={liveScript}
            renderProgress={renderProgress}
            error={error}
            onReset={reset}
            withUpload={autoUpload}
          />
        )}
        {phase === "done" && result && <ResultView result={result} onReset={reset} />}
      </div>
    </div>
  );
}
