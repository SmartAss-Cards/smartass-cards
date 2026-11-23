// POST /api/checkout — saves the personalized card as "pending" and
// sends the buyer to Stripe Checkout.
// Env vars: STRIPE_SECRET_KEY. KV binding: CARDS_KV.
import { CARDS, SHOP, json, corsHeaders } from "../_cards.js";

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function randomToken() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400, request); }

  const card = CARDS.find(c => String(c.id) === String(body.cardId));
  if (!card) return json({ error: "Unknown card" }, 400, request);

  const from = String(body.from || "").trim().slice(0, 60);
  const to = String(body.to || "").trim().slice(0, 60);
  const msg = String(body.msg || "").trim().slice(0, 500);
  const recipientEmail = String(body.recipientEmail || "").trim().toLowerCase();
  const buyerEmail = String(body.buyerEmail || "").trim().toLowerCase();
  const sendDate = String(body.sendDate || "").trim(); // YYYY-MM-DD, empty = send now
  const returnUrl = String(body.returnUrl || "").trim();
  // Message styling (must match the lists in the code block and recipient.html)
  const FONTS = ["hand", "type", "play", "retro", "plain"];
  const font = FONTS.includes(body.font) ? body.font : "hand";
  const color = /^#[0-9a-fA-F]{6}$/.test(body.color || "") ? body.color : "#3E2A1E";
  const align = ["left", "center", "right"].includes(body.align) ? body.align : "left";
  const gifRaw = String(body.gifUrl || "").trim();
  const gifUrl = /^https:\/\/[a-z0-9.-]*giphy\.com\//i.test(gifRaw) ? gifRaw.slice(0, 500) : "";

  const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  if (!from || !to || !msg || !emailOk(recipientEmail) || !emailOk(buyerEmail)) {
    return json({ error: "Missing or invalid fields" }, 400, request);
  }
  if (sendDate) {
    const d = new Date(sendDate + "T00:00:00Z");
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const max = new Date(today); max.setUTCDate(max.getUTCDate() + SHOP.maxDaysAhead);
    if (isNaN(d) || d < today || d > max) return json({ error: "Send date out of range" }, 400, request);
  }
  const allowedReturn = SHOP.allowedOrigins.some(o => returnUrl.startsWith(o)) ? returnUrl : SHOP.allowedOrigins[0];

  const token = randomToken();
  await env.CARDS_KV.put(`card:${token}`, JSON.stringify({
    status: "pending", cardId: card.id, cardTitle: card.title,
    from, to, msg, recipientEmail, buyerEmail, sendDate, font, color, align, gifUrl, createdAt: Date.now(),
  }), { expirationTtl: 60 * 60 * 24 });

  const params = new URLSearchParams({
    "mode": "payment",
    "success_url": `${allowedReturn}${allowedReturn.includes("?") ? "&" : "?"}paid=1&t=${token}`,
    "cancel_url": allowedReturn,
    "customer_email": buyerEmail,
    "allow_promotion_codes": "true", // shows an "Add promotion code" box on Stripe's checkout page
    "metadata[token]": token,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(card.price),
    "line_items[0][price_data][product_data][name]": `Smartass eCard: ${card.title}`,
    "line_items[0][price_data][product_data][description]": `To ${to} from ${from}`,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const session = await res.json();
  if (!res.ok || !session.url) {
    console.error("Stripe error", session);
    return json({ error: "Could not start checkout" }, 500, request);
  }
  return json({ url: session.url }, 200, request);
}
