import crypto from "node:crypto";
import { getEnv, supabaseInsert, supabaseFetch } from "./_lib/supabase.js";
import { sendEmail } from "./_lib/email.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function generatePublicId() {
  return crypto.randomBytes(16).toString("base64url");
}

function buildTrackingLink(publicId) {
  const siteUrl = getEnv("NETLIFY_SITE_URL") || "";
  if (!siteUrl) {
    return `/request-status.html?id=${publicId}`;
  }
  return `${siteUrl.replace(/\/$/, "")}/request-status.html?id=${publicId}`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let payload = null;
  try {
    payload = await req.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const requiredFields = ["service_type", "title", "description", "name", "email"];
  const missing = requiredFields.filter((field) => !payload || !payload[field]);
  if (missing.length > 0) {
    return jsonResponse({ error: `Missing fields: ${missing.join(", ")}.` }, 400);
  }

  const publicId = generatePublicId();

  const requestRow = {
    public_id: publicId,
    service_type: payload.service_type,
    title: payload.title,
    description: payload.description,
    urgency: payload.urgency || null,
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    status: "NEW",
  };

  const insertRequest = await supabaseInsert("requests", [requestRow]);
  if (!insertRequest.ok) {
    return jsonResponse({ error: insertRequest.error || "Failed to save request." }, 500);
  }

  const savedRequest = insertRequest.data[0];

  if (Array.isArray(payload.assets) && payload.assets.length > 0) {
    const assets = payload.assets
      .filter((asset) => asset && asset.asset_url)
      .map((asset) => ({
        request_id: savedRequest.id,
        asset_url: asset.asset_url,
        asset_type: asset.asset_type || null,
        file_name: asset.file_name || null,
        file_size: asset.file_size || null,
      }));

    if (assets.length > 0) {
      await supabaseInsert("request_assets", assets);
    }
  }

  await supabaseInsert("activity_log", [
    {
      request_id: savedRequest.id,
      event_type: "REQUEST_CREATED",
      message: "Customer submitted a new request.",
    },
  ]);

  const warnings = [];
  const trackingLink = buildTrackingLink(publicId);
  const customerEmailResult = await sendEmail({
    to: payload.email,
    subject: "We received your request",
    text: `Thanks for reaching out! Track your request here: ${trackingLink}`,
    html: `<p>Thanks for reaching out!</p><p>Track your request here: <a href="${trackingLink}">${trackingLink}</a></p>`,
  });

  if (!customerEmailResult.sent && customerEmailResult.warning) {
    warnings.push(customerEmailResult.warning);
  }

  const adminEmail = getEnv("ADMIN_NOTIFY_EMAIL");
  if (adminEmail) {
    const adminResult = await sendEmail({
      to: adminEmail,
      subject: "New request submitted",
      text: `${payload.name} submitted a request: ${payload.title}`,
      html: `<p><strong>${payload.name}</strong> submitted a request.</p><p>${payload.title}</p>`,
    });
    if (!adminResult.sent && adminResult.warning) {
      warnings.push(adminResult.warning);
    }
  } else {
    warnings.push("ADMIN_NOTIFY_EMAIL is not configured.");
  }

  return jsonResponse({ public_id: publicId, warning: warnings.length ? warnings.join(" ") : undefined });
};
