// Vercel serverless: create a Razorpay order for a pass purchase.
// Amounts are fixed server-side; the client only sends a pass type.
const Razorpay = require("razorpay");

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
    const { passType, name, phone, email, people } = req.body || {};
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
        phone: (phone || "").slice(0, 20),
        email: (email || "").slice(0, 100),
        people: String(people || "1"),
      },
    });
    res.status(200).json({
      orderId: order.id,
      amount: pass.amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      passName: pass.name,
    });
  } catch (e) {
    res.status(500).json({ error: "Could not create order" });
  }
};
