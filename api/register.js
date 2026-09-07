// Vercel serverless: free pass registration.
// Saves the registrant to Supabase (the follow-up list) and emails a copy to the organiser inbox.
const db = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
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

    // Best-effort copy to the organiser inbox (existing FormSubmit route).
    fetch("https://formsubmit.co/ajax/oratorkhizer@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "Free Pass: Diabesity Expo 2026",
        name,
        phone,
        email: email || "",
        people,
        pass: "Free Entry Pass",
        saved_to_database: id ? "yes" : "no",
        pass_code: passCode || "",
      }),
    }).catch(() => null);

    res.status(200).json({ ok: true, id, passCode });
  } catch (e) {
    console.error("register error", e);
    res.status(500).json({ error: "Could not register" });
  }
};
