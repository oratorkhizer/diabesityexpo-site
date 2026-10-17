// Vercel serverless: free pass registration.
// Saves the registrant to Supabase (the follow-up list) and emails a copy to the organiser inbox.
const db = require("./_db");
const bot = require("./_bot");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
    // Bot checks: a drop answers like a normal registration but saves and emails nothing.
    const verdict = await bot.check(req, { honeypot: body.website, ms: body.ms, name: body.name, email: body.email, token: body.turnstile });
    if (verdict === "drop") { res.status(200).json({ ok: true, id: null, passCode: null, notify: null }); return; }
    if (verdict === "reject") { res.status(400).json({ error: bot.HUMAN_MSG, human: false }); return; }
    const name = String(body.name || "").trim().slice(0, 100);
    const phone = db.cleanPhone(body.phone);
    const email = String(body.email || "").trim().slice(0, 100) || null;
    const people = Math.min(20, Math.max(1, parseInt(body.people, 10) || 1));
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) {
      res.status(400).json({ error: "Name and a valid WhatsApp number are required" });
      return;
    }

    let id = null, passCode = null;
    try {
      const rows = await db.insert("registrations", {
        name,
        phone,
        email,
        people,
        pass_type: "free",
        status: "registered",
        amount_paise: 0,
        ...db.attribution(body, req),
      });
      id = rows && rows[0] ? rows[0].id : null;
      passCode = rows && rows[0] ? rows[0].pass_code : null;
    } catch (e) {
      console.error("register: supabase insert failed", e.message);
    }

    // Email alert fields. The browser sends them to FormSubmit (its Cloudflare
    // wall blocks calls from the Vercel server), see /assets/notify.js.
    const notify = ({
        _subject: "Free Pass: Diabesity Expo 2026",
        name,
        phone,
        email: email || "",
        people,
        pass: "Free Entry Pass",
        saved_to_database: id ? "yes" : "no",
        pass_code: passCode || "",
      });

    res.status(200).json({ ok: true, id, passCode, notify });
  } catch (e) {
    console.error("register error", e);
    res.status(500).json({ error: "Could not register" });
  }
};
