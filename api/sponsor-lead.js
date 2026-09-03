// Vercel serverless: sponsor, exhibitor and CSR enquiry capture.
const db = require("./_db");

const INTERESTS = ["title", "co_powered", "screening_zone", "gold", "silver", "cme_slot", "stall", "csr", "other"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
    const org = String(body.org || "").trim().slice(0, 150);
    const contact_name = String(body.contact_name || "").trim().slice(0, 100);
    const phone = db.cleanPhone(body.phone);
    const email = String(body.email || "").trim().slice(0, 100) || null;
    const interest = INTERESTS.includes(body.interest) ? body.interest : "other";
    const budget_band = String(body.budget_band || "").slice(0, 60) || null;
    const message = String(body.message || "").slice(0, 2000) || null;
    if (org.length < 2 || contact_name.length < 2 || phone.replace(/\D/g, "").length < 10) {
      res.status(400).json({ error: "Organisation, contact name and phone are required" });
      return;
    }
    const a = db.attribution(body, req);
    let id = null;
    try {
      const rows = await db.insert("sponsor_leads", {
        org, contact_name, phone, email, interest, budget_band, message,
        utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign, referrer: a.referrer,
      });
      id = rows && rows[0] ? rows[0].id : null;
    } catch (e) {
      console.error("sponsor-lead: supabase insert failed", e.message);
    }
    fetch("https://formsubmit.co/ajax/oratorkhizer@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ _subject: "SPONSOR LEAD: Diabesity Expo 2026 (" + interest + ")", org, contact_name, phone, email: email || "", interest, budget_band: budget_band || "", message: message || "" }),
    }).catch(() => null);
    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error("sponsor-lead error", e);
    res.status(500).json({ error: "Could not save enquiry" });
  }
};
