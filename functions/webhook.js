export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Parse the Stripe event
    let event;
    try {
      event = JSON.parse(payload);
    } catch (err) {
      return new Response("Invalid payload", { status: 400 });
    }

    // Only handle successful payments
    if (event.type !== "checkout.session.completed") {
      return new Response("OK", { status: 200 });
    }

    const session = event.data.object;
    const metadata = session.metadata;

    const cardId = metadata.cardId;
    const from = metadata.from;
    const msg = metadata.msg;
    const emoji = metadata.emoji;
    const to = metadata.to;
    const recipientEmail = metadata.recipientEmail;
    const signers = metadata.signers || "";

    // Build the recipient page URL
    const recipientUrl = `https://smartass-cards.pages.dev/recipient.html?id=${cardId}&from=${encodeURIComponent(from)}&msg=${encodeURIComponent(msg)}&emoji=${encodeURIComponent(emoji)}&to=${encodeURIComponent(to)}&signers=${encodeURIComponent(signers)}&paid=true`;

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Smartass Support Cards <cards@smartass.cards>",
        to: [recipientEmail],
        subject: `${from} sent you a Smartass Support Card 🎉`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #1C1209; color: #F2E4C8; padding: 40px 32px; border-radius: 8px;">
            <img src="https://images.squarespace-cdn.com/content/v1/6744860d0caea30524e77cd6/3640bf45-f2a6-4471-bc56-5d72af36f428/Logo1.png?format=300w" alt="Smartass Support Cards" style="height: 40px; margin-bottom: 28px; display: block;">
            <p style="font-size: 18px; font-weight: bold; color: #F2E4C8; margin-bottom: 8px;">${to ? `Hey ${to},` : 'Hey,'}</p>
            <p style="font-size: 15px; color: #D9C9A8; margin-bottom: 24px; line-height: 1.6;">${from} sent you a Smartass Support Card. Click below to open it.</p>
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
