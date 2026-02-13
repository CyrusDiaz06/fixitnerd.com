import { requireAdmin } from "./_lib/auth.js";
import { supabaseFetch, supabaseInsert, supabaseDelete } from "./_lib/supabase.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function computeTotals(items) {
  return items.map((item, index) => {
    const quantity = Number(item.quantity || 1);
    const unit = Number(item.unit_cents || 0);
    const total = quantity * unit;
    return {
      title: item.title,
      description: item.description || null,
      quantity,
      unit_cents: unit,
      total_cents: total,
      sort_order: index,
    };
  });
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

  if (!payload || !payload.request_id || !Array.isArray(payload.items)) {
    return jsonResponse({ error: "Missing request_id or items." }, 400);
  }

  const normalizedItems = computeTotals(payload.items);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total_cents, 0);

  const upsert = await supabaseFetch(
    `estimates?on_conflict=request_id`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          request_id: payload.request_id,
          currency: payload.currency || "usd",
          subtotal_cents: subtotal,
          total_cents: subtotal,
        },
      ]),
    }
  );

  if (!upsert.ok || !upsert.data[0]) {
    return jsonResponse({ error: upsert.error || "Failed to save estimate." }, 500);
  }

  const estimate = upsert.data[0];
  await supabaseDelete("estimate_items", `estimate_id=eq.${estimate.id}`);

  if (normalizedItems.length > 0) {
    const itemsRows = normalizedItems.map((item) => ({
      estimate_id: estimate.id,
      ...item,
    }));
    await supabaseInsert("estimate_items", itemsRows);
  }

  await supabaseInsert("activity_log", [
    {
      request_id: payload.request_id,
      event_type: "ESTIMATE_SAVED",
      message: "Estimate saved.",
      actor_email: auth.email,
    },
  ]);

  return jsonResponse({
    estimate_id: estimate.id,
    subtotal_cents: subtotal,
    total_cents: subtotal,
  });
};
