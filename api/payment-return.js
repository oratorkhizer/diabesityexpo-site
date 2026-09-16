// Vercel serverless: Razorpay sends the visitor back here after a hosted Payment Link is paid.
// Verifies the signature, marks the registration paid, and redirects to /thanks with the pass code.
const crypto = require("crypto");
const db = require("./_db");

const SITE = "https://diabesityexpo.com";

function safe(v, n) {
  return String(v || "").replace(/[^A-Za-z0-9_\-.]/g, "").slice(0, n || 80);
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const paymentId = safe(q.razorpay_payment_id, 60);
  const linkId = safe(q.razorpay_payment_link_id, 60);
  const referenceId = safe(q.razorpay_payment_link_reference_id, 60);
  const status = safe(q.razorpay_payment_link_status, 20);
  const signature = safe(q.razorpay_signature, 128);

  if (!paymentId || !linkId || !signature || status !== "paid") {
    res.writeHead(302, { Location: SITE + "/?payment=incomplete#passes" });
    res.end();
    return;
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(linkId + "|" + referenceId + "|" + status + "|" + paymentId)
    .digest("hex");
  const ok =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!ok) {
    res.writeHead(302, { Location: SITE + "/?payment=unverified&pid=" + encodeURIComponent(paymentId) + "#register" });
    res.end();
    return;
  }

  let passType = "";
  let passCode = "";
  if (db.hasServiceRole()) {
    try {
      const rows = await db.update(
        "registrations",
        "razorpay_order_id=eq." + encodeURIComponent(linkId),
        { status: "paid", razorpay_payment_id: paymentId }
      );
      if (rows && rows[0]) {
        passType = rows[0].pass_type || "";
        passCode = rows[0].pass_code || "";
        db.logEvent("payment_confirmed", rows[0].id, { payment_id: paymentId, link: linkId });
      }
    } catch (e) {
      console.error("payment-return: supabase update failed", e.message);
    }
  }

  // No database row (service key missing): read the pass type back from the link's notes.
  if (!passType && process.env.RAZORPAY_KEY_ID && secret) {
    try {
      const r = await fetch("https://api.razorpay.com/v1/payment_links/" + linkId, {
        headers: { Authorization: "Basic " + Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + secret).toString("base64") },
      });
      const link = await r.json();
      if (r.ok && link.notes && link.notes.passType) passType = safe(link.notes.passType, 20);
    } catch (e) {
      console.error("payment-return: link fetch failed", e.message);
    }
  }

  const to =
    SITE + "/thanks?pass=" + encodeURIComponent(passType || "metabolic") +
    "&pid=" + encodeURIComponent(paymentId) +
    "&oid=" + encodeURIComponent(linkId) +
    (passCode ? "&c=" + encodeURIComponent(passCode) : "");
  res.writeHead(302, { Location: to, "Cache-Control": "no-store" });
  res.end();
};
