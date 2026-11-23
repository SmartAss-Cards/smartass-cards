// GET /api/cards — public card list for the Squarespace code block.
// Never sends the paid video IDs.
import { CARDS, SHOP, json, corsHeaders } from "../_cards.js";

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestGet({ request }) {
  const cards = CARDS.map(c => ({
    id: c.id, title: c.title, tease: c.tease, category: c.category, price: c.price,
    previewUrl: `https://iframe.mediadelivery.net/embed/${SHOP.bunnyLibrary}/${c.previewId}?autoplay=true&loop=true&muted=true&preload=true&responsive=true`,
    thumbUrl: c.thumb ? `${SHOP.siteUrl}/${c.thumb}` : null,
  }));
  return json({ cards, maxDaysAhead: SHOP.maxDaysAhead }, 200, request);
}
