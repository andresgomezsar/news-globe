async function apiFetch(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.dispatchEvent(new Event("session-expired"));
    throw new Error("Your session expired. Sign in again.");
  }
  return response;
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    const d = await res.json();
    const name = d.city || d.locality || d.principalSubdivision || d.countryName || "Unknown";
    return { name, country: d.countryName || "" };
  } catch {
    return { name: `${lat.toFixed(1)}°, ${lng.toFixed(1)}°`, country: "" };
  }
}

export async function listBriefings() {
  try {
    const res = await apiFetch("/api/briefings");
    const d = await res.json();
    return d.briefings || [];
  } catch {
    return [];
  }
}

export async function deleteBriefing(id) {
  await apiFetch(`/api/briefings/${id}`, { method: "DELETE" });
}

export async function getConfig() {
  try {
    const res = await apiFetch("/api/config");
    return await res.json();
  } catch {
    return { uploadConfigured: false, platforms: ["tiktok"] };
  }
}

export async function listSchedules() {
  try {
    const res = await apiFetch("/api/schedules");
    const d = await res.json();
    return d.schedules || [];
  } catch {
    return [];
  }
}

export async function createSchedule(payload) {
  const res = await apiFetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Failed to create schedule");
  }
  return (await res.json()).schedule;
}

export async function deleteSchedule(id) {
  await apiFetch(`/api/schedules/${id}`, { method: "DELETE" });
}

export async function runSchedule(id) {
  await apiFetch(`/api/schedules/${id}/run`, { method: "POST" });
}

// Free, keyless forward geocoding (city or country) via Open-Meteo.
export async function geocodeSearch(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
    );
    const d = await res.json();
    return (d.results || []).map((r) => ({
      name: r.name,
      country: r.country || "",
      admin: r.admin1 || "",
      lat: r.latitude,
      lng: r.longitude,
    }));
  } catch {
    return [];
  }
}

export async function getVoices() {
  try {
    const res = await apiFetch("/api/voices");
    const d = await res.json();
    return d.voices || [];
  } catch {
    return ["onyx", "nova", "shimmer", "echo", "fable", "alloy"];
  }
}

export async function createJob(payload) {
  const res = await apiFetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Failed to start job");
  }
  return res.json();
}

/** Subscribe to a job's SSE stream. Returns an unsubscribe fn. */
export function streamJob(jobId, onEvent) {
  const es = new EventSource(`/api/jobs/${jobId}/events`);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {
      /* ignore malformed */
    }
  };
  es.onerror = () => {
    es.close();
    apiFetch("/api/session").catch(() => {});
  };
  return () => es.close();
}
