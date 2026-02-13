import { requireAdmin } from "./_lib/auth.js";
import { supabaseFetch } from "./_lib/supabase.js";

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

  const result = await supabaseFetch(
    "requests?select=id,title,service_type,urgency,name,status,created_at&order=created_at.desc"
  );

  if (!result.ok) {
    return jsonResponse({ error: result.error || "Failed to load requests." }, 500);
  }

  return jsonResponse({ requests: result.data });
};
