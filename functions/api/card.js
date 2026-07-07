// Cloudflare Pages Function: GET /api/card?t=TOKEN
// Upload this file to your repo as: functions/api/card.js
// Returns the card data for a valid, PAID token. The full-video URLs live
// only here on the server — they never appear in any public page source.
// Required KV binding: CARDS_KV

const VIDEO_URLS = {
  "1": "https://player.mediadelivery.net/embed/655040/e0beb112-ea33-4068-9b70-59966cde2bf4?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
  "2": "https://player.mediadelivery.net/embed/655040/0d31369f-e31c-493e-8efa-fe9f960af952?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
  "3": "https://player.mediadelivery.net/embed/655040/dc8ca812-8174-43f6-b04b-6b4b4a940fbb?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
  "4": "https://player.mediadelivery.net/embed/655040/72328498-2dd9-45fb-8210-d8432857e492?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
  "5": "https://player.mediadelivery.net/embed/655040/7d26eda2-7c47-4d63-bc89-f90ea280d644?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
  "6": "https://player.mediadelivery.net/embed/655040/5d5e606f-0b5c-43a7-a489-573403b21e95?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
  "7": "https://player.mediadelivery.net/embed/655040/979bd0c5-c7fd-466a-a5dd-89f6abb1322c?autoplay=true&loop=false&muted=false&preload=true&responsive=true",
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const json = (body, status) =>
    new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });

  if (!env.CARDS_KV) {
    return json({ error: "Card storage not configured" }, 503);
  }

  const token = new URL(request.url).searchParams.get("t") || "";
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return json({ error: "Invalid link" }, 404);
  }

  const stored = await env.CARDS_KV.get(`card:${token}`);
  if (!stored) {
    return json({ error: "Card not found" }, 404);
  }

  const card = JSON.parse(stored);

  // Payment confirmed by the Stripe webhook? If not yet, tell the page to retry.
  if (card.status !== "paid") {
    return json({ pending: true }, 202);
  }

  const videoUrl = VIDEO_URLS[card.cardId];
  if (!videoUrl) {
    return json({ error: "Card not found" }, 404);
  }

  return json({
    videoUrl: videoUrl,
    from: card.from || "",
    msg: card.msg || "",
    emoji: card.emoji || "",
    to: card.to || "",
    signers: card.signers || "",
  }, 200);
}
