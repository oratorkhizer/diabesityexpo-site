// Vercel serverless: verify Razorpay payment signature (HMAC SHA256) and mark the pass as paid.
const crypto = require("crypto");
const db = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ verified: false, error: "Missing fields" });
      return;
    }
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
    const ok =
      expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

    let pass = null;
    if (ok && db.hasServiceRole()) {
      try {
        const rows = await db.update(
          "registrations",
          "razorpay_order_id=eq." + encodeURIComponent(razorpay_order_id),
          { status: "paid", razorpay_payment_id: String(razorpay_payment_id).slice(0, 60) }
        );
        if (rows && rows[0]) {
          pass = { id: rows[0].id, pass_type: rows[0].pass_type, amount_paise: rows[0].amount_paise, people: rows[0].people, passCode: rows[0].pass_code };
          db.logEvent("payment_confirmed", rows[0].id, { payment_id: razorpay_payment_id });
        }
      } catch (e) {
        console.error("verify-payment: supabase update failed", e.message);
      }
    }

    res.status(200).json({ verified: ok, pass });
  } catch (e) {
    res.status(500).json({ verified: false, error: "Verification error" });
  }
};
