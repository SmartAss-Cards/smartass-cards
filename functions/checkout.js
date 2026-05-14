export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { cardId, cardTitle, from, msg, emoji, to, recipientEmail, signers } = body;

    // Create Stripe Checkout Session
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": cardTitle,
        "line_items[0][price_data][product_data][description]": `A Smartass Support Card from ${from} to ${to}`,
        "line_items[0][price_data][unit_amount]": "200",
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": `https://smartass-cards.pages.dev/recipient.html?id=${cardId}&from=${encodeURIComponent(from)}&msg=${encodeURIComponent(msg)}&emoji=${encodeURIComponent(emoji)}&to=${encodeURIComponent(to)}&signers=${encodeURIComponent(signers)}&paid=true`,
        "cancel_url": `https://smartass-cards.pages.dev/card.html?id=${cardId}`,
        "metadata[cardId]": cardId,
        "metadata[from]": from,
        "metadata[msg]": msg,
        "metadata[emoji]": emoji,
        "metadata[to]": to,
        "metadata[recipientEmail]": recipientEmail,
        "metadata[signers]": signers,
      }),
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || "Stripe error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
