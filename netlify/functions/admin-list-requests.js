import { getEnv, supabaseFetch } from "./_lib/supabase.js";

const corsHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders,
  });
}

function normalizeEmails(value) {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyIdentityToken(token) {
  const siteUrl = getEnv("NETLIFY_SITE_URL");
  if (!siteUrl) {
    return { ok: false, error: "NETLIFY_SITE_URL is not configured." };
  }

  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/.netlify/identity/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || "Invalid Netlify Identity token." };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function requireAdmin(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { ok: false };
  }

  const verification = await verifyIdentityToken(token);
  if (!verification.ok) {
    return { ok: false };
  }

  const email = (verification.data && verification.data.email) || "";
  if (!email) {
    return { ok: false };
  }

  const allowlist = normalizeEmails(getEnv("ADMIN_EMAILS") || "");
  if (allowlist.length === 0) {
    return { ok: false };
  }

  if (!allowlist.includes(email.toLowerCase())) {
    return { ok: false };
  }

  return { ok: true, email };
}

function isMissingView(result) {
  if (!result || result.ok) {
    return false;
  }
  const message = (result.error || "").toLowerCase();
  return (
    result.status === 404 ||
    message.includes("could not find") ||
    message.includes("does not exist") ||
    message.includes("relation")
  );
}

async function fetchRequests() {
  const viewResult = await supabaseFetch(
    "v_requests_queue?select=*&order=created_at.desc&limit=100"
  );
  if (viewResult.ok) {
    return viewResult;
  }

  if (!isMissingView(viewResult)) {
    return viewResult;
  }

  return supabaseFetch("requests?select=*&order=created_at.desc&limit=100");
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ requests: [], error: "Method not allowed" }, 405);
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return jsonResponse({ requests: [], error: "Unauthorized" }, 401);
  }

  const result = await fetchRequests();
  if (!result.ok) {
    const message = result.error || "Unable to load requests.";
    return jsonResponse({ requests: [], error: message }, result.status || 500);
  }

  const requests = Array.isArray(result.data) ? result.data : [];
  return jsonResponse({ requests });
};
