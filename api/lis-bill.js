// Vercel serverless: create the laboratory bill(s) in LiveHealth (CrelioHealth LIMS) at venue check-in.
// Called by the Expo Desk after a paid pass is checked in. One bill per person on the pass.
//
// Configuration (Vercel env vars):
//   LIVEHEALTH_API_TOKEN   API token issued by CrelioHealth for the Caspian Diagnostic Centre account
//   LIVEHEALTH_BASE_URL    default https://livehealth.solutions
//   LIS_TEST_ID_METABOLIC  LiveHealth test/package ID of the Caspian Metabolic Profile (with BCA)
//   LIS_TEST_ID_REPORT     (optional) test ID for the Report Clinic consult, if it is billed in LIS at all
//
// The field names in LIS_REQUEST below follow CrelioHealth's registerBillAPI. Confirm them against the
// current API document (api.creliohealth.com) when the token arrives; they are kept in one place on purpose.
const db = require("./_db");

const BASE = process.env.LIVEHEALTH_BASE_URL || "https://livehealth.solutions";
const TOKEN = process.env.LIVEHEALTH_API_TOKEN || "";
const TEST_IDS = {
  metabolic: process.env.LIS_TEST_ID_METABOLIC || "",
  plus: process.env.LIS_TEST_ID_METABOLIC || "",
  couple: process.env.LIS_TEST_ID_METABOLIC || "",
  family: process.env.LIS_TEST_ID_METABOLIC || "",
  report: process.env.LIS_TEST_ID_REPORT || "",
};

function pad(n) { return String(n).padStart(2, "0"); }
function nowIST() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Build one registerBillAPI request for one person.
function LIS_REQUEST(person, reg, testId) {
  const gender = person.sex === "F" ? "Female" : person.sex === "M" ? "Male" : "Other";
  return {
    billDetails: {
      billDate: nowIST(),
      paymentType: "Online",
      totalAmount: 0,          // the pass was paid on Razorpay; the LIS bill records the tests, not a fresh charge
      advance: 0,
      referenceNumber: reg.pass_code,
      comments: "Caspian Diabesity Expo 2026, pass " + reg.pass_code + (reg.razorpay_payment_id ? ", Razorpay " + reg.razorpay_payment_id : ""),
    },
    patientDetails: {
      designation: gender === "Female" ? "Ms." : "Mr.",
      fullName: person.name,
      age: person.age ? Number(person.age) : undefined,
      gender,
      mobile: String(reg.phone || "").replace(/\D/g, "").slice(-10),
      email: reg.email || undefined,
      area: "Hyderabad",
    },
    testList: [{ testID: Number(testId) }],
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const body = req.body || {};
    const adminPass = String(body.adminPasscode || "");
    const code = String(body.code || "").trim().toUpperCase();
    const people = Array.isArray(body.people) ? body.people.slice(0, 6) : [];
    if (!adminPass || !code) { res.status(400).json({ error: "Missing fields" }); return; }
    if (!db.hasServiceRole()) { res.status(500).json({ error: "Server not configured" }); return; }

    const okAdmin = await db.rest("rpc/admin_check", { method: "POST", body: { p_passcode: adminPass } });
    if (okAdmin !== true) { res.status(401).json({ error: "unauthorised" }); return; }

    const rows = await db.rest("registrations?pass_code=eq." + encodeURIComponent(code) + "&select=*");
    const reg = rows && rows[0];
    if (!reg) { res.status(404).json({ error: "Pass not found" }); return; }
    if (reg.status !== "paid") { res.status(400).json({ error: "Pass is not paid" }); return; }
    const testId = TEST_IDS[reg.pass_type];
    if (!TOKEN || !testId) {
      res.status(200).json({ configured: false, message: "LiveHealth API token or test ID not set in Vercel. Bill manually in LiveHealth for now." });
      return;
    }
    if (reg.lis_bill_ids) { res.status(200).json({ configured: true, already: true, billIds: reg.lis_bill_ids }); return; }

    const list = people.length ? people : [{ name: reg.name, age: null, sex: null }];
    const billIds = [], errors = [];
    for (const p of list) {
      const name = String(p.name || "").trim().slice(0, 100);
      if (!name) continue;
      const payload = LIS_REQUEST({ name, age: p.age, sex: p.sex }, reg, testId);
      try {
        const r = await fetch(BASE + "/registerBillAPI/?token=" + encodeURIComponent(TOKEN), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
        if (!r.ok) throw new Error("LIS " + r.status + ": " + text.slice(0, 200));
        const id = (data && (data.billId || data.bill_id || data.billID || (data.bill && data.bill.id))) || null;
        billIds.push(id ? String(id) : "created");
      } catch (e) {
        errors.push(name + ": " + e.message);
      }
    }
    const patch = {
      lis_bill_ids: billIds.length ? billIds.join(",") : null,
      lis_status: errors.length ? (billIds.length ? "partial" : "failed") : "billed",
      lis_error: errors.length ? errors.join(" | ").slice(0, 500) : null,
      lis_billed_at: billIds.length ? new Date().toISOString() : null,
    };
    await db.update("registrations", "id=eq." + reg.id, patch);
    db.logEvent("lis_bill", reg.id, { billIds, errors });
    res.status(200).json({ configured: true, billIds, errors });
  } catch (e) {
    console.error("lis-bill error", e);
    res.status(500).json({ error: "Could not create the lab bill" });
  }
};
