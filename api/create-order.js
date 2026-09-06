// Vercel serverless: create a Razorpay order for a pass purchase.
// Amounts are fixed server-side; the client only sends a pass type.
// A pending_payment row is saved first so abandoned checkouts can be followed up.
const Razorpay = require("razorpay");
const db = require("./_db");

// Tier prices approved 6 Sep 2026. The Metabolic Profile is never sold below Rs 1,795 per person.
const PASSES = {
  report: { amount: 49900, name: "Report Clinic Pass", people: 1 },
  metabolic: { amount: 199900, name: "Metabolic Check Pass", people: 1 },
  plus: { amount: 499900, name: "Metabolic Plus Pass", people: 1 },
  couple: { amount: 379900, name: "Couple Pass (2 Metabolic Checks)", people: 2 },
  family: { amount: 749900, name: "Family Pass (4 Metabolic Checks)", people: 4 },
};

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
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      res.status(500).json({ error: "Payment keys not configured" });
      return;
    }
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const order = await rzp.orders.create({
      amount: pass.amount,
      currency: "INR",
      receipt: "expo26_" + Date.now(),
      notes: {
        event: "Caspian Diabesity Expo 2026",
        passType,
        name: (name || "").slice(0, 100),
        phone: phone,
        email: (email || "").slice(0, 100),
        people: String(people || "1"),
      },
    });

    // Save the pending order (needs the service role key; skipped silently otherwise).
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
          razorpay_order_id: order.id,
          ...db.attribution(body, req),
        });
        registrationId = rows && rows[0] ? rows[0].id : null;
        db.logEvent("begin_checkout", registrationId, { passType, amount: pass.amount });
      } catch (e) {
        console.error("create-order: supabase insert failed", e.message);
      }
    }

    res.status(200).json({
      orderId: order.id,
      amount: pass.amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      passName: pass.name,
      registrationId,
    });
  } catch (e) {
    console.error("create-order error", e);
    res.status(500).json({ error: "Could not create order" });
  }
};
