import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { GeoLocation } from "./schema";

const DEG = Math.PI / 180;

type Dot = { lat: number; lng: number };

// A roughly even point cloud over the sphere (more longitudes near the equator).
function buildDotGrid(): Dot[] {
  const dots: Dot[] = [];
  for (let lat = -80; lat <= 80; lat += 7) {
    const ring = Math.max(6, Math.round(60 * Math.cos(lat * DEG)));
    for (let i = 0; i < ring; i++) {
      dots.push({ lat, lng: (i / ring) * 360 - 180 });
    }
  }
  return dots;
}

// Orthographic projection of a lat/lng onto a globe centred at (cx, cy) radius R.
function project(
  lat: number,
  lng: number,
  viewLat: number,
  viewLng: number,
  R: number,
) {
  const p = lat * DEG;
  const l = (lng - viewLng) * DEG;
  const p1 = viewLat * DEG;
  const cosc = Math.sin(p1) * Math.sin(p) + Math.cos(p1) * Math.cos(p) * Math.cos(l);
  const x = Math.cos(p) * Math.sin(l);
  const y = Math.cos(p1) * Math.sin(p) - Math.sin(p1) * Math.cos(p) * Math.cos(l);
  return { x: x * R, y: -y * R, visible: cosc >= -0.02, depth: cosc };
}

export const Globe: React.FC<{
  location: GeoLocation;
  accent: string;
  size: number;
}> = ({ location, accent, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dots = useMemo(buildDotGrid, []);

  const R = size / 2;
  const cx = 0;
  const cy = 0;
  const viewLat = 16;
  // Slowly orbit, but anchored so the chosen location stays on the near face.
  const viewLng = location.lng + Math.sin((frame / fps) * 0.18) * 26 - 6;

  const pin = project(location.lat, location.lng, viewLat, viewLng, R);
  const pulse = (Math.sin((frame / fps) * 3.2) + 1) / 2;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <svg
        width={size + 160}
        height={size + 160}
        viewBox={`${-(size + 160) / 2} ${-(size + 160) / 2} ${size + 160} ${size + 160}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="globeGlow" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
            <stop offset="55%" stopColor={accent} stopOpacity={0.05} />
            <stop offset="100%" stopColor="#000" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="globeBody" cx="38%" cy="34%" r="75%">
            <stop offset="0%" stopColor="#13314a" />
            <stop offset="70%" stopColor="#081521" />
            <stop offset="100%" stopColor="#02060c" />
          </radialGradient>
        </defs>

        {/* Atmosphere */}
        <circle cx={cx} cy={cy} r={R + 70} fill="url(#globeGlow)" />
        {/* Sphere body */}
        <circle cx={cx} cy={cy} r={R} fill="url(#globeBody)" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={1.5} />

        {/* Dot cloud */}
        {dots.map((d, i) => {
          const pr = project(d.lat, d.lng, viewLat, viewLng, R);
          if (!pr.visible) return null;
          const near =
            Math.abs(d.lat - location.lat) < 18 &&
            Math.abs(((d.lng - location.lng + 540) % 360) - 180) < 18;
          const op = interpolate(pr.depth, [-0.02, 0.2, 1], [0, 0.35, 0.9]);
          return (
            <circle
              key={i}
              cx={pr.x}
              cy={pr.y}
              r={near ? 2.4 : 1.4}
              fill={near ? accent : "#cfe9ff"}
              opacity={near ? Math.min(1, op + 0.25) : op * 0.7}
            />
          );
        })}

        {/* Meridian highlight sweep */}
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.06}
          strokeWidth={40}
          strokeDasharray={`${R * 0.5} ${R * 6}`}
          strokeDashoffset={-(frame * 6)}
        />

        {/* Location marker */}
        {pin.visible && (
          <g transform={`translate(${pin.x}, ${pin.y})`}>
            <circle r={10 + pulse * 22} fill="none" stroke={accent} strokeOpacity={0.6 - pulse * 0.5} strokeWidth={2} />
            <circle r={6 + pulse * 10} fill="none" stroke={accent} strokeOpacity={0.9 - pulse * 0.7} strokeWidth={2} />
            <circle r={4.5} fill={accent} />
            <circle r={4.5} fill={accent} opacity={0.5}>
            </circle>
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};
