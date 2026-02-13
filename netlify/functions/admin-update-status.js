import { requireAdmin } from "./_lib/auth.js";
import { supabaseUpdate, supabaseInsert } from "./_lib/supabase.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
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

  if (!payload || !payload.id || !payload.status) {
    return jsonResponse({ error: "Missing id or status." }, 400);
  }

  const update = await supabaseUpdate(
    "requests",
    `id=eq.${encodeURIComponent(payload.id)}`,
    { status: payload.status }
  );

  if (!update.ok) {
    return jsonResponse({ error: update.error || "Failed to update status." }, 500);
  }

  await supabaseInsert("activity_log", [
    {
      request_id: payload.id,
      event_type: "STATUS_UPDATED",
      message: `Status updated to ${payload.status}.`,
      actor_email: auth.email,
    },
  ]);

  return jsonResponse({ status: payload.status });
};
