import React, { useEffect, useRef, useState } from "react";
import { searchLocalCities } from "../presets.js";
import { geocodeSearch } from "../api.js";

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const key = `${r.name.toLowerCase()}|${(r.country || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export default function LocationSearch({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef();
  const debounce = useRef();

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    // Show local matches instantly, then merge in geocoder results.
    const local = searchLocalCities(q, 6);
    setResults(local);
    setOpen(true);
    setActive(0);

    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const remote = await geocodeSearch(q);
      setResults(dedupe([...local, ...remote]).slice(0, 8));
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [q]);

  const choose = (r) => {
    onSelect({ name: r.name, country: r.country, lat: r.lat, lng: r.lng });
    setQ("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="loc-search" ref={boxRef}>
      <span className="search-icon">⌕</span>
      <input
        className="search-input"
        type="text"
        placeholder="Search a city or country…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button
              key={`${r.name}-${r.lat}-${r.lng}-${i}`}
              className={`search-row ${i === active ? "active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
            >
              <span className="search-row-name">{r.name}</span>
              <span className="search-row-meta">
                {[r.admin, r.country].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
