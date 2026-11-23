// GET /api/gifs?q=term — searches GIPHY so the buyer can add a GIF.
// Keeps your GIPHY key private. Env var: GIPHY_API_KEY.
import { json, corsHeaders } from "../_cards.js";

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestGet({ request, env }) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 60);
  if (!q) return json({ gifs: [] }, 200, request);
  if (!env.GIPHY_API_KEY) return json({ error: "GIF search not configured" }, 500, request);
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${env.GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=pg-13&lang=en`;
  const r = await fetch(url);
  if (!r.ok) return json({ error: "GIPHY error" }, 502, request);
  const d = await r.json();
  const gifs = (d.data || []).map(g => ({
    title: g.title || "GIF",
    preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
    url: g.images?.downsized_medium?.url || g.images?.fixed_width?.url,
    still: g.images?.downsized_still?.url || g.images?.fixed_width_still?.url,
  })).filter(g => g.url);
  return json({ gifs }, 200, request);
}
