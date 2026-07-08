// Cloudflare Pages Function: POST /checkout
// Creates a Stripe Checkout session for a card purchase and stores the card
// details in Cloudflare KV under a secret token (marked unpaid until the
// webhook confirms payment).
// Required environment variable: STRIPE_SECRET_KEY
// Required KV binding: CARDS_KV

const SITE_URL = "https://smartass-cards.pages.dev";
const VALID_CARD_IDS = ["1", "2", "3", "4", "5", "6", "7"];

function clean(value, maxLen) {
  return String(value ?? "").trim().slice(0, maxLen);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (body, status) =>
    new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });

  try {
    if (!env.CARDS_KV) {
      return json({ error: "Card storage not configured yet" }, 503);
    }

    const body = await request.json();

    const cardId = clean(body.cardId, 4);
    const cardTitle = clean(body.cardTitle, 120);
    const from = clean(body.from, 40);
    const msg = clean(body.msg, 280);
    const emoji = clean(body.emoji, 8);
    const to = clean(body.to, 60);
    const recipientEmail = clean(body.recipientEmail, 254);
    const signers = clean(body.signers, 300);

    if (!VALID_CARD_IDS.includes(cardId)) {
      return json({ error: "Unknown card" }, 400);
    }
    if (!from || !msg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return json({ error: "Missing name, message, or a valid recipient email" }, 400);
    }

    // Secret token that will unlock this card once paid
    const token = crypto.randomUUID().replace(/-/g, "");

    // Store the card as pending; expires in 24h if never paid
    await env.CARDS_KV.put(
      `card:${token}`,
      JSON.stringify({
        status: "pending",
        cardId, from, msg, emoji, to, recipientEmail, signers,
        created: Date.now(),
      }),
      { expirationTtl: 86400 }
    );

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": cardTitle || "Smartass Support Card",
        "line_items[0][price_data][product_data][description]": `A Smartass Support Card from ${from}${to ? ` to ${to}` : ""}`,
        "line_items[0][price_data][unit_amount]": "200",
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": `${SITE_URL}/recipient.html?t=${token}`,
        "cancel_url": `${SITE_URL}/card.html?id=${cardId}`,
        "metadata[token]": token,
        "metadata[cardId]": cardId,
        "metadata[from]": from,
        "metadata[to]": to,
      }),
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json({ error: session.error?.message || "Stripe error" }, 400);
    }

    return json({ url: session.url }, 200);

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
