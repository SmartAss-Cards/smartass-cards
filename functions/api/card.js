// GET /api/card?t=TOKEN — opens a paid card for the recipient.
// Returns a signed Bunny.net video link that expires after a few hours.
// Env vars: BUNNY_TOKEN_KEY (Bunny Stream > your library > Security > Token Authentication Key)
import { CARDS, SHOP } from "../_cards.js";

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!/^[a-f0-9]{32}$/.test(token)) return new Response("{}", { status: 404, headers });

  const stored = await env.CARDS_KV.get(`card:${token}`);
  if (!stored) return new Response("{}", { status: 404, headers });
  const order = JSON.parse(stored);
  if (order.status !== "paid") return new Response("{}", { status: 202, headers });

  const card = CARDS.find(c => c.id === order.cardId);
  if (!card) return new Response("{}", { status: 404, headers });

  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 6 hours
  const sig = await sha256Hex(env.BUNNY_TOKEN_KEY + card.fullId + expires);
  const videoUrl = `https://iframe.mediadelivery.net/embed/${SHOP.bunnyLibrary}/${card.fullId}?token=${sig}&expires=${expires}&autoplay=true&responsive=true`;

  // The personal note is stored separately and disappears on its own after the note period.
  const noteRaw = await env.CARDS_KV.get(`note:${token}`);
  if (!noteRaw) {
    return new Response(JSON.stringify({ videoUrl, noteExpired: true }), { status: 200, headers });
  }
  const note = JSON.parse(noteRaw);
  return new Response(JSON.stringify({
    from: note.from, to: note.to, msg: note.msg, videoUrl,
    font: note.font || "plain", color: note.color || "#3E2A1E", align: note.align || "left", gifUrl: note.gifUrl || "",
  }), { status: 200, headers });
}
