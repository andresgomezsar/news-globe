export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"];
export const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook", "x", "linkedin", "threads"];

export function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function string(v, name, max, fallback = "") {
  if (v === undefined) return fallback;
  if (typeof v !== "string" || v.length > max) throw invalid(`${name} must be a string of at most ${max} characters`);
  return v;
}
function number(v, name, min, max, fallback) {
  if (v === undefined && fallback !== undefined) return fallback;
  if (!Number.isFinite(v) || v < min || v > max) throw invalid(`${name} must be a number between ${min} and ${max}`);
  return v;
}
function boolean(v, name, fallback) {
  if (v === undefined) return fallback;
  if (typeof v !== "boolean") throw invalid(`${name} must be a boolean`);
  return v;
}

export function validateJob(input) {
  if (!object(input) || !object(input.location)) throw invalid("A location is required");
  const location = {
    lat: number(input.location.lat, "latitude", -90, 90),
    lng: number(input.location.lng, "longitude", -180, 180),
    name: string(input.location.name, "location name", 200),
    country: string(input.location.country, "country", 200),
  };
  const topics = input.topics === undefined ? [] : input.topics;
  if (!Array.isArray(topics) || topics.length > 10 || topics.some(t => typeof t !== "string" || !t.trim() || t.length > 80)) throw invalid("topics must contain at most ten nonempty strings");
  const voice = input.voice === undefined ? "verse" : input.voice;
  if (!VOICES.includes(voice)) throw invalid("Unknown voice");
  let platforms = input.platforms === undefined ? ["tiktok"] : input.platforms;
  if (!Array.isArray(platforms) || platforms.length > PLATFORMS.length || platforms.some(p => !PLATFORMS.includes(p))) throw invalid("Unknown publishing platforms");
  if (!platforms.length) platforms = ["tiktok"];
  return { location, topics: [...topics], voice, tone: string(input.tone, "tone", 500),
    durationSeconds: number(input.durationSeconds, "durationSeconds", 20, 180, 45),
    autoUpload: boolean(input.autoUpload, "autoUpload", false), platforms: [...new Set(platforms)] };
}

export function validateSchedule(input, defaultTimezone = "America/Los_Angeles") {
  const job = validateJob(input);
  const freq = input.freq === undefined ? "daily" : input.freq;
  const time = input.time === undefined ? "08:00" : input.time;
  if (!["daily", "weekdays", "hourly"].includes(freq)) throw invalid("Unknown schedule frequency");
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw invalid("time must be HH:MM");
  const timezone = string(input.timezone, "timezone", 100, defaultTimezone);
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { throw invalid("Unknown timezone"); }
  return { ...job, freq, time, timezone, name: string(input.name, "schedule name", 300),
    leadMinutes: number(input.leadMinutes, "leadMinutes", 2, 60, 15),
    enabled: boolean(input.enabled, "enabled", true) };
}
