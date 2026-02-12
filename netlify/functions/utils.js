import { createClient } from '@supabase/supabase-js';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { randomBytes } from 'node:crypto';

const jwksBySite = new Map();

export function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getRequiredEnv(name) {
  const value = Netlify.env.get(name);
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name) {
  return Netlify.env.get(name);
}

export function getSupabaseClient() {
  const url = getRequiredEnv('SUPABASE_URL');
  const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}

export async function parseJsonBody(req) {
  if (!req.body) {
    return {};
  }
  try {
    return await req.json();
  } catch (error) {
    throw createHttpError(400, 'Invalid JSON body.');
  }
}

export function getSiteUrl(req) {
  const configured = getOptionalEnv('NETLIFY_SITE_URL');
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return new URL(req.url).origin;
}

export function getAllowlistedEmails() {
  const raw = getOptionalEnv('ADMIN_EMAILS') || getOptionalEnv('ADMIN_NOTIFY_EMAIL');
  if (!raw) {
    throw new Error('Missing env var: ADMIN_EMAILS');
  }
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdmin(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createHttpError(401, 'Missing Authorization header.');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const siteUrl = getSiteUrl(req);
  const issuer = new URL('/.netlify/identity', siteUrl).toString();
  const jwksUrl = new URL('/.netlify/identity/.well-known/jwks.json', siteUrl);

  if (!jwksBySite.has(siteUrl)) {
    jwksBySite.set(siteUrl, createRemoteJWKSet(jwksUrl));
  }

  let payload;
  try {
    const result = await jwtVerify(token, jwksBySite.get(siteUrl), { issuer });
    payload = result.payload;
  } catch (error) {
    throw createHttpError(401, 'Invalid or expired token.');
  }

  const email = String(payload.email || '').toLowerCase();
  const allowlist = getAllowlistedEmails();
  if (!allowlist.includes(email)) {
    throw createHttpError(403, 'User is not authorized.');
  }

  return { email, payload };
}

export function generatePublicId() {
  return randomBytes(16).toString('base64url');
}

export function formatMoney(cents, currency = 'usd') {
  const amount = (cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount);
}

export async function sendEmail({ to, subject, html, text }) {
  const provider = (getOptionalEnv('EMAIL_PROVIDER') || 'resend').toLowerCase();
  const from = getRequiredEnv('EMAIL_FROM');

  if (provider === 'sendgrid') {
    const apiKey = getRequiredEnv('SENDGRID_API_KEY');
    const { default: sgMail } = await import('@sendgrid/mail');
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to,
      from,
      subject,
      text,
      html
    });
    return { sent: true };
  }

  const resendKey = getRequiredEnv('RESEND_API_KEY');
  const { Resend } = await import('resend');
  const resend = new Resend(resendKey);
  await resend.emails.send({
    from,
    to,
    subject,
    html,
    text
  });
  return { sent: true };
}

export function normalizeAssetLinks(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((link) => String(link).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[\n,]+/)
    .map((link) => link.trim())
    .filter(Boolean);
}

export function resolveError(error, fallbackMessage) {
  if (error?.message && error.message.startsWith('Missing env var:')) {
    return jsonResponse(500, { error: error.message });
  }
  const status = error?.statusCode || 500;
  return jsonResponse(status, { error: error?.message || fallbackMessage || 'Unexpected error.' });
}
