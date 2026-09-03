// Minimal Supabase REST helper for Vercel serverless functions.
// Uses the service role key on the server (never shipped to the browser).
// Falls back to the anon key, which can only insert free registrations (RLS).
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ntrlsnudicbdwdcguynz.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_si0ucpO3OLawZMr1ihiuIw_shZbLoIw";

function key() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY;
}

function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: key(),
    Authorization: "Bearer " + key(),
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!r.ok) {
    const err = new Error("supabase " + r.status + ": " + (data && data.message ? data.message : text));
    err.status = r.status;
    throw err;
  }
  return data;
}

function insert(table, row) {
  // With the anon key, RLS allows INSERT but not SELECT, so RETURNING would fail: ask for no body.
  const prefer = hasServiceRole() ? "return=representation" : "return=minimal";
  return rest(table, { method: "POST", body: row, prefer }).then((d) => (Array.isArray(d) ? d : []));
}

function update(table, filter, patch) {
  return rest(table + "?" + filter, { method: "PATCH", body: patch, prefer: "return=representation" });
}

function logEvent(name, registration_id, data) {
  return rest("events", { method: "POST", body: { name, registration_id: registration_id || null, data: data || null }, prefer: "return=minimal" }).catch(() => null);
}

// Pull marketing attribution the browser sent along with the form.
function attribution(body, req) {
  const a = (body && body.attribution) || {};
  const s = (v, n) => (typeof v === "string" ? v.slice(0, n || 200) : null);
  return {
    utm_source: s(a.utm_source),
    utm_medium: s(a.utm_medium),
    utm_campaign: s(a.utm_campaign),
    utm_content: s(a.utm_content),
    referrer: s(a.referrer, 500),
    landing_path: s(a.landing_path, 300),
    user_agent: s(req && req.headers ? req.headers["user-agent"] : null, 300),
  };
}

function cleanPhone(p) {
  const digits = String(p || "").replace(/[^0-9+]/g, "");
  return digits.slice(0, 20);
}

module.exports = { rest, insert, update, logEvent, attribution, cleanPhone, hasServiceRole };
