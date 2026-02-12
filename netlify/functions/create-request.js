import {
  jsonResponse,
  getSupabaseClient,
  parseJsonBody,
  generatePublicId,
  sendEmail,
  getSiteUrl,
  normalizeAssetLinks,
  resolveError,
  getOptionalEnv,
  getRequiredEnv,
  createHttpError
} from './utils.js';

const allowedServiceTypes = new Set(['3d_printing', 'it_support', 'tutoring', 'dev']);
const allowedUrgency = new Set(['normal', 'rush']);
const allowedContactMethods = new Set(['email', 'phone']);

function assertEmailConfigured() {
  const provider = (getOptionalEnv('EMAIL_PROVIDER') || 'resend').toLowerCase();
  getRequiredEnv('EMAIL_FROM');
  if (provider === 'sendgrid') {
    getRequiredEnv('SENDGRID_API_KEY');
  } else {
    getRequiredEnv('RESEND_API_KEY');
  }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    const body = await parseJsonBody(req);
    const service_type = String(body.service_type || '').trim();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const urgency = String(body.urgency || 'normal').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const contact_method_raw = String(body.contact_method || 'email').trim();
    const contact_method = allowedContactMethods.has(contact_method_raw) ? contact_method_raw : 'email';
    const location = body.location ? String(body.location).trim() : null;
    const budget = body.budget ? String(body.budget).trim() : null;
    const asset_links = normalizeAssetLinks(body.asset_links || body.asset_link);

    if (!allowedServiceTypes.has(service_type)) {
      throw createHttpError(400, 'Invalid service type.');
    }
    if (!title || !description || !name || !email) {
      throw createHttpError(400, 'Missing required fields.');
    }
    if (!allowedUrgency.has(urgency)) {
      throw createHttpError(400, 'Invalid urgency value.');
    }

    assertEmailConfigured();

    const supabase = getSupabaseClient();
    const public_id = generatePublicId();

    const { data: request, error: requestError } = await supabase
      .from('requests')
      .insert({
        public_id,
        service_type,
        title,
        description,
        urgency,
        name,
        email,
        phone,
        contact_method,
        location,
        budget,
        status: 'NEW'
      })
      .select('id, public_id, name, email')
      .single();

    if (requestError) {
      throw requestError;
    }

    if (asset_links.length) {
      const payload = asset_links.map((url) => ({
        request_id: request.id,
        asset_type: 'link',
        url
      }));
      const { error: assetError } = await supabase.from('request_assets').insert(payload);
      if (assetError) {
        throw assetError;
      }
    }

    await supabase.from('activity_log').insert({
      request_id: request.id,
      event_type: 'REQUEST_CREATED',
      message: 'Customer submitted a new request.'
    });

    const siteUrl = getSiteUrl(req);
    const statusLink = `${siteUrl}/request-status.html?id=${request.public_id}`;
    const adminLink = `${siteUrl}/admin/request.html?id=${request.id}`;

    await sendEmail({
      to: email,
      subject: 'FixItNerd request received',
      text: `Hi ${name},\n\nThanks for reaching out! Your request is in the queue. Track it here: ${statusLink}\n\nWe will follow up soon with next steps.\n\n- FixItNerd`,
      html: `
        <p>Hi ${name},</p>
        <p>Thanks for reaching out! Your request is in the queue.</p>
        <p><a href="${statusLink}">Track your request status here</a>.</p>
        <p>We will follow up soon with next steps.</p>
        <p>- FixItNerd</p>
      `
    });

    const adminNotifyEmail = getOptionalEnv('ADMIN_NOTIFY_EMAIL');
    if (adminNotifyEmail) {
      await sendEmail({
        to: adminNotifyEmail,
        subject: 'New FixItNerd request',
        text: `New request from ${name} (${email}). View details: ${adminLink}`,
        html: `
          <p>New request from <strong>${name}</strong> (${email}).</p>
          <p><a href="${adminLink}">Open the admin request detail</a>.</p>
        `
      });
    }

    return jsonResponse(200, { ok: true, public_id: request.public_id });
  } catch (error) {
    console.error('create-request error', error);
    return resolveError(error, 'Unable to create request.');
  }
};
