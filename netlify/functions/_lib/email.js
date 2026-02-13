import { getEnv } from "./supabase.js";

async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("EMAIL_FROM");
  if (!apiKey || !from) {
    return { sent: false, warning: "Email not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!response.ok) {
    const textBody = await response.text();
    return { sent: false, warning: textBody || "Resend error." };
  }

  return { sent: true };
}

async function sendSendgridEmail({ to, subject, html, text }) {
  const apiKey = getEnv("SENDGRID_API_KEY");
  const from = getEnv("EMAIL_FROM");
  if (!apiKey || !from) {
    return { sent: false, warning: "Email not configured." };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: from },
      content: [
        { type: "text/plain", value: text || "" },
        { type: "text/html", value: html || "" },
      ],
    }),
  });

  if (!response.ok) {
    const textBody = await response.text();
    return { sent: false, warning: textBody || "SendGrid error." };
  }

  return { sent: true };
}

async function sendEmail(payload) {
  const provider = (getEnv("EMAIL_PROVIDER") || "").toLowerCase();
  if (!provider) {
    return { sent: false, warning: "Email provider not configured." };
  }

  try {
    if (provider === "resend") {
      return await sendResendEmail(payload);
    }
    if (provider === "sendgrid") {
      return await sendSendgridEmail(payload);
    }
    return { sent: false, warning: "Unknown email provider." };
  } catch (error) {
    return { sent: false, warning: error.message || "Email send failed." };
  }
}

export { sendEmail };
