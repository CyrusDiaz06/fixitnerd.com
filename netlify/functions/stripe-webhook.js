import Stripe from 'stripe';
import {
  jsonResponse,
  getSupabaseClient,
  sendEmail,
  getSiteUrl,
  getRequiredEnv,
  getOptionalEnv,
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
    const stripeKey = getRequiredEnv('STRIPE_SECRET_KEY');
    const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SECRET');
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return jsonResponse(400, { error: 'Missing Stripe signature.' });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const payload = await req.text();

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('stripe-webhook signature error', error.message);
      return jsonResponse(400, { error: 'Webhook signature verification failed.' });
    }

    if (stripeEvent.type === 'checkout.session.completed') {
      assertEmailConfigured();
      const session = stripeEvent.data.object;
      const supabase = getSupabaseClient();
      const { data: estimate, error } = await supabase
        .from('estimates')
        .select('id, request_id, stripe_session_id')
        .eq('stripe_session_id', session.id)
        .single();

      if (error || !estimate) {
        return jsonResponse(404, { error: 'Estimate not found for session.' });
      }

      await supabase.from('requests').update({ status: 'PAID' }).eq('id', estimate.request_id);

      await supabase.from('activity_log').insert({
        request_id: estimate.request_id,
        event_type: 'PAYMENT_RECEIVED',
        message: 'Stripe payment completed.'
      });

      const { data: request } = await supabase
        .from('requests')
        .select('name, email, public_id, title')
        .eq('id', estimate.request_id)
        .single();

      if (request) {
        const siteUrl = getSiteUrl(req);
        const statusLink = `${siteUrl}/request-status.html?id=${request.public_id}`;
        await sendEmail({
          to: request.email,
          subject: 'Payment received - FixItNerd',
          text: `Thanks ${request.name}! Payment received for ${request.title}. Track your request: ${statusLink}`,
          html: `<p>Thanks ${request.name}!</p><p>Payment received for <strong>${request.title}</strong>.</p><p><a href="${statusLink}">Track your request</a></p>`
        });

        const adminEmail = getOptionalEnv('ADMIN_NOTIFY_EMAIL');
        if (adminEmail) {
          await sendEmail({
            to: adminEmail,
            subject: 'FixItNerd payment received',
            text: `${request.name} paid for ${request.title}.`,
            html: `<p><strong>${request.name}</strong> paid for ${request.title}.</p>`
          });
        }
      }
    }

    return jsonResponse(200, { ok: true, received: true });
  } catch (error) {
    console.error('stripe-webhook processing error', error);
    return resolveError(error, 'Webhook processing failed.');
  }
};
