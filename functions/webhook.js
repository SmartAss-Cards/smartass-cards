// POST /webhook — Stripe calls this after a successful payment.
// 1. Checks Stripe's signature.  2. Marks the card paid in KV.
// 3. Emails the recipient (now, or scheduled for the send date).  4. Emails you.
// Env vars: STRIPE_WEBHOOK_SECRET, RESEND_API_KEY. KV binding: CARDS_KV.
import { SHOP } from "./_cards.js";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  let timestamp = null; const sigs = [];
  for (const part of sigHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    if (k === "v1") sigs.push(v);
  }
  if (!timestamp || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  return sigs.includes(expected);
}

async function sendEmail(env, email) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(email),
  });
  if (!r.ok) console.error("Resend error:", await r.text());
  return r.ok;
}

function prettyDate(ymd) {
  const d = new Date(ymd + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.text();
    const ok = await verifyStripeSignature(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
    if (!ok) return new Response("Invalid signature", { status: 400 });

    const event = JSON.parse(payload);
    if (event.type !== "checkout.session.completed") return new Response("OK", { status: 200 });

    const token = event.data.object.metadata?.token;
    if (!token) return new Response("Missing token", { status: 400 });

    const stored = await env.CARDS_KV.get(`card:${token}`);
    if (!stored) return new Response("Card not found", { status: 404 });
    const order = JSON.parse(stored);
    if (order.status === "paid") return new Response("OK", { status: 200 }); // Stripe retried; already handled

    const openUrl = `${SHOP.siteUrl}/recipient.html?t=${token}`;
    const today = new Date().toISOString().slice(0, 10);
    const scheduled = order.sendDate && order.sendDate > today;
    const hh = String(SHOP.deliverHourUtc).padStart(2, "0");
    const deliverAt = scheduled ? Date.parse(`${order.sendDate}T${hh}:00:00Z`) : Date.now();
    const noteExpiresAt = deliverAt + SHOP.noteDays * 24 * 60 * 60 * 1000;

    // Two records:
    //  card:TOKEN  — which card was bought. Kept forever so the video link always works. No personal info.
    //  note:TOKEN  — names, message, GIF, styling. Deleted automatically ${SHOP.noteDays} days after delivery.
    await env.CARDS_KV.put(`note:${token}`, JSON.stringify({
      from: order.from, to: order.to, msg: order.msg,
      font: order.font, color: order.color, align: order.align, gifUrl: order.gifUrl,
    }), { expiration: Math.floor(noteExpiresAt / 1000) });
    await env.CARDS_KV.put(`card:${token}`, JSON.stringify({
      status: "paid", cardId: order.cardId, cardTitle: order.cardTitle,
      paidAt: Date.now(), deliverAt, noteExpiresAt, stripeSession: event.data.object.id,
    })); // no expiry, no personal info

    // Recipient email — sent now, or held by Resend until the send date.
    const recipientEmail = {
      from: SHOP.fromEmail,
      to: [order.recipientEmail],
      subject: `${order.from} sent you a Smartass Support Card`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#261710;color:#F4EAD5;padding:40px 32px;border-radius:8px;">
          <p style="font-size:18px;font-weight:bold;margin:0 0 8px;">Hey ${esc(order.to)},</p>
          <p style="font-size:15px;color:#E0D0AE;margin:0 0 24px;line-height:1.6;">${esc(order.from)} sent you a Smartass Support Card. Turn your sound on and click below to open it.</p>
          <a href="${openUrl}" style="display:inline-block;background:#E0503C;color:#FDF8EF;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:bold;">Open Your Card</a>
          <p style="font-size:13px;color:#E0D0AE;opacity:0.7;line-height:1.6;margin-top:28px;">If the button doesn't work, copy this link into your browser:<br><a href="${openUrl}" style="color:#E2A63E;">${openUrl}</a></p>
          <hr style="border:none;border-top:1px solid #4E3620;margin:28px 0;">
          <p style="font-size:11px;color:#E0D0AE;opacity:0.5;margin:0;">© 2026 Smartass Support Cards · smartass.cards</p>
        </div>`,
    };
    if (scheduled) recipientEmail.scheduled_at = `${order.sendDate}T${String(SHOP.deliverHourUtc).padStart(2, "0")}:00:00Z`;
    await sendEmail(env, recipientEmail);

    // Buyer receipt
    await sendEmail(env, {
      from: SHOP.fromEmail,
      to: [order.buyerEmail],
      subject: scheduled ? `Your card to ${order.to} is scheduled for ${prettyDate(order.sendDate)}` : `Your card to ${order.to} is on its way`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#261710;">
          <p style="font-size:17px;">Thanks, ${esc(order.from)}.</p>
          <p style="font-size:15px;line-height:1.6;">Your card <strong>${esc(order.cardTitle)}</strong> ${scheduled ? `will be emailed to ${esc(order.to)} on ${prettyDate(order.sendDate)}.` : `has been emailed to ${esc(order.to)}.`}</p>
          <p style="font-size:15px;line-height:1.6;">Your message:<br><em>"${esc(order.msg)}"</em></p>
          <p style="font-size:13px;color:#777;">Questions? Reply to this email.</p>
        </div>`,
      reply_to: SHOP.ownerEmail,
    });

    // Owner notification
    await sendEmail(env, {
      from: SHOP.fromEmail,
      to: [SHOP.ownerEmail],
      subject: `New order: ${order.cardTitle} ($${(event.data.object.amount_total / 100).toFixed(2)})`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;padding:24px;color:#261710;">
          <h2 style="margin:0 0 16px;">New eCard sale</h2>
          <table style="font-size:15px;line-height:1.8;">
            <tr><td><strong>Card</strong></td><td>${esc(order.cardTitle)}</td></tr>
            <tr><td><strong>From</strong></td><td>${esc(order.from)} (${esc(order.buyerEmail)})</td></tr>
            <tr><td><strong>To</strong></td><td>${esc(order.to)} (${esc(order.recipientEmail)})</td></tr>
            <tr><td><strong>Send date</strong></td><td>${scheduled ? prettyDate(order.sendDate) : "Sent immediately"}</td></tr>
            <tr><td><strong>Message</strong></td><td>${esc(order.msg)}</td></tr>
            <tr><td><strong>Discount</strong></td><td>${event.data.object.total_details?.amount_discount ? "$" + (event.data.object.total_details.amount_discount / 100).toFixed(2) + " off" : "None"}</td></tr>
            <tr><td><strong>Stripe</strong></td><td>${esc(event.data.object.id)}</td></tr>
            <tr><td><strong>Card link</strong></td><td><a href="${openUrl}">${openUrl}</a></td></tr>
          </table>
        </div>`,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
}
