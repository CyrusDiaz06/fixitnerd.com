import { getEnv } from "./supabase.js";

function normalizeEmails(value) {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyNetlifyIdentity(token) {
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

async function requireAdmin(req, context) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Authorization header." };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  let email = "";

  const verification = await verifyNetlifyIdentity(token);
  if (verification.ok) {
    email = (verification.data && verification.data.email) || "";
  } else if (context && context.clientContext && context.clientContext.user) {
    email = context.clientContext.user.email || "";
  }

  if (!email) {
    return { ok: false, status: 401, error: "Invalid or expired token." };
  }

  const allowlist = normalizeEmails(
    getEnv("ADMIN_EMAILS") || getEnv("ADMIN_NOTIFY_EMAIL") || ""
  );

  if (allowlist.length === 0) {
    return { ok: false, status: 403, error: "Admin allowlist is not configured." };
  }

  if (!allowlist.includes(email.toLowerCase())) {
    return { ok: false, status: 403, error: "Access denied." };
  }

  return { ok: true, email };
}

export { requireAdmin };
