// Vercel serverless: "Get involved" submissions (ideas, stories, questions,
// volunteers, community groups, Diabesity Club waitlist).
const db = require("./_db");

const KINDS = ["idea", "story", "question", "volunteer", "community", "club"];
const LANGS = ["English", "Hindi", "Urdu", "Telugu"];
const LABEL = {
  idea: "IDEA",
  story: "STORY NOMINATION",
  question: "QUESTION FOR THE EXPERTS",
  volunteer: "VOLUNTEER",
  community: "COMMUNITY GROUP",
  club: "DIABESITY CLUB WAITLIST",
};

const s = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const list = (v, allowed) => (Array.isArray(v) ? v.filter((x) => allowed.includes(x)).slice(0, 12) : []);

const TOPICS = [
  "Food and Indian diet", "Weight-loss medicines", "Children and weight", "Fatty liver",
  "Diabetes in pregnancy", "Foot care", "Snoring and sleep apnoea", "Heart and diabetes",
  "Exercise for busy people", "Stress and mental health", "Fasting with diabetes", "Insulin and new devices",
];

function details(kind, b) {
  switch (kind) {
    case "idea":
      return {
        category: s(b.category, 40),
        idea: s(b.idea, 2000),
        attended: s(b.attended, 20),
      };
    case "story":
      return {
        role: ["patient", "caregiver", "doctor"].includes(b.role) ? b.role : "patient",
        nominating: b.nominating === "other" ? "other" : "self",
        nominee_name: s(b.nominee_name, 100),
        nominee_phone: db.cleanPhone(b.nominee_phone),
        story: s(b.story, 3000),
        has_permission: b.has_permission === true,
      };
    case "question":
      return { question: s(b.question, 1000), topics: list(b.topics, TOPICS) };
    case "volunteer":
      return {
        background: s(b.background, 40),
        institution: s(b.institution, 150),
        availability: s(b.availability, 30),
        languages: list(b.languages, LANGS),
      };
    case "community":
      return {
        group_type: s(b.group_type, 40),
        group_name: s(b.group_name, 150),
        group_size: s(b.group_size, 20),
        interest: s(b.interest, 30),
        message: s(b.message, 1000),
      };
    case "club":
      return { for_whom: s(b.for_whom, 20), interests: list(b.interests, TOPICS) };
  }
  return {};
}

function missing(kind, d) {
  if (kind === "idea" && d.idea.length < 10) return "Please write your idea in a sentence or two";
  if (kind === "story") {
    if (d.story.length < 30) return "Please tell us the story in a few lines";
    if (d.nominating === "other" && d.nominee_name.length < 2) return "Please give the name of the person you are nominating";
    if (d.nominating === "other" && !d.has_permission) return "Please confirm the person knows you are nominating them";
  }
  if (kind === "question" && d.question.length < 8 && !d.topics.length) return "Please write a question or pick a topic";
  if (kind === "volunteer" && !d.background) return "Please tell us your background";
  if (kind === "community" && d.group_name.length < 2) return "Please give the name of your group";
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const b = req.body || {};
    if (b.website) { res.status(200).json({ ok: true }); return; } // honeypot
    const kind = KINDS.includes(b.kind) ? b.kind : null;
    const name = s(b.name, 100);
    const phone = db.cleanPhone(b.phone);
    if (!kind || name.length < 2 || phone.replace(/\D/g, "").length < 10) {
      res.status(400).json({ error: "Name and a 10-digit phone number are required" });
      return;
    }
    const d = details(kind, b);
    const err = missing(kind, d);
    if (err) { res.status(400).json({ error: err }); return; }

    const a = db.attribution(b, req);
    const row = {
      kind, name, phone,
      email: s(b.email, 100) || null,
      area: s(b.area, 100) || null,
      language: LANGS.includes(b.language) ? b.language : null,
      details: d,
      consent_contact: true,
      consent_publish: b.consent_publish === true,
      utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign, referrer: a.referrer,
    };
    let saved = false;
    try {
      await db.rest("involvement", { method: "POST", body: row, prefer: "return=minimal" });
      saved = true;
    } catch (e) {
      console.error("involve: supabase insert failed", e.message);
    }
    const flat = {};
    Object.keys(d).forEach((k) => { flat[k] = Array.isArray(d[k]) ? d[k].join(", ") : String(d[k]); });
    const notify = (Object.assign({
        _subject: "GET INVOLVED: " + LABEL[kind] + " from " + name + " (Diabesity Expo 2026)",
        name, phone, email: row.email || "", area: row.area || "", language: row.language || "",
        ok_to_publish: row.consent_publish ? "yes" : "no",
      }, flat));
    if (!saved) { res.status(500).json({ error: "Could not save. Please WhatsApp us on +91 89193 41154." }); return; }
    res.status(200).json({ ok: true, notify });
  } catch (e) {
    console.error("involve error", e);
    res.status(500).json({ error: "Could not save. Please WhatsApp us on +91 89193 41154." });
  }
};
