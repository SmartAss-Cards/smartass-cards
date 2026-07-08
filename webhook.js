// Cloudflare Pages Function: POST /webhook
// Verifies Stripe's signature, marks the purchased card as paid in KV,
// and emails the secret card link to the recipient via Resend.
// Required environment variables: STRIPE_WEBHOOK_SECRET, RESEND_API_KEY
// Required KV binding: CARDS_KV

const SITE_URL = "https://smartass-cards.pages.dev";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Verify Stripe's webhook signature (HMAC-SHA256 of "timestamp.payload", scheme v1)
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;

  let timestamp = null;
  const signatures = [];
  for (const part of sigHeader.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.includes(expected);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");

    const valid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    let event;
    try {
      event = JSON.parse(payload);
    } catch (err) {
      return new Response("Invalid payload", { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      return new Response("OK", { status: 200 });
    }

    const token = event.data.object.metadata?.token;
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    // Look up the pending card stored at checkout time
    const stored = await env.CARDS_KV.get(`card:${token}`);
    if (!stored) {
      return new Response("Card not found", { status: 404 });
    }
    const card = JSON.parse(stored);

    // Mark paid and store permanently (no expiry)
    card.status = "paid";
    card.paidAt = Date.now();
    await env.CARDS_KV.put(`card:${token}`, JSON.stringify(card));

    const recipientUrl = `${SITE_URL}/recipient.html?t=${token}`;
    const from = card.from || "";
    const to = card.to || "";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Smartass Support Cards <cards@smartass.cards>",
        to: [card.recipientEmail],
        subject: `${from} sent you a Smartass Support Card 🎉`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #1C1209; color: #F2E4C8; padding: 40px 32px; border-radius: 8px;">
            <img src="${SITE_URL}/logo.png" alt="Smartass Support Cards" style="height: 40px; margin-bottom: 28px; display: block;">
            <p style="font-size: 18px; font-weight: bold; color: #F2E4C8; margin-bottom: 8px;">${to ? `Hey ${esc(to)},` : 'Hey,'}</p>
            <p style="font-size: 15px; color: #D9C9A8; margin-bottom: 24px; line-height: 1.6;">${esc(from)} sent you a Smartass Support Card. Click below to open it.</p>
            <a href="${recipientUrl}" style="display: inline-block; background: #E04820; color: #FDF8EF; text-decoration: none; padding: 14px 28px; border-radius: 4px; font-size: 14px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 28px;">Open Your Card →</a>
            <p style="font-size: 13px; color: #D9C9A8; opacity: 0.6; line-height: 1.6;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${recipientUrl}" style="color: #C8922A;">${recipientUrl}</a></p>
            <hr style="border: none; border-top: 1px solid #3D2A1A; margin: 28px 0;">
            <p style="font-size: 11px; color: #D9C9A8; opacity: 0.4;">© 2026 Smartass Support Cards</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.json();
      console.error("Resend error:", emailError);
      return new Response("Email failed", { status: 500 });
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
}
