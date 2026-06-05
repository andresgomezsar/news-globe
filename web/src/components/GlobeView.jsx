import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";

export default function GlobeView({ selected, onSelect, onSelectCity, cities = [], accent = "#37e6c9" }) {
  const globeRef = useRef();
  const wrapRef = useRef();
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () =>
      setDims({
        w: wrapRef.current?.clientWidth || window.innerWidth,
        h: wrapRef.current?.clientHeight || window.innerHeight,
      });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Gentle auto-rotation + initial pose.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = true;
    controls.minDistance = 200;
    controls.maxDistance = 500;
    g.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0);
  }, []);

  // Fly to the selection when it changes.
  useEffect(() => {
    if (selected && globeRef.current) {
      globeRef.current.pointOfView(
        { lat: selected.lat, lng: selected.lng, altitude: 1.9 },
        1200,
      );
    }
  }, [selected?.lat, selected?.lng]);

  // City markers: every major city, plus the current selection (highlighted) if
  // it isn't already one of them.
  const selKey = selected ? `${selected.lat.toFixed(2)},${selected.lng.toFixed(2)}` : "";
  const pointsData = useMemo(() => {
    const pts = cities.map((c) => ({ ...c, _city: true }));
    if (selected && !cities.some((c) => `${c.lat.toFixed(2)},${c.lng.toFixed(2)}` === selKey)) {
      pts.push({ ...selected, _city: false });
    }
    return pts;
  }, [cities, selKey]);

  const ringsData = useMemo(
    () => (selected ? [{ lat: selected.lat, lng: selected.lng }] : []),
    [selected?.lat, selected?.lng],
  );

  const isSelected = (d) => `${d.lat.toFixed(2)},${d.lng.toFixed(2)}` === selKey;

  return (
    <div ref={wrapRef} className="globe-wrap">
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        showAtmosphere
        atmosphereColor={accent}
        atmosphereAltitude={0.18}
        onGlobeClick={({ lat, lng }) => onSelect(lat, lng)}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => (isSelected(d) ? accent : "rgba(207,233,255,0.55)")}
        pointAltitude={(d) => (isSelected(d) ? 0.03 : 0.008)}
        pointRadius={(d) => (isSelected(d) ? 0.5 : 0.22)}
        pointLabel={(d) => `<div class="globe-tip">${d.name}${d.country ? `<span>${d.country}</span>` : ""}</div>`}
        onPointClick={(d) => (d._city ? onSelectCity(d) : onSelect(d.lat, d.lng))}
        ringsData={ringsData}
        ringColor={() => (t) => `rgba(55,230,201,${1 - t})`}
        ringMaxRadius={6}
        ringPropagationSpeed={3}
        ringRepeatPeriod={900}
      />
      {!selected && <div className="globe-hint">Tap a city marker · or anywhere on Earth ↗</div>}
    </div>
  );
}
