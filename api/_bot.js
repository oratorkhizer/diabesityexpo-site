/* Bot protection shared by the form functions in api/.
   Order: honeypot / fill time (silent drop), random-name filter (silent drop),
   then Cloudflare Turnstile when TURNSTILE_SECRET_KEY is set (fail open if
   Cloudflare itself is unreachable). Files starting with _ in api/ are not routes. */

const HUMAN_MSG = "We could not confirm this was sent by a person. Please refresh the page and try again.";

function looksRandom(name, email) {
  const n = String(name || "").trim();
  if (/^[A-Za-z]{10,}$/.test(n) && (n.slice(1).match(/[A-Z]/g) || []).length >= 3) return true;
  const m = String(email || "").trim().toLowerCase().match(/^([^@]+)@(gmail|googlemail)\.com$/);
  if (m && (m[1].match(/\./g) || []).length >= 3) return true;
  return false;
}

function clientIp(req) {
  const h = req.headers || {};
  return String(h["x-real-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "").trim();
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const body = new URLSearchParams({ secret, response: String(token) });
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: ctl.signal });
    const j = await r.json();
    return j && j.success === true;
  } catch (e) {
    return true; /* Cloudflare unreachable or slow: allow */
  } finally {
    clearTimeout(timer);
  }
}

/* Returns "drop" (answer success, write nothing), "reject" (400 with HUMAN_MSG) or "ok". */
async function check(req, { honeypot, ms, name, email, token }) {
  if (String(honeypot || "").trim() !== "") return "drop";
  if (ms !== undefined && ms !== null && ms !== "" && Number(ms) < 1500) return "drop";
  if (looksRandom(name, email)) return "drop";
  if (!(await verifyTurnstile(token, clientIp(req)))) return "reject";
  return "ok";
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === "object" ? b : {};
}

module.exports = { HUMAN_MSG, looksRandom, clientIp, verifyTurnstile, check, readBody };
