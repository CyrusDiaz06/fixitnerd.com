import { requireAdmin } from "./_lib/auth.js";
import { getEnv, supabaseFetch } from "./_lib/supabase.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req, context) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const auth = await requireAdmin(req, context);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status || 401);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonResponse({ error: "Missing id." }, 400);
  }

  const requestResult = await supabaseFetch(
    `requests?id=eq.${encodeURIComponent(id)}&select=*`
  );

  if (!requestResult.ok || !requestResult.data[0]) {
    return jsonResponse({ error: requestResult.error || "Request not found." }, 404);
  }

  const requestRow = requestResult.data[0];

  const assetsResult = await supabaseFetch(
    `request_assets?request_id=eq.${requestRow.id}&select=asset_url,asset_type,file_name,file_size,created_at`
  );

  const estimateResult = await supabaseFetch(
    `estimates?request_id=eq.${requestRow.id}&select=*`
  );

  let estimate = null;
  if (estimateResult.ok && estimateResult.data[0]) {
    const estimateRow = estimateResult.data[0];
    const itemsResult = await supabaseFetch(
      `estimate_items?estimate_id=eq.${estimateRow.id}&select=title,description,quantity,unit_cents,total_cents,sort_order&order=sort_order.asc`
    );
    estimate = {
      ...estimateRow,
      items: itemsResult.ok ? itemsResult.data : [],
    };
  }

  const activityResult = await supabaseFetch(
    `activity_log?request_id=eq.${requestRow.id}&select=event_type,message,actor_email,created_at&order=created_at.desc`
  );

  return jsonResponse({
    request: requestRow,
    assets: assetsResult.ok ? assetsResult.data : [],
    estimate,
    activity: activityResult.ok ? activityResult.data : [],
    feature_ai_previews: (getEnv("FEATURE_AI_PREVIEWS") || "").toLowerCase() === "true",
  });
};
