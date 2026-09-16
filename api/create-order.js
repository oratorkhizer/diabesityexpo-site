// Vercel serverless: start a pass purchase.
// Creates a Razorpay Payment Link (hosted on razorpay.com) and returns its URL.
// Hosted links work whether or not diabesityexpo.com is on Razorpay's registered-website list,
// which is what blocked the embedded checkout on 16 Sep 2026.
// Amounts are fixed server-side; the client only sends a pass type.
// A pending_payment row is saved first so abandoned checkouts can be followed up.
const db = require("./_db");

// Tier prices approved 6 Sep 2026. The Metabolic Profile is never sold below Rs 1,795 per person.
const PASSES = {
  report: { amount: 49900, name: "Report Clinic Pass", people: 1 },
  metabolic: { amount: 199900, name: "Metabolic Check Pass", people: 1 },
  plus: { amount: 399900, name: "Metabolic Plus Pass", people: 1 },
  couple: { amount: 379900, name: "Couple Pass (2 Metabolic Checks)", people: 2 },
  family: { amount: 749900, name: "Family Pass (4 Metabolic Checks)", people: 4 },
};

const SITE = "https://diabesityexpo.com";
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Razorpay wants a real phone on the customer object; Indian numbers become +91XXXXXXXXXX.
function contactFor(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return null;
  let local = d;
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  if (local.length === 11 && local.startsWith("0")) local = local.slice(1);
  if (/^[6-9]\d{9}$/.test(local)) return "+91" + local;
  if (d.length >= 8 && d.length <= 15) return "+" + d;
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
    const { name, email } = body;
    const passType = body.passType === "priority" ? "report" : body.passType; // legacy id from old links
    const phone = db.cleanPhone(body.phone);
    const pass = PASSES[passType];
    const people = pass ? pass.people : 1;
    if (!pass) {
      res.status(400).json({ error: "Unknown pass type" });
      return;
    }
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      res.status(500).json({ error: "Payment keys not configured" });
      return;
    }

    const referenceId = "EXP26-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const customer = {};
    if (name) customer.name = String(name).trim().slice(0, 100);
    const contact = contactFor(phone);
    if (contact) customer.contact = contact;
    if (email && EMAIL.test(String(email).trim())) customer.email = String(email).trim().slice(0, 100);

    const r = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64"),
      },
      body: JSON.stringify({
        amount: pass.amount,
        currency: "INR",
        accept_partial: false,
        reference_id: referenceId,
        description: pass.name + " - Caspian Diabesity Expo, 14 Nov 2026",
        customer,
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: {
          event: "Caspian Diabesity Expo 2026",
          passType,
          name: (name || "").slice(0, 100),
          phone: phone,
          email: (email || "").slice(0, 100),
          people: String(people || "1"),
        },
        callback_url: SITE + "/api/payment-return",
        callback_method: "get",
      }),
    });
    const link = await r.json();
    if (!r.ok || !link.id || !link.short_url) {
      console.error("create-order: razorpay refused", JSON.stringify(link).slice(0, 500));
      res.status(502).json({ error: (link && link.error && link.error.description) || "Payment gateway did not accept the request" });
      return;
    }

    // Save the pending order (needs the service role key; skipped silently otherwise).
    // The payment link id is stored in razorpay_order_id so the Expo Desk and payment-return find it.
    let registrationId = null;
    if (db.hasServiceRole()) {
      try {
        const rows = await db.insert("registrations", {
          name: String(name || "").trim().slice(0, 100) || "Unknown",
          phone,
          email: String(email || "").trim().slice(0, 100) || null,
          people,
          pass_type: passType,
          status: "pending_payment",
          amount_paise: pass.amount,
          razorpay_order_id: link.id,
          ...db.attribution(body, req),
        });
        registrationId = rows && rows[0] ? rows[0].id : null;
        db.logEvent("begin_checkout", registrationId, { passType, amount: pass.amount, link: link.id, reference: referenceId });
      } catch (e) {
        console.error("create-order: supabase insert failed", e.message);
      }
    }

    res.status(200).json({
      url: link.short_url,
      linkId: link.id,
      orderId: link.id,
      amount: pass.amount,
      currency: "INR",
      passName: pass.name,
      registrationId,
    });
  } catch (e) {
    console.error("create-order error", e);
    res.status(500).json({ error: "Could not create order" });
  }
};
