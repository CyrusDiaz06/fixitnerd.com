import { supabaseFetch } from "./_lib/supabase.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const url = new URL(req.url);
  const publicId = url.searchParams.get("public_id");
  if (!publicId) {
    return jsonResponse({ error: "Missing public_id." }, 400);
  }

  const requestResult = await supabaseFetch(
    `requests?public_id=eq.${encodeURIComponent(publicId)}&select=id,public_id,service_type,title,status,created_at`
  );

  if (!requestResult.ok) {
    return jsonResponse({ error: requestResult.error || "Request not found." }, 404);
  }

  const requestRow = requestResult.data[0];
  if (!requestRow) {
    return jsonResponse({ error: "Request not found." }, 404);
  }

  const estimateResult = await supabaseFetch(
    `estimates?request_id=eq.${requestRow.id}&select=id,subtotal_cents,total_cents,stripe_checkout_url`
  );

  let estimate = null;
  if (estimateResult.ok && estimateResult.data && estimateResult.data[0]) {
    const estimateRow = estimateResult.data[0];
    const itemsResult = await supabaseFetch(
      `estimate_items?estimate_id=eq.${estimateRow.id}&select=title,description,quantity,unit_cents,total_cents,sort_order&order=sort_order.asc`
    );
    estimate = {
      subtotal_cents: estimateRow.subtotal_cents,
      total_cents: estimateRow.total_cents,
      stripe_checkout_url: estimateRow.stripe_checkout_url,
      items: itemsResult.ok ? itemsResult.data : [],
    };
  }

  return jsonResponse({
    public_id: requestRow.public_id,
    service_type: requestRow.service_type,
    title: requestRow.title,
    status: requestRow.status,
    created_at: requestRow.created_at,
    estimate,
  });
};
