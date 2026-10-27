import crypto from "node:crypto";

export function equalSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function installAuth(app, { accessToken, allowedOrigins, secureCookie = false }) {
  if (typeof accessToken !== "string" || accessToken.length < 32) throw new Error("Set NEWS_GLOBE_TOKEN to a random secret of at least 32 characters in .env");
  const cookieName = "news_globe_session";
  const sign = value => crypto.createHmac("sha256", accessToken).update(value).digest("hex");
  const cookieOptions = { httpOnly: true, sameSite: "strict", secure: secureCookie, path: "/", maxAge: 12 * 60 * 60 * 1000 };
  // Same-origin cookies support native EventSource, images and video playback.
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: "Origin not allowed" });
    next();
  });
  let attempts = 0, resetAt = 0;
  app.post("/api/session", (req, res) => {
    if (Date.now() > resetAt) { attempts = 0; resetAt = Date.now() + 60000; }
    if (++attempts > 30) return res.status(429).json({ error: "Too many sign-in attempts. Try again in a minute." });
    if (!equalSecret(req.body?.token, accessToken)) return res.status(401).json({ error: "Invalid access token" });
    const value = `${Date.now() + cookieOptions.maxAge}.${crypto.randomBytes(24).toString("hex")}`;
    res.cookie(cookieName, `${value}.${sign(value)}`, cookieOptions).json({ ok: true });
  });
  const requireAuth = (req, res, next) => {
    const cookies = (req.get("cookie") || "").split(";").map(c => c.trim());
    const value = cookies.find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
    const parts = value.split(".");
    if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || Number(parts[0]) <= Date.now() || !equalSecret(parts[2], sign(`${parts[0]}.${parts[1]}`))) {
      return res.status(401).json({ error: "Sign in to News Globe" });
    }
    next();
  };
  app.use("/api", requireAuth);
  app.get("/api/session", (_req, res) => res.json({ ok: true }));
  app.delete("/api/session", (_req, res) => res.clearCookie(cookieName, cookieOptions).json({ ok: true }));
  return requireAuth;
}
