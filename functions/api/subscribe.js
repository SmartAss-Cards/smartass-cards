// Cloudflare Pages Function: POST /api/subscribe
// Adds an email to your Resend Audience without exposing your API key.
// Requires two environment variables set in the Cloudflare Pages dashboard:
//   RESEND_API_KEY     - your Resend API key (set as a Secret)
//   RESEND_AUDIENCE_ID - the ID of the Resend Audience to add contacts to

export async function onRequestPost(context) {
  const json = (body, status) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  let email;
  try {
    ({ email } = await context.request.json());
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email' }, 400);
  }

  const { RESEND_API_KEY, RESEND_AUDIENCE_ID } = context.env;
  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
    return json({ error: 'Signup not configured yet' }, 503);
  }

  const r = await fetch(
    `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email, unsubscribed: false })
    }
  );

  if (!r.ok) {
    return json({ error: 'Signup failed, try again' }, 502);
  }

  return json({ ok: true }, 200);
}
