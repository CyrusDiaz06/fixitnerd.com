import Stripe from 'stripe';
import {
  jsonResponse,
  getSupabaseClient,
  parseJsonBody,
  verifyAdmin,
  sendEmail,
  getSiteUrl,
  formatMoney,
  getRequiredEnv,
  getOptionalEnv,
  createHttpError,
  resolveError
} from './utils.js';

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
    const { email: adminEmail } = await verifyAdmin(req);
    const body = await parseJsonBody(req);
    const request_id = String(body.request_id || '').trim();
    if (!request_id) {
      throw createHttpError(400, 'Missing request id.');
    }

    const stripeKey = getRequiredEnv('STRIPE_SECRET_KEY');
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    assertEmailConfigured();

    const supabase = getSupabaseClient();
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', request_id)
      .single();
    if (requestError || !request) {
      throw createHttpError(404, 'Request not found.');
    }

    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select('*')
      .eq('request_id', request_id)
      .single();
    if (estimateError || !estimate) {
      throw createHttpError(400, 'Estimate must be saved before sending invoice.');
    }

    const { data: items, error: itemsError } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', estimate.id);
    if (itemsError) throw itemsError;

    if (!items || !items.length) {
      throw createHttpError(400, 'Estimate must have at least one line item.');
    }

    const siteUrl = getSiteUrl(req);
    const successUrl = `${siteUrl}/request-status.html?id=${request.public_id}&status=success`;
    const cancelUrl = `${siteUrl}/request-status.html?id=${request.public_id}&status=cancelled`;

    const lineItems = items.map((item) => ({
      price_data: {
        currency: estimate.currency || 'usd',
        product_data: {
          name: item.description
        },
        unit_amount: item.unit_price_cents
      },
      quantity: item.qty
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: request.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        request_id: request.id,
        public_id: request.public_id
      }
    });

    const { error: updateEstimateError } = await supabase
      .from('estimates')
      .update({
        stripe_session_id: session.id,
        stripe_checkout_url: session.url
      })
      .eq('id', estimate.id);
    if (updateEstimateError) throw updateEstimateError;

    await supabase.from('requests').update({ status: 'SENT_TO_CUSTOMER' }).eq('id', request.id);

    await supabase.from('activity_log').insert({
      request_id: request.id,
      event_type: 'INVOICE_SENT',
      message: `Invoice sent by ${adminEmail}.`
    });

    const summaryLines = items
      .map((item) => `- ${item.description} (${item.qty} x ${formatMoney(item.unit_price_cents, estimate.currency)})`)
      .join('\n');

    await sendEmail({
      to: request.email,
      subject: 'Your FixItNerd estimate is ready',
      text: `Hi ${request.name},\n\nYour estimate is ready. You can review and pay here: ${session.url}\n\nEstimate summary:\n${summaryLines}\n\nTotal: ${formatMoney(estimate.total_cents, estimate.currency)}\n\n- FixItNerd`,
      html: `
        <p>Hi ${request.name},</p>
        <p>Your estimate is ready. You can review and pay here:</p>
        <p><a href="${session.url}">Pay your invoice</a></p>
        <p><strong>Estimate summary</strong></p>
        <ul>
          ${items
            .map(
              (item) =>
                `<li>${item.description} (${item.qty} x ${formatMoney(item.unit_price_cents, estimate.currency)})</li>`
            )
            .join('')}
        </ul>
        <p><strong>Total:</strong> ${formatMoney(estimate.total_cents, estimate.currency)}</p>
        <p>- FixItNerd</p>
      `
    });

    return jsonResponse(200, { ok: true, checkout_url: session.url });
  } catch (error) {
    console.error('admin-send-invoice error', error);
    return resolveError(error, 'Unable to send invoice.');
  }
};
