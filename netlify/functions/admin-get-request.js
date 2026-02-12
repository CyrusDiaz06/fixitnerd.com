import {
  jsonResponse,
  getSupabaseClient,
  verifyAdmin,
  createHttpError,
  resolveError
} from './utils.js';

export default async (req) => {
  if (req.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    await verifyAdmin(req);

    const url = new URL(req.url);
    const requestId = String(url.searchParams.get('id') || '').trim();
    if (!requestId) {
      throw createHttpError(400, 'Missing request id.');
    }

    const supabase = getSupabaseClient();
    const { data: request, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !request) {
      throw createHttpError(404, 'Request not found.');
    }

    const { data: assets } = await supabase
      .from('request_assets')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    const { data: estimate } = await supabase
      .from('estimates')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle();

    const { data: items } = estimate
      ? await supabase
          .from('estimate_items')
          .select('*')
          .eq('estimate_id', estimate.id)
      : { data: [] };

    const { data: activity } = await supabase
      .from('activity_log')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    return jsonResponse(200, {
      ok: true,
      request,
      assets: assets || [],
      estimate: estimate || null,
      items: items || [],
      activity: activity || []
    });
  } catch (error) {
    console.error('admin-get-request error', error);
    return resolveError(error, 'Unable to load request.');
  }
};
