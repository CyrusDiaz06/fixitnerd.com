import { getEnv } from "./supabase.js";

function encodeForm(data) {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
    } else if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

function addLineItems(params, items) {
  items.forEach((item, index) => {
    params[`line_items[${index}][price_data][currency]`] = item.currency || "usd";
    params[`line_items[${index}][price_data][product_data][name]`] = item.name;
    params[`line_items[${index}][price_data][product_data][description]`] = item.description || "";
    params[`line_items[${index}][price_data][unit_amount]`] = item.unit_amount;
    params[`line_items[${index}][quantity]`] = item.quantity;
  });
}

async function createCheckoutSession({ lineItems, successUrl, cancelUrl, customerEmail, metadata }) {
  const secret = getEnv("STRIPE_SECRET_KEY");
  if (!secret) {
    return { ok: false, error: "Stripe secret key is not configured." };
  }

  const params = {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  if (customerEmail) {
    params.customer_email = customerEmail;
  }

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      params[`metadata[${key}]`] = value;
    });
  }

  addLineItems(params, lineItems);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(params),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || "Stripe error." };
  }

  const data = await response.json();
  return { ok: true, data };
}

export { createCheckoutSession };
