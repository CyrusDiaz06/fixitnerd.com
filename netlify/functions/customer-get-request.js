import {
  jsonResponse,
  getSupabaseClient,
  parseJsonBody,
  formatMoney,
  createHttpError,
  resolveError
} from './utils.js';

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    const body = req.method === 'POST' ? await parseJsonBody(req) : {};
    const url = new URL(req.url);
    const public_id = String(
      body.public_id ||
        body.id ||
        url.searchParams.get('public_id') ||
        url.searchParams.get('id') ||
        ''
    ).trim();

    if (!public_id) {
      throw createHttpError(400, 'Missing request id.');
    }

    const supabase = getSupabaseClient();
    const { data: request, error } = await supabase
      .from('requests')
      .select('id, public_id, service_type, title, description, urgency, name, email, phone, contact_method, location, budget, status, created_at, updated_at')
      .eq('public_id', public_id)
      .single();

    if (error || !request) {
      throw createHttpError(404, 'Request not found.');
    }

    const { data: estimate } = await supabase
      .from('estimates')
      .select('id, currency, subtotal_cents, total_cents, stripe_checkout_url')
      .eq('request_id', request.id)
      .maybeSingle();

    const { data: items } = estimate
      ? await supabase
          .from('estimate_items')
          .select('description, qty, unit_price_cents, line_total_cents')
          .eq('estimate_id', estimate.id)
      : { data: [] };

    const { data: previews } = await supabase
      .from('previews')
      .select('option_label, image_url, prompt, created_at')
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });

    return jsonResponse(200, {
      ok: true,
      request: {
        public_id: request.public_id,
        service_type: request.service_type,
        title: request.title,
        description: request.description,
        urgency: request.urgency,
        name: request.name,
        email: request.email,
        phone: request.phone,
        contact_method: request.contact_method,
        location: request.location,
        budget: request.budget,
        status: request.status,
        created_at: request.created_at,
        updated_at: request.updated_at
      },
      estimate: estimate
        ? {
            currency: estimate.currency,
            subtotal_cents: estimate.subtotal_cents,
            total_cents: estimate.total_cents,
            formatted_total: formatMoney(estimate.total_cents, estimate.currency),
            items: items || [],
            checkout_url: estimate.stripe_checkout_url,
            stripe_checkout_url: estimate.stripe_checkout_url
          }
        : null,
      previews: previews || []
    });
  } catch (error) {
    console.error('customer-get-request error', error);
    return resolveError(error, 'Unable to load request.');
  }
};
