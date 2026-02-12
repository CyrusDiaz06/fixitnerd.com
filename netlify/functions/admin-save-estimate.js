import {
  jsonResponse,
  getSupabaseClient,
  parseJsonBody,
  verifyAdmin,
  createHttpError,
  resolveError
} from './utils.js';

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const description = String(item.description || '').trim();
      const qty = Number(item.qty || 0);
      const unit_price_cents = Math.round(Number(item.unit_price_cents || 0));
      if (!description) return null;
      const line_total_cents = Math.round(qty * unit_price_cents);
      return {
        description,
        qty,
        unit_price_cents,
        line_total_cents
      };
    })
    .filter(Boolean);
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    const { email } = await verifyAdmin(req);
    const body = await parseJsonBody(req);
    const request_id = String(body.request_id || '').trim();
    if (!request_id) {
      throw createHttpError(400, 'Missing request id.');
    }

    const items = normalizeItems(body.items || []);
    const currency = String(body.currency || 'usd').toLowerCase();
    const status = body.status ? String(body.status).trim() : null;
    const admin_notes = body.admin_notes ? String(body.admin_notes).trim() : null;

    const subtotal_cents = items.reduce((sum, item) => sum + item.line_total_cents, 0);
    const total_cents = subtotal_cents;

    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('estimates')
      .select('id')
      .eq('request_id', request_id)
      .maybeSingle();

    let estimateId = existing ? existing.id : null;

    if (estimateId) {
      const { error: updateError } = await supabase
        .from('estimates')
        .update({ currency, subtotal_cents, total_cents })
        .eq('id', estimateId);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('estimates')
        .insert({ request_id, currency, subtotal_cents, total_cents })
        .select('id')
        .single();
      if (insertError) throw insertError;
      estimateId = inserted.id;
    }

    await supabase.from('estimate_items').delete().eq('estimate_id', estimateId);
    if (items.length) {
      const payload = items.map((item) => ({ ...item, estimate_id: estimateId }));
      const { error: itemError } = await supabase.from('estimate_items').insert(payload);
      if (itemError) throw itemError;
    }

    const requestUpdates = {};
    if (admin_notes !== null) {
      requestUpdates.admin_notes = admin_notes;
    }
    if (status) {
      requestUpdates.status = status;
    }

    if (Object.keys(requestUpdates).length) {
      const { error: requestError } = await supabase
        .from('requests')
        .update(requestUpdates)
        .eq('id', request_id);
      if (requestError) throw requestError;
    }

    await supabase.from('activity_log').insert({
      request_id,
      event_type: 'ESTIMATE_SAVED',
      message: `Estimate saved by ${email}.`
    });

    return jsonResponse(200, {
      ok: true,
      estimate_id: estimateId,
      subtotal_cents,
      total_cents
    });
  } catch (error) {
    console.error('admin-save-estimate error', error);
    return resolveError(error, 'Unable to save estimate.');
  }
};
