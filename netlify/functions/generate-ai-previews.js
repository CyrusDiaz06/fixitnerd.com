import { requireAdmin } from "./_lib/auth.js";
import { getEnv, supabaseInsert } from "./_lib/supabase.js";

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

  if ((getEnv("FEATURE_AI_PREVIEWS") || "").toLowerCase() !== "true") {
    return jsonResponse({ error: "AI previews are disabled." }, 403);
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

  await supabaseInsert("previews", [
    {
      request_id: payload.request_id,
      provider: payload.provider || "manual",
      preview_url: payload.preview_url || null,
      status: "PENDING",
    },
  ]);

  return jsonResponse({ ok: true, message: "Preview scaffolding created." });
};
