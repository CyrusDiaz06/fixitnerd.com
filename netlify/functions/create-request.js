import crypto from "node:crypto";
import { getEnv, supabaseInsert } from "./_lib/supabase.js";
import { sendEmail } from "./_lib/email.js";

function baseHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: baseHeaders(),
    body: JSON.stringify(payload),
  };
}

function generatePublicId() {
  return crypto.randomBytes(16).toString("base64url");
}

function buildTrackingLink(publicId) {
  const siteUrl = getEnv("NETLIFY_SITE_URL") || "";
  if (!siteUrl) return `/request-status.html?id=${publicId}`;
  return `${siteUrl.replace(/\/$/, "")}/request-status.html?id=${publicId}`;
}

// Standard Netlify Function handler (NOT Edge)
export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: baseHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const requiredFields = ["service_type", "title", "description", "name", "email"];
  const missing = requiredFields.filter((field) => !payload?.[field]);
  if (missing.length > 0) {
    return json(400, { ok: false, error: `Missing fields: ${missing.join(", ")}.` });
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
    // Keep errors ASCII-only so nothing weird can break the response
    const err = String(insertRequest.error || "Failed to save request.").replace(/[^\x00-\x7F]/g, "");
    return json(500, { ok: false, error: err });
  }

  const savedRequest = insertRequest.data?.[0];
  const trackingLink = buildTrackingLink(publicId);

  // Email is non-blocking (launch day rule)
  const warnings = [];

  try {
    const customerEmailResult = await sendEmail({
      to: payload.email,
      subject: "We received your request",
      text: `Thanks for reaching out! Track your request here: ${trackingLink}`,
      html: `<p>Thanks for reaching out!</p><p>Track your request here: <a href="${trackingLink}">${trackingLink}</a></p>`,
    });

    if (!customerEmailResult?.sent && customerEmailResult?.warning) {
      warnings.push(String(customerEmailResult.warning).replace(/[^\x00-\x7F]/g, ""));
    }
  } catch {
    warnings.push("Customer email failed (non-blocking).");
  }

  const adminEmail = getEnv("ADMIN_NOTIFY_EMAIL");
  if (adminEmail) {
    try {
      const adminResult = await sendEmail({
        to: adminEmail,
        subject: "New request submitted",
        text: `${payload.name} submitted a request: ${payload.title}`,
        html: `<p><strong>${payload.name}</strong> submitted a request.</p><p>${payload.title}</p>`,
      });

      if (!adminResult?.sent && adminResult?.warning) {
        warnings.push(String(adminResult.warning).replace(/[^\x00-\x7F]/g, ""));
      }
    } catch {
      warnings.push("Admin email failed (non-blocking).");
    }
  } else {
    warnings.push("ADMIN_NOTIFY_EMAIL is not configured.");
  }

  return json(200, {
    ok: true,
    request_id: savedRequest?.id,
    public_id: publicId,
    tracking_link: trackingLink,
    warning: warnings.length ? warnings.join(" ") : undefined,
  });
};
