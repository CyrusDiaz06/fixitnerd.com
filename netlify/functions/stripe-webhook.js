import crypto from "node:crypto";
import { supabaseFetch, supabaseUpdate, supabaseInsert } from "./_lib/supabase.js";
import { sendEmail } from "./_lib/email.js";
import { getEnv } from "./_lib/supabase.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) {
    return false;
  }

  const parts = header.split(",");
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signaturePart = parts.find((part) => part.startsWith("v1="));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = timestampPart.split("=")[1];
  const signature = signaturePart.split("=")[1];
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (error) {
    return false;
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const secret = getEnv("STRIPE_WEBHOOK_SECRET");
  const signatureHeader = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  if (!verifyStripeSignature(rawBody, signatureHeader, secret)) {
    return jsonResponse({ error: "Invalid signature." }, 400);
  }

  let event = null;
  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    return jsonResponse({ error: "Invalid payload." }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return jsonResponse({ received: true });
  }

  const session = event.data && event.data.object ? event.data.object : null;
  if (!session || !session.id) {
    return jsonResponse({ error: "Invalid session." }, 400);
  }

  const estimateResult = await supabaseFetch(
    `estimates?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=id,request_id`
  );

  if (!estimateResult.ok || !estimateResult.data[0]) {
    return jsonResponse({ received: true });
  }

  const estimate = estimateResult.data[0];
  await supabaseUpdate(
    "requests",
    `id=eq.${estimate.request_id}`,
    { status: "PAID" }
  );

  await supabaseInsert("activity_log", [
    {
      request_id: estimate.request_id,
      event_type: "PAYMENT_RECEIVED",
      message: "Stripe payment completed.",
    },
  ]);

  const requestResult = await supabaseFetch(
    `requests?id=eq.${estimate.request_id}&select=name,email,title`
  );

  const requestRow = requestResult.ok ? requestResult.data[0] : null;
  const adminEmail = getEnv("ADMIN_NOTIFY_EMAIL");

  if (requestRow && requestRow.email) {
    await sendEmail({
      to: requestRow.email,
      subject: "Payment received",
      text: "Thanks! Your payment was received.",
      html: "<p>Thanks! Your payment was received.</p>",
    });
  }

  if (adminEmail && requestRow) {
    await sendEmail({
      to: adminEmail,
      subject: "Payment received",
      text: `Payment received for ${requestRow.title}.`,
      html: `<p>Payment received for <strong>${requestRow.title}</strong>.</p>`,
    });
  }

  return jsonResponse({ received: true });
};
