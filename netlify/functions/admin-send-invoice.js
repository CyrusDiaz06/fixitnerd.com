import { requireAdmin } from "./_lib/auth.js";
import { supabaseFetch, supabaseInsert, supabaseUpdate } from "./_lib/supabase.js";
import { createCheckoutSession } from "./_lib/stripe.js";
import { sendEmail } from "./_lib/email.js";
import { getEnv } from "./_lib/supabase.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildReturnUrl(publicId) {
  const siteUrl = getEnv("NETLIFY_SITE_URL") || "";
  const base = siteUrl ? siteUrl.replace(/\/$/, "") : "";
  return `${base}/request-status.html?id=${publicId}`;
}

export default async (req, context) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const auth = await requireAdmin(req, context);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status || 401);
  }

  let payload = null;
  try {
    payload = await req.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!payload || !payload.request_id) {
    return jsonResponse({ error: "Missing request_id." }, 400);
  }

  const requestResult = await supabaseFetch(
    `requests?id=eq.${encodeURIComponent(payload.request_id)}&select=id,public_id,title,email`
  );

  if (!requestResult.ok || !requestResult.data[0]) {
    return jsonResponse({ error: requestResult.error || "Request not found." }, 404);
  }

  const requestRow = requestResult.data[0];

  const estimateResult = await supabaseFetch(
    `estimates?request_id=eq.${requestRow.id}&select=id,currency,total_cents`
  );

  if (!estimateResult.ok || !estimateResult.data[0]) {
    return jsonResponse({ error: "Estimate not found." }, 404);
  }

  const estimate = estimateResult.data[0];
  const itemsResult = await supabaseFetch(
    `estimate_items?estimate_id=eq.${estimate.id}&select=title,description,quantity,unit_cents`
  );

  const items = itemsResult.ok ? itemsResult.data : [];
  if (items.length === 0) {
    return jsonResponse({ error: "Estimate has no line items." }, 400);
  }

  const lineItems = items.map((item) => ({
    name: item.title,
    description: item.description || "",
    quantity: item.quantity,
    unit_amount: item.unit_cents,
    currency: estimate.currency || "usd",
  }));

  const returnUrl = buildReturnUrl(requestRow.public_id);
  const sessionResult = await createCheckoutSession({
    lineItems,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
    customerEmail: requestRow.email,
    metadata: { request_id: requestRow.id, public_id: requestRow.public_id },
  });

  if (!sessionResult.ok) {
    return jsonResponse({ error: sessionResult.error || "Stripe session failed." }, 500);
  }

  const session = sessionResult.data;

  await supabaseUpdate(
    "estimates",
    `id=eq.${estimate.id}`,
    { stripe_session_id: session.id, stripe_checkout_url: session.url }
  );

  await supabaseUpdate(
    "requests",
    `id=eq.${requestRow.id}`,
    { status: "SENT_TO_CUSTOMER" }
  );

  await supabaseInsert("activity_log", [
    {
      request_id: requestRow.id,
      event_type: "INVOICE_SENT",
      message: "Invoice sent to customer.",
      actor_email: auth.email,
    },
  ]);

  const warnings = [];
  const customerEmailResult = await sendEmail({
    to: requestRow.email,
    subject: "Your estimate is ready",
    text: `Your estimate is ready. Pay here: ${session.url}`,
    html: `<p>Your estimate is ready.</p><p><a href="${session.url}">Pay your invoice</a></p>`,
  });

  if (!customerEmailResult.sent && customerEmailResult.warning) {
    warnings.push(customerEmailResult.warning);
  }

  return jsonResponse({ checkout_url: session.url, warning: warnings.length ? warnings.join(" ") : undefined });
};
