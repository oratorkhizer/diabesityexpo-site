// Vercel serverless: create a Razorpay order for a pass purchase.
// Amounts are fixed server-side; the client only sends a pass type.
// A pending_payment row is saved first so abandoned checkouts can be followed up.
const Razorpay = require("razorpay");
const db = require("./_db");

const PASSES = {
  priority: { amount: 49900, name: "Priority Pass" },
  family: { amount: 199900, name: "Family Pass (up to 4 people)" },
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
    const { passType, name, email, people } = body;
    const phone = db.cleanPhone(body.phone);
    const pass = PASSES[passType];
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
          people: Math.min(20, Math.max(1, parseInt(people, 10) || (passType === "family" ? 4 : 1))),
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
