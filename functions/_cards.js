// MASTER CARD LIST — the one place to add or edit cards.
// Fields:
//   id          short unique id (used in links)
//   title       full card title
//   tease       short line shown under the thumbnail
//   category    must match a category name on the Squarespace shop page exactly
//   price       in cents (200 = $2.00)
//   previewId   Bunny.net video ID of the free preview (watermarked)
//   fullId      Bunny.net video ID of the paid, full video — PASTE THESE IN
//   thumb       file name of a square thumbnail uploaded to the repo root (optional)
export const CARDS = [
  { id: 1, title: "You're Bigger Than This. But I'm Still Better Than You.", tease: "You're bigger than this but…", category: "Support & Sympathy", price: 200, previewId: "4decfe9c-4f55-4520-ad04-277edf8bbfb4", fullId: "PASTE_FULL_VIDEO_ID_1", thumb: "thumb_1.jpg" },
  { id: 2, title: "Today Might Suck. But Tomorrow? Tomorrow Might Suck Too.", tease: "Today might suck but…", category: "Support & Sympathy", price: 200, previewId: "fe3a2410-9329-4bce-a024-2e9dc6d7cfcb", fullId: "PASTE_FULL_VIDEO_ID_2", thumb: "thumb_2.jpg" },
  { id: 3, title: "Thinking of You. Anything More and I Have To Charge.", tease: "Thinking of you…", category: "Support & Sympathy", price: 200, previewId: "fe38131d-d706-4c79-bb39-7808a12850b4", fullId: "PASTE_FULL_VIDEO_ID_3", thumb: "thumb_3.jpg" },
  { id: 4, title: "Let's Get Lunch. Your Turn To Buy.", tease: "Let's get lunch…", category: "Support & Sympathy", price: 200, previewId: "6e597bb7-1ac4-47e4-a0d0-46fb7421e9eb", fullId: "PASTE_FULL_VIDEO_ID_4", thumb: "thumb_4.jpg" },
  { id: 5, title: "The Lord Replied.", tease: "and the Lord replied…", category: "Support & Sympathy", price: 200, previewId: "026693bf-115e-4687-b6c2-2a98fb80870c", fullId: "PASTE_FULL_VIDEO_ID_5", thumb: "thumb_5.jpg" },
  { id: 6, title: "I Stopped Celebrating Mine When I Grew Up.", tease: "Happy Birthday…", category: "Birthday", price: 200, previewId: "b15eddd1-02b2-4044-96a9-54df503e42df", fullId: "PASTE_FULL_VIDEO_ID_6", thumb: "thumb_6.jpg" },
  { id: 7, title: "You Could Have Done More. But Didn't.", tease: "Thank You…", category: "Thank You", price: 200, previewId: "3e6854e9-1f1b-4c79-af09-2dea7c108807", fullId: "PASTE_FULL_VIDEO_ID_7", thumb: "thumb_7.jpg" },
];

// Shared settings
export const SHOP = {
  bunnyLibrary: "655040",
  // Where the shop lives. Used for return links and the recipient page.
  siteUrl: "https://shop.smartass.cards",
  // Which websites may call this API from the browser (your Squarespace site).
  allowedOrigins: ["https://www.smartass.cards", "https://smartass.cards", "https://smartasssupportcards.squarespace.com"],
  // Where order notifications go.
  ownerEmail: "info@smartass.cards",
  fromEmail: "Smartass Support Cards <noreply@smartass.cards>",
  // Latest a buyer can schedule a card (Resend holds scheduled emails up to 30 days).
  maxDaysAhead: 30,
  // Hour (UTC) at which scheduled cards are delivered. 16 = 8am Pacific / 11am Eastern.
  deliverHourUtc: 16,
  // The personal note (names, message, GIF, styling) is deleted this many days after delivery.
  // The card video link keeps working forever.
  noteDays: 90,
};

export function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const ok = SHOP.allowedOrigins.includes(origin) ? origin : SHOP.allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}
